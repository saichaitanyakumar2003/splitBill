const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

const HistorySchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  
  groupId: {
    type: String,
    required: true,
    index: true
  },
  
  // Compressed storage for groupName and settledEdges
  compressedData: {
    type: Buffer,
    required: true,
    default: () => compressData({ groupName: '', settledEdges: [] })
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

// Get data from compressed storage
HistorySchema.methods.getData = function() {
  if (!this.compressedData) return { groupName: '', settledEdges: [] };
  return decompressData(this.compressedData);
};

// Getters for compatibility
HistorySchema.virtual('groupName').get(function() {
  return this.getData().groupName || '';
});

HistorySchema.virtual('settledEdges').get(function() {
  return this.getData().settledEdges || [];
});

// Methods
HistorySchema.methods.setData = function(data) {
  const currentData = this.getData();
  this.compressedData = compressData({
    groupName: data.groupName !== undefined ? data.groupName : currentData.groupName,
    settledEdges: data.settledEdges !== undefined ? data.settledEdges : currentData.settledEdges
  });
  this.updatedAt = new Date();
};

HistorySchema.methods.addSettledEdge = function(edge) {
  const data = this.getData();
  data.settledEdges.push({
    from: edge.from.toLowerCase().trim(),
    to: edge.to.toLowerCase().trim(),
    amount: Math.round(edge.amount * 100) / 100,
    settledAt: new Date().toISOString()
  });
  this.compressedData = compressData(data);
  this.updatedAt = new Date();
};

HistorySchema.methods.setTTL = function(days = 7) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  this.expiresAt = expiryDate;
  this.updatedAt = new Date();
};

HistorySchema.methods.toJSON = function() {
  const data = this.getData();
  return {
    id: this._id,
    groupId: this.groupId,
    groupName: data.groupName,
    settledEdges: data.settledEdges,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to find or create by groupId
HistorySchema.statics.findOrCreateByGroupId = async function(groupId, groupName) {
  let doc = await this.findOne({ groupId });
  if (!doc) {
    const { v4: uuidv4 } = require('uuid');
    doc = new this({
      _id: uuidv4(),
      groupId,
      compressedData: compressData({ groupName, settledEdges: [] })
    });
    await doc.save();
  }
  return doc;
};

// Static method to get history for multiple group IDs
HistorySchema.statics.findByGroupIds = async function(groupIds) {
  return this.find({ groupId: { $in: groupIds } }).sort({ updatedAt: -1 });
};

module.exports = mongoose.model('History', HistorySchema);
