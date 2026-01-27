const mongoose = require('mongoose');

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
  details: {
    expenseName: String,
    expenseId: String,
    oldAmount: Number,
    newAmount: Number,
    changes: String // Human-readable description of changes
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

// Static method to add a history entry
EditHistorySchema.statics.addEntry = async function(data) {
  const entry = new this({
    groupId: data.groupId,
    groupName: data.groupName,
    action: data.action,
    actionBy: data.actionBy,
    actionByName: data.actionByName || data.actionBy.split('@')[0],
    details: data.details || {},
    createdAt: new Date()
  });
  return entry.save();
};

// Static method to get history for a group
EditHistorySchema.statics.getGroupHistory = async function(groupId, limit = 50) {
  return this.find({ groupId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get history for a user (across all groups)
EditHistorySchema.statics.getUserHistory = async function(userMailId, limit = 100) {
  return this.find({ actionBy: userMailId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get history for multiple groups
EditHistorySchema.statics.getHistoryForGroups = async function(groupIds, limit = 100) {
  return this.find({ groupId: { $in: groupIds } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('EditHistory', EditHistorySchema);
