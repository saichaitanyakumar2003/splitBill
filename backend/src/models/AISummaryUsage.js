/**
 * AI Summary Usage Model
 * Tracks daily usage of AI summary feature per user
 * Limits users to 2 AI summary calls per day
 */

const mongoose = require('mongoose');

const AISummaryUsageSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  }, // Format: "mailId:YYYY-MM-DD"
  mailId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true
  }, // Format: "YYYY-MM-DD"
  callCount: {
    type: Number,
    default: 0
  },
  lastCallAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Daily limit
const DAILY_LIMIT = 2;

/**
 * Get today's date string
 */
function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

/**
 * Generate document ID
 */
function getDocId(mailId, date) {
  return `${mailId.toLowerCase().trim()}:${date}`;
}

/**
 * Check if user can make an AI summary call today
 * @param {string} mailId - User's email
 * @returns {Promise<{canCall: boolean, remaining: number, resetAt: string}>}
 */
AISummaryUsageSchema.statics.canMakeCall = async function(mailId) {
  const today = getTodayString();
  const docId = getDocId(mailId, today);
  
  const usage = await this.findById(docId);
  const currentCount = usage?.callCount || 0;
  const remaining = Math.max(0, DAILY_LIMIT - currentCount);
  
  // Calculate reset time (midnight UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  return {
    canCall: currentCount < DAILY_LIMIT,
    remaining,
    used: currentCount,
    limit: DAILY_LIMIT,
    resetAt: tomorrow.toISOString()
  };
};

/**
 * Record an AI summary call
 * @param {string} mailId - User's email
 * @returns {Promise<{success: boolean, remaining: number}>}
 */
AISummaryUsageSchema.statics.recordCall = async function(mailId) {
  const today = getTodayString();
  const docId = getDocId(mailId, today);
  
  const result = await this.findByIdAndUpdate(
    docId,
    {
      $setOnInsert: {
        mailId: mailId.toLowerCase().trim(),
        date: today,
        createdAt: new Date()
      },
      $inc: { callCount: 1 },
      $set: { lastCallAt: new Date() }
    },
    { upsert: true, new: true }
  );
  
  const remaining = Math.max(0, DAILY_LIMIT - result.callCount);
  
  return {
    success: result.callCount <= DAILY_LIMIT,
    remaining,
    used: result.callCount,
    limit: DAILY_LIMIT
  };
};

/**
 * Get usage stats for a user
 * @param {string} mailId - User's email
 * @returns {Promise<Object>}
 */
AISummaryUsageSchema.statics.getUsageStats = async function(mailId) {
  const today = getTodayString();
  const docId = getDocId(mailId, today);
  
  const usage = await this.findById(docId);
  
  // Calculate reset time
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  return {
    used: usage?.callCount || 0,
    remaining: Math.max(0, DAILY_LIMIT - (usage?.callCount || 0)),
    limit: DAILY_LIMIT,
    lastCallAt: usage?.lastCallAt || null,
    resetAt: tomorrow.toISOString()
  };
};

// Clean up old usage records (older than 7 days)
AISummaryUsageSchema.statics.cleanupOldRecords = async function() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
  
  const result = await this.deleteMany({ date: { $lt: cutoffDate } });
  return result.deletedCount;
};

const AISummaryUsage = mongoose.model('AISummaryUsage', AISummaryUsageSchema);

module.exports = AISummaryUsage;
