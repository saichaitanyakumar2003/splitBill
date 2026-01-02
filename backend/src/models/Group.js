const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

/**
 * Group Model
 * 
 * Schema:
 * - _id (PK): UUID string
 * - name: group name
 * - status: enum('active', 'completed')
 * - compressedDetails: brotli compressed buffer containing:
 *   - expenses: array of { name, payer (mail id), totalAmount, payees: [{ mailId, amount }] }
 *   - consolidatedExpenses: array of edges { from, to, amount, resolved } where 'from' pays 'to' amount
 *     - resolved: boolean flag indicating if the payment has been settled
 */

const GroupSchema = new mongoose.Schema({
  // Primary Key - UUID string
  _id: {
    type: String,
    required: true
  },

  // Group name - unique across all groups
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    unique: true
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
 * Recalculate consolidated expenses using Splitwise algorithm
 * Creates minimal edges: { from, to, amount, resolved } where 'from' pays 'to' amount
 * 
 * IMPORTANT: Resolved edges represent ACTUAL payments that happened in real life.
 * When recalculating, we SUBTRACT resolved amounts from the balances because
 * those payments have already been made.
 * 
 * Example:
 * - B owes A ₹100, B marks as resolved (B actually paid A ₹100)
 * - New expense: B now owes A ₹150 total from all expenses
 * - After subtracting resolved: B owes A only ₹50 (150 - 100 already paid)
 */
GroupSchema.methods.recalculateConsolidated = function() {
  const details = this.getDetails();
  const balances = {}; // { mailId: balance } positive = owed money, negative = owes money

  // Store resolved edges - these are actual payments that happened
  const resolvedPayments = [];
  if (details.consolidatedExpenses) {
    details.consolidatedExpenses.forEach(edge => {
      if (edge.resolved) {
        resolvedPayments.push({
          from: edge.from,
          to: edge.to,
          amount: edge.amount
        });
      }
    });
  }

  // Calculate net balance for each person from expenses
  for (const expense of details.expenses) {
    const payer = expense.payer;
    const totalAmount = expense.totalAmount || expense.amount;
    
    // Payer gets credited for total amount paid
    balances[payer] = (balances[payer] || 0) + totalAmount;
    
    // Each payee gets debited for their share
    for (const payee of (expense.payees || [])) {
      // Support both formats: { mailId, amount } or just string mailId
      if (typeof payee === 'object') {
        balances[payee.mailId] = (balances[payee.mailId] || 0) - payee.amount;
      } else {
        // Old format - equal split
        const splitAmount = totalAmount / (expense.payees.length || 1);
        balances[payee] = (balances[payee] || 0) - splitAmount;
      }
    }
  }

  // SUBTRACT resolved payments from balances (these payments already happened)
  // If B paid A ₹100 (resolved), then:
  // - B's balance increases by ₹100 (B paid out, so B is owed more / owes less)
  // - A's balance decreases by ₹100 (A received, so A is owed less / owes more)
  for (const payment of resolvedPayments) {
    balances[payment.from] = (balances[payment.from] || 0) + payment.amount;
    balances[payment.to] = (balances[payment.to] || 0) - payment.amount;
  }

  // Separate into creditors (owed money, positive) and debtors (owe money, negative)
  const creditors = []; // people who are owed money
  const debtors = [];   // people who owe money

  for (const [mailId, balance] of Object.entries(balances)) {
    const roundedBalance = Math.round(balance * 100) / 100;
    if (roundedBalance > 0.01) {
      creditors.push({ mailId, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ mailId, amount: Math.abs(roundedBalance) }); // convert to positive
    }
  }

  // Sort by amount descending for greedy algorithm
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Generate minimal transactions using greedy algorithm
  // Edge format: { from: 'a', to: 'b', amount: c, resolved: false } means 'a' pays 'b' amount 'c'
  // New edges are always unresolved - they represent pending payments
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
        amount: Math.round(amount * 100) / 100,  // 'c' (rounded to 2 decimals)
        resolved: false  // New edges are always unresolved
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  // Also keep the resolved payments in the consolidated list (for history/display)
  // They show what was already paid
  for (const payment of resolvedPayments) {
    consolidated.push({
      from: payment.from,
      to: payment.to,
      amount: payment.amount,
      resolved: true
    });
  }

  details.consolidatedExpenses = consolidated;
  this.compressedDetails = compressData(details);
};

/**
 * Mark a consolidated edge as resolved
 * @param {string} from - The payer's email
 * @param {string} to - The payee's email
 * @returns {boolean} - True if edge was found and updated
 */
GroupSchema.methods.markEdgeResolved = function(from, to) {
  const details = this.getDetails();
  let found = false;
  
  if (details.consolidatedExpenses) {
    details.consolidatedExpenses = details.consolidatedExpenses.map(edge => {
      if (edge.from === from && edge.to === to) {
        found = true;
        return { ...edge, resolved: true };
      }
      return edge;
    });
  }
  
  if (found) {
    this.compressedDetails = compressData(details);
    this.updatedAt = new Date();
  }
  
  return found;
};

/**
 * Check if all consolidated edges are resolved (no pending payments)
 * @returns {boolean}
 */
GroupSchema.methods.areAllEdgesResolved = function() {
  const details = this.getDetails();
  if (!details.consolidatedExpenses || details.consolidatedExpenses.length === 0) {
    return true; // No edges means all settled
  }
  // Check if there are any UNRESOLVED edges (pending payments)
  const unresolvedEdges = details.consolidatedExpenses.filter(edge => !edge.resolved);
  return unresolvedEdges.length === 0;
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
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Group', GroupSchema);
