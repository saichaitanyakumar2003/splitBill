const mongoose = require('mongoose');

// Edge schema: [payer_email, payee_email, amount]
// Represents: payer needs to pay payee the specified amount
const edgeSchema = new mongoose.Schema({
  payer: {
    type: String, // mailId of the person who owes money
    required: true,
  },
  payee: {
    type: String, // mailId of the person who is owed money
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const groupSchema = new mongoose.Schema({
  // Group name
  name: {
    type: String,
    required: true,
    trim: true,
  },
  
  // Group description
  description: {
    type: String,
    default: '',
  },
  
  // Whether the group is active
  active: {
    type: Boolean,
    default: true,
  },
  
  // List of edges representing debts
  // Each edge is [payer_email, payee_email, amount]
  edges: {
    type: [edgeSchema],
    default: [],
  },
  
  // Members of the group (list of email IDs)
  members: {
    type: [String],
    default: [],
  },
  
  // Creator of the group
  created_by: {
    type: String, // mailId of creator
    required: true,
  },
  
  // Creation timestamp
  created_at: {
    type: Date,
    default: Date.now,
  },
  
  // Last updated timestamp
  updated_at: {
    type: Date,
    default: Date.now,
  },
  
  // TTL - Time to live
  // Active groups: 3 months (90 days)
  // Inactive groups: deleted immediately (1 second)
  expires_at: {
    type: Date,
    default: function() {
      // Default: 3 months from now for active groups
      const threeMonths = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
      return new Date(Date.now() + threeMonths);
    },
    index: { expires: 0 }, // MongoDB TTL index
  },
});

// Update TTL when active status changes
groupSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  if (this.isModified('active')) {
    if (this.active) {
      // Active: set TTL to 3 months from now
      const threeMonths = 90 * 24 * 60 * 60 * 1000;
      this.expires_at = new Date(Date.now() + threeMonths);
    } else {
      // Inactive: set TTL to 1 second from now (delete immediately)
      this.expires_at = new Date(Date.now() + 1000);
    }
  }
  
  next();
});

// Method to extend TTL (reset to 3 months)
groupSchema.methods.extendTTL = function() {
  const threeMonths = 90 * 24 * 60 * 60 * 1000;
  this.expires_at = new Date(Date.now() + threeMonths);
  return this.save();
};

// Method to add an edge (debt)
groupSchema.methods.addEdge = function(payer, payee, amount) {
  // Check if edge already exists
  const existingEdge = this.edges.find(
    e => e.payer === payer && e.payee === payee
  );
  
  if (existingEdge) {
    existingEdge.amount += amount;
  } else {
    this.edges.push({ payer, payee, amount });
  }
  
  return this.save();
};

// Method to simplify edges (reduce transactions)
groupSchema.methods.simplifyEdges = function() {
  // Calculate net balance for each person
  const balances = {};
  
  for (const edge of this.edges) {
    balances[edge.payer] = (balances[edge.payer] || 0) - edge.amount;
    balances[edge.payee] = (balances[edge.payee] || 0) + edge.amount;
  }
  
  // Separate into creditors and debtors
  const creditors = [];
  const debtors = [];
  
  for (const [person, balance] of Object.entries(balances)) {
    if (balance > 0.01) {
      creditors.push({ person, amount: balance });
    } else if (balance < -0.01) {
      debtors.push({ person, amount: -balance });
    }
  }
  
  // Sort by amount (descending)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  // Create simplified edges
  const newEdges = [];
  let i = 0, j = 0;
  
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);
    
    if (amount > 0.01) {
      newEdges.push({
        payer: debtor.person,
        payee: creditor.person,
        amount: Math.round(amount * 100) / 100,
      });
    }
    
    debtor.amount -= amount;
    creditor.amount -= amount;
    
    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }
  
  this.edges = newEdges;
  return this.save();
};

// Index for faster queries
groupSchema.index({ members: 1 });
groupSchema.index({ created_by: 1 });
groupSchema.index({ active: 1 });

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;

