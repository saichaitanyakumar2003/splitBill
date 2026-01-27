const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

const EditHistorySchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true,
    index: true
  },
  groupName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['add_expense', 'edit_expense', 'delete_expense', 'delete_group'],
    required: true
  },
  actionBy: {
    type: String, // mailId of the user who performed the action
    required: true
  },
  actionByName: {
    type: String, // Name of the user
    default: ''
  },
  // Compressed details - stores expenseName, expenseId, oldAmount, newAmount, changes
  compressedDetails: {
    type: Buffer,
    default: null
  },
  // Legacy uncompressed details (for backward compatibility during migration)
  details: {
    type: mongoose.Schema.Types.Mixed,
    select: false // Don't include in queries by default
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient queries
EditHistorySchema.index({ groupId: 1, createdAt: -1 });
EditHistorySchema.index({ actionBy: 1, createdAt: -1 });

// Method to get decompressed details
EditHistorySchema.methods.getDetails = function() {
  if (this.compressedDetails) {
    try {
      return decompressData(this.compressedDetails);
    } catch (e) {
      console.error('Error decompressing edit history details:', e);
      return {};
    }
  }
  // Fallback to legacy uncompressed details
  return this.details || {};
};

// Method to set compressed details
EditHistorySchema.methods.setDetails = function(details) {
  this.compressedDetails = compressData(details || {});
  this.details = undefined; // Clear legacy field
};

// Transform for JSON output
EditHistorySchema.methods.toJSON = function() {
  return {
    _id: this._id,
    groupId: this.groupId,
    groupName: this.groupName,
    action: this.action,
    actionBy: this.actionBy,
    actionByName: this.actionByName,
    details: this.getDetails(),
    createdAt: this.createdAt
  };
};

// Static method to add a history entry
EditHistorySchema.statics.addEntry = async function(data) {
  const entry = new this({
    groupId: data.groupId,
    groupName: data.groupName,
    action: data.action,
    actionBy: data.actionBy,
    actionByName: data.actionByName || data.actionBy.split('@')[0],
    createdAt: new Date()
  });
  
  // Set compressed details
  entry.setDetails(data.details || {});
  
  return entry.save();
};

// Static method to get history for a group
EditHistorySchema.statics.getGroupHistory = async function(groupId, limit = 50) {
  const entries = await this.find({ groupId })
    .sort({ createdAt: -1 })
    .limit(limit);
  
  // Return with decompressed details
  return entries.map(entry => entry.toJSON());
};

// Static method to get history for a user (across all groups)
EditHistorySchema.statics.getUserHistory = async function(userMailId, limit = 100) {
  const entries = await this.find({ actionBy: userMailId })
    .sort({ createdAt: -1 })
    .limit(limit);
  
  return entries.map(entry => entry.toJSON());
};

// Static method to get history for multiple groups
EditHistorySchema.statics.getHistoryForGroups = async function(groupIds, limit = 100) {
  const entries = await this.find({ groupId: { $in: groupIds } })
    .sort({ createdAt: -1 })
    .limit(limit);
  
  return entries.map(entry => entry.toJSON());
};

// Static method to migrate uncompressed records to compressed
EditHistorySchema.statics.migrateToCompressed = async function() {
  const cursor = this.find({ 
    compressedDetails: null,
    details: { $exists: true, $ne: null }
  }).select('+details').cursor();
  
  let migrated = 0;
  let errors = 0;
  
  for await (const doc of cursor) {
    try {
      if (doc.details && Object.keys(doc.details).length > 0) {
        doc.setDetails(doc.details);
        await doc.save();
        migrated++;
      }
    } catch (e) {
      console.error(`Error migrating edit history ${doc._id}:`, e);
      errors++;
    }
  }
  
  return { migrated, errors };
};

module.exports = mongoose.model('EditHistory', EditHistorySchema);
