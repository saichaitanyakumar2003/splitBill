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
    enum: ['active', 'completed', 'deleted'],
    default: 'active'
  },

  compressedDetails: {
    type: Buffer,
    required: true,
    default: () => compressData({ expenses: [] })
  },

  // TTL - document will be deleted after this date
  // Set when group is marked as completed (7 days after completion)
  expiresAt: {
    type: Date,
    default: null,
    index: { expires: 0 } // TTL index
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

GroupSchema.methods.getDetails = function() {
  if (!this.compressedDetails) return { expenses: [] };
  const data = decompressData(this.compressedDetails);
  // Remove consolidatedExpenses if it exists (legacy data)
  return { expenses: data.expenses || [] };
};

GroupSchema.methods.setDetails = function(details) {
  // Only store expenses, not consolidatedExpenses
  this.compressedDetails = compressData({ expenses: details.expenses || [] });
  this.updatedAt = new Date();
};

GroupSchema.methods.getExpenses = function() {
  const details = this.getDetails();
  // Ensure all expenses have an id (for backwards compatibility with old data)
  return (details.expenses || []).map((expense, index) => {
    if (!expense.id && !expense._id) {
      return { ...expense, id: `exp_${index}_${(expense.name || 'unknown').replace(/\s+/g, '_').substring(0, 20)}` };
    }
    return expense;
  });
};

GroupSchema.methods.addExpense = function(expense) {
  const details = this.getDetails();
  
  // Allow duplicate expense names - show them separately
  details.expenses.push({
    id: new mongoose.Types.ObjectId().toString(),
    name: expense.name.trim(),
    payer: expense.payer.toLowerCase().trim(),
    payees: (expense.payees || []).map(p => 
      typeof p === 'object' ? p : p.toLowerCase().trim()
    ),
    amount: parseFloat(expense.amount),
    totalAmount: expense.totalAmount || parseFloat(expense.amount),
    createdAt: new Date().toISOString()
  });
  
  this.compressedDetails = compressData({ expenses: details.expenses });
  this.updatedAt = new Date();
};

GroupSchema.methods.removeExpense = function(expenseId) {
  const details = this.getDetails();
  // Generate IDs for comparison (same logic as getExpenses)
  const expensesWithIds = (details.expenses || []).map((expense, index) => {
    if (!expense.id && !expense._id) {
      return { ...expense, id: `exp_${index}_${(expense.name || 'unknown').replace(/\s+/g, '_').substring(0, 20)}` };
    }
    return expense;
  });
  
  // Find index to remove
  const indexToRemove = expensesWithIds.findIndex(e => (e.id === expenseId) || (e._id === expenseId));
  
  if (indexToRemove !== -1) {
    details.expenses.splice(indexToRemove, 1);
  }
  
  this.compressedDetails = compressData({ expenses: details.expenses });
  this.updatedAt = new Date();
};

GroupSchema.methods.setTTL = function(days = 7) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  this.expiresAt = expiryDate;
  this.updatedAt = new Date();
};

// Mark group as deleted with 7-day TTL
GroupSchema.methods.markDeleted = function() {
  this.status = 'deleted';
  this.setTTL(7);
};

GroupSchema.methods.toJSON = function() {
  const details = this.getDetails();
  // Ensure all expenses have an id (for backwards compatibility with old data)
  const expensesWithIds = (details.expenses || []).map((expense, index) => {
    if (!expense.id && !expense._id) {
      // Generate a consistent ID based on index and expense name
      return { ...expense, id: `exp_${index}_${(expense.name || 'unknown').replace(/\s+/g, '_').substring(0, 20)}` };
    }
    return expense;
  });
  return {
    id: this._id,
    name: this.name,
    status: this.status,
    expenses: expensesWithIds,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Group', GroupSchema);
