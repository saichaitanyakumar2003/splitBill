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
  return details.expenses || [];
};

GroupSchema.methods.hasExpenseWithName = function(name) {
  const details = this.getDetails();
  const normalizedName = name.toLowerCase().trim();
  return details.expenses.some(e => e.name.toLowerCase().trim() === normalizedName);
};

GroupSchema.methods.addExpense = function(expense) {
  const details = this.getDetails();
  
  // Check for unique expense name
  const normalizedName = expense.name.toLowerCase().trim();
  const existingNames = details.expenses.map(e => e.name.toLowerCase().trim());
  
  let finalName = expense.name;
  if (existingNames.includes(normalizedName)) {
    // Generate unique name by appending a number
    let counter = 2;
    while (existingNames.includes(`${normalizedName} (${counter})`)) {
      counter++;
    }
    finalName = `${expense.name} (${counter})`;
  }
  
  details.expenses.push({
    id: new mongoose.Types.ObjectId().toString(),
    name: finalName,
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
  details.expenses = details.expenses.filter(e => e.id !== expenseId);
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
  return {
    id: this._id,
    name: this.name,
    status: this.status,
    expenses: details.expenses,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Group', GroupSchema);
