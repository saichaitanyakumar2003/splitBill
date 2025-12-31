const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

/**
 * Group Model
 * 
 * Schema:
 * - _id (PK): unique id
 * - name: group name
 * - status: enum('active', 'completed')
 * - compressedDetails: brotli compressed buffer containing:
 *   - expenses: array of { name, payer (mail id), payees (list of mail ids), amount }
 *   - consolidatedExpenses: array of edges { from, to, amount } where 'from' pays 'to' amount
 * - createdBy: mail id of creator
 */

const GroupSchema = new mongoose.Schema({
  // Primary Key - Unique ID
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },

  // Group name
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true
  },

  // Status: active or completed
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },

  // Compressed details (brotli) - contains expenses and consolidatedExpenses
  compressedDetails: {
    type: Buffer,
    required: true,
    default: () => compressData({ expenses: [], consolidatedExpenses: [] })
  },

  // Creator mail ID
  createdBy: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// ============ Instance Methods ============

// Get decompressed details
GroupSchema.methods.getDetails = function() {
  if (!this.compressedDetails) return { expenses: [], consolidatedExpenses: [] };
  return decompressData(this.compressedDetails);
};

// Set compressed details
GroupSchema.methods.setDetails = function(details) {
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
};

/**
 * Add expense
 * @param {Object} expense - { name, payer (mail id), payees (mail id[]), amount }
 */
GroupSchema.methods.addExpense = function(expense) {
  const details = this.getDetails();
  
  details.expenses.push({
    id: new mongoose.Types.ObjectId().toString(),
    name: expense.name,
    payer: expense.payer.toLowerCase().trim(), // mail id of who paid
    payees: (expense.payees || []).map(p => p.toLowerCase().trim()), // mail ids of who owes
    amount: parseFloat(expense.amount),
    createdAt: new Date().toISOString()
  });
  
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
  
  // Recalculate consolidated expenses
  this.recalculateConsolidated();
};

/**
 * Remove expense by ID
 */
GroupSchema.methods.removeExpense = function(expenseId) {
  const details = this.getDetails();
  details.expenses = details.expenses.filter(e => e.id !== expenseId);
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
  this.recalculateConsolidated();
};

/**
 * Recalculate consolidated expenses
 * Creates minimal edges: { from, to, amount } where 'from' pays 'to' amount
 */
GroupSchema.methods.recalculateConsolidated = function() {
  const details = this.getDetails();
  const balances = {}; // { mailId: balance } positive = owed money, negative = owes money

  // Calculate net balance for each person
  for (const expense of details.expenses) {
    const numPayees = expense.payees.length || 1;
    const splitAmount = expense.amount / numPayees;
    
    // Payer is owed money (positive balance)
    balances[expense.payer] = (balances[expense.payer] || 0) + expense.amount;
    
    // Each payee owes money (negative balance)
    for (const payee of expense.payees) {
      balances[payee] = (balances[payee] || 0) - splitAmount;
    }
  }

  // Separate into creditors (owed money, positive) and debtors (owe money, negative)
  const creditors = []; // people who are owed money
  const debtors = [];   // people who owe money

  for (const [mailId, balance] of Object.entries(balances)) {
    if (balance > 0.01) {
      creditors.push({ mailId, amount: balance });
    } else if (balance < -0.01) {
      debtors.push({ mailId, amount: -balance }); // convert to positive
    }
  }

  // Sort by amount descending for greedy algorithm
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Generate minimal transactions using greedy algorithm
  // Edge format: { from: 'a', to: 'b', amount: c } means 'a' pays 'b' amount 'c'
  const consolidated = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      consolidated.push({
        from: debtor.mailId,    // 'a' pays
        to: creditor.mailId,    // 'b'
        amount: Math.round(amount * 100) / 100  // 'c' (rounded to 2 decimals)
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  details.consolidatedExpenses = consolidated;
  this.compressedDetails = compressData(details);
};

/**
 * Get consolidated expenses (settlements)
 * Returns array of { from, to, amount } where 'from' should pay 'to'
 */
GroupSchema.methods.getSettlements = function() {
  const details = this.getDetails();
  return details.consolidatedExpenses;
};

// JSON output
GroupSchema.methods.toJSON = function() {
  const details = this.getDetails();
  return {
    id: this._id,
    name: this.name,
    status: this.status,
    expenses: details.expenses,
    consolidatedExpenses: details.consolidatedExpenses,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Group', GroupSchema);
