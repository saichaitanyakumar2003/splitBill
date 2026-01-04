const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

const GroupSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },

  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    unique: true
  },

  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },

  compressedDetails: {
    type: Buffer,
    required: true,
    default: () => compressData({ expenses: [], consolidatedExpenses: [] })
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

GroupSchema.methods.getDetails = function() {
  if (!this.compressedDetails) return { expenses: [], consolidatedExpenses: [] };
  return decompressData(this.compressedDetails);
};

GroupSchema.methods.setDetails = function(details) {
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
};

GroupSchema.methods.addExpense = function(expense) {
  const details = this.getDetails();
  
  details.expenses.push({
    id: new mongoose.Types.ObjectId().toString(),
    name: expense.name,
    payer: expense.payer.toLowerCase().trim(),
    payees: (expense.payees || []).map(p => p.toLowerCase().trim()),
    amount: parseFloat(expense.amount),
    createdAt: new Date().toISOString()
  });
  
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
  
  this.recalculateConsolidated();
};

GroupSchema.methods.removeExpense = function(expenseId) {
  const details = this.getDetails();
  details.expenses = details.expenses.filter(e => e.id !== expenseId);
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
  this.recalculateConsolidated();
};

GroupSchema.methods.recalculateConsolidated = function() {
  const details = this.getDetails();
  const balances = {};

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

  for (const expense of details.expenses) {
    const payer = expense.payer;
    const totalAmount = expense.totalAmount || expense.amount;
    
    balances[payer] = (balances[payer] || 0) + totalAmount;
    
    for (const payee of (expense.payees || [])) {
      if (typeof payee === 'object') {
        balances[payee.mailId] = (balances[payee.mailId] || 0) - payee.amount;
      } else {
        const splitAmount = totalAmount / (expense.payees.length || 1);
        balances[payee] = (balances[payee] || 0) - splitAmount;
      }
    }
  }

  for (const payment of resolvedPayments) {
    balances[payment.from] = (balances[payment.from] || 0) + payment.amount;
    balances[payment.to] = (balances[payment.to] || 0) - payment.amount;
  }

  const creditors = [];
  const debtors = [];

  for (const [mailId, balance] of Object.entries(balances)) {
    const roundedBalance = Math.round(balance * 100) / 100;
    if (roundedBalance > 0.01) {
      creditors.push({ mailId, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ mailId, amount: Math.abs(roundedBalance) });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const consolidated = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      consolidated.push({
        from: debtor.mailId,
        to: creditor.mailId,
        amount: Math.round(amount * 100) / 100,
        resolved: false
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

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

GroupSchema.methods.areAllEdgesResolved = function() {
  const details = this.getDetails();
  if (!details.consolidatedExpenses || details.consolidatedExpenses.length === 0) {
    return true;
  }
  const unresolvedEdges = details.consolidatedExpenses.filter(edge => !edge.resolved);
  return unresolvedEdges.length === 0;
};

GroupSchema.methods.getSettlements = function() {
  const details = this.getDetails();
  return details.consolidatedExpenses;
};

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
