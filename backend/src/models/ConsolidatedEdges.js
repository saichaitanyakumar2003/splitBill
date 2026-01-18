const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

const ConsolidatedEdgesSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  
  groupId: {
    type: String,
    required: true,
    index: true
  },
  
  // Compressed storage for edges array
  compressedData: {
    type: Buffer,
    required: true,
    default: () => compressData({ edges: [] })
  },
  
  // TTL - document will be deleted after this date
  // Set when group is marked as completed
  expiresAt: {
    type: Date,
    default: null,
    index: { expires: 0 } // TTL index - MongoDB will delete when current time > expiresAt
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Get edges from compressed data
ConsolidatedEdgesSchema.methods.getEdges = function() {
  if (!this.compressedData) return [];
  const data = decompressData(this.compressedData);
  return data.edges || [];
};

// Getter for edges (for compatibility)
ConsolidatedEdgesSchema.virtual('edges').get(function() {
  return this.getEdges();
});

// Methods
ConsolidatedEdgesSchema.methods.setEdges = function(edges) {
  const formattedEdges = edges.map(e => ({
    from: e.from.toLowerCase().trim(),
    to: e.to.toLowerCase().trim(),
    amount: Math.round(e.amount * 100) / 100,
    resolved: e.resolved || false
  }));
  this.compressedData = compressData({ edges: formattedEdges });
  this.updatedAt = new Date();
};

ConsolidatedEdgesSchema.methods.markResolved = function(from, to) {
  const edges = this.getEdges();
  let found = false;
  
  const updatedEdges = edges.map(edge => {
    if (edge.from === from && edge.to === to && !edge.resolved) {
      found = true;
      return { ...edge, resolved: true };
    }
    return edge;
  });
  
  if (found) {
    this.compressedData = compressData({ edges: updatedEdges });
    this.updatedAt = new Date();
  }
  return found;
};

ConsolidatedEdgesSchema.methods.getPendingEdges = function() {
  return this.getEdges().filter(e => !e.resolved);
};

ConsolidatedEdgesSchema.methods.getResolvedEdges = function() {
  return this.getEdges().filter(e => e.resolved);
};

ConsolidatedEdgesSchema.methods.areAllResolved = function() {
  const edges = this.getEdges();
  return edges.length === 0 || edges.every(e => e.resolved);
};

ConsolidatedEdgesSchema.methods.setTTL = function(days = 7) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  this.expiresAt = expiryDate;
  this.updatedAt = new Date();
};

ConsolidatedEdgesSchema.methods.toJSON = function() {
  return {
    id: this._id,
    groupId: this.groupId,
    edges: this.getEdges(),
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to find or create by groupId
ConsolidatedEdgesSchema.statics.findOrCreateByGroupId = async function(groupId) {
  let doc = await this.findOne({ groupId });
  if (!doc) {
    const { v4: uuidv4 } = require('uuid');
    doc = new this({
      _id: uuidv4(),
      groupId,
      compressedData: compressData({ edges: [] })
    });
    await doc.save();
  }
  return doc;
};

module.exports = mongoose.model('ConsolidatedEdges', ConsolidatedEdgesSchema);
