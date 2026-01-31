const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

/**
 * Analysis Model
 * Stores expense analysis by category and month for each user
 * 
 * Categories (5 rows): food, travel, entertainment, shopping, others
 * Months (6 columns): Past 6 months starting from current month
 * 
 * Data structure stored in compressedData:
 * {
 *   months: ["2026-01", "2025-12", "2025-11", "2025-10", "2025-09", "2025-08"],
 *   categories: {
 *     food: [100, 200, 150, 300, 250, 180],          // amounts for each month
 *     travel: [50, 75, 0, 120, 80, 0],
 *     entertainment: [30, 45, 60, 25, 40, 55],
 *     shopping: [200, 150, 300, 100, 250, 175],
 *     others: [80, 90, 70, 60, 100, 50]
 *   }
 * }
 */

const CATEGORIES = ['food', 'travel', 'entertainment', 'shopping', 'others'];
const MONTHS_COUNT = 6;

const AnalysisSchema = new mongoose.Schema({
  // Primary key is the user's email
  _id: {
    type: String,
    required: true
  },

  // Compressed data containing months array and category amounts
  compressedData: {
    type: Buffer,
    required: true,
    default: () => compressData(getDefaultAnalysisData())
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Generate default analysis data with current 6 months
function getDefaultAnalysisData() {
  const months = [];
  const now = new Date();
  
  // Generate past 6 months starting from current month
  for (let i = 0; i < MONTHS_COUNT; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(formatMonth(date));
  }
  
  const categories = {};
  CATEGORIES.forEach(cat => {
    categories[cat] = new Array(MONTHS_COUNT).fill(0);
  });
  
  return { months, categories };
}

// Format date to "YYYY-MM" string
function formatMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Get current month in "YYYY-MM" format
function getCurrentMonth() {
  return formatMonth(new Date());
}

// Instance methods
AnalysisSchema.methods.getData = function() {
  if (!this.compressedData) return getDefaultAnalysisData();
  return decompressData(this.compressedData);
};

AnalysisSchema.methods.setData = function(data) {
  this.compressedData = compressData(data);
  this.updatedAt = new Date();
};

/**
 * Check if a month is stale (older than 6 months from current date)
 * @param {string} month - Month in "YYYY-MM" format
 * @returns {boolean} True if month is stale
 */
function isMonthStale(month) {
  const currentMonth = getCurrentMonth();
  const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
  const [checkYear, checkMonthNum] = month.split('-').map(Number);
  
  const currentTotal = currentYear * 12 + currentMonthNum;
  const checkTotal = checkYear * 12 + checkMonthNum;
  
  // Month is stale if it's more than 5 months behind current (6 month window: 0,1,2,3,4,5)
  return (currentTotal - checkTotal) >= MONTHS_COUNT;
}

/**
 * Ensure months are current (shift if needed)
 * Called before any query or update to ensure we're working with current months
 * 
 * This method:
 * 1. Checks the current date
 * 2. If oldest month is stale (>6 months old), removes it and its category values
 * 3. Adds new months at the beginning with zero values
 */
AnalysisSchema.methods.ensureCurrentMonths = function() {
  const data = this.getData();
  const currentMonth = getCurrentMonth();
  
  // If current month is already in the first position, no shift needed
  if (data.months[0] === currentMonth) {
    return data;
  }
  
  // Calculate how many months have passed since our data was last updated
  const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
  const [firstYear, firstMonthNum] = data.months[0].split('-').map(Number);
  
  const currentTotal = currentYear * 12 + currentMonthNum;
  const firstTotal = firstYear * 12 + firstMonthNum;
  const monthsToShift = currentTotal - firstTotal;
  
  if (monthsToShift > 0) {
    // Shift data: remove old months from end, add new months at beginning
    const shiftsNeeded = Math.min(monthsToShift, MONTHS_COUNT);
    
    // Log stale months being removed
    const staleMonths = data.months.slice(MONTHS_COUNT - shiftsNeeded);
    if (staleMonths.length > 0) {
      console.log(`📊 Analysis [${this._id}]: Removing ${staleMonths.length} stale month(s): ${staleMonths.join(', ')}`);
      
      // Log the amounts being removed for each category
      CATEGORIES.forEach(cat => {
        const removedAmounts = data.categories[cat].slice(MONTHS_COUNT - shiftsNeeded);
        const totalRemoved = removedAmounts.reduce((sum, val) => sum + val, 0);
        if (totalRemoved > 0) {
          console.log(`   └─ ${cat}: Removed ₹${totalRemoved.toFixed(2)} from stale months`);
        }
      });
    }
    
    // Generate new months to add at beginning
    const newMonths = [];
    for (let i = 0; i < shiftsNeeded; i++) {
      const date = new Date(currentYear, currentMonthNum - 1 - i, 1);
      newMonths.push(formatMonth(date));
    }
    
    // Shift months array - remove stale months from end, add new months at beginning
    data.months = [...newMonths, ...data.months.slice(0, MONTHS_COUNT - shiftsNeeded)];
    
    // Shift category amounts - add zeros for new months, remove stale month values
    CATEGORIES.forEach(cat => {
      const newAmounts = new Array(shiftsNeeded).fill(0);
      data.categories[cat] = [...newAmounts, ...data.categories[cat].slice(0, MONTHS_COUNT - shiftsNeeded)];
    });
    
    console.log(`📊 Analysis [${this._id}]: Updated months window to: ${data.months.join(', ')}`);
    
    // Save the updated data
    this.setData(data);
    this._staleDataRemoved = true; // Flag to indicate data was modified
  }
  
  return data;
};

/**
 * Check if any months in the data are stale and need cleanup
 * @returns {{ hasStale: boolean, staleMonths: string[], currentMonths: string[] }}
 */
AnalysisSchema.methods.checkForStaleMonths = function() {
  const data = this.getData();
  const staleMonths = [];
  const currentMonths = [];
  
  data.months.forEach(month => {
    if (isMonthStale(month)) {
      staleMonths.push(month);
    } else {
      currentMonths.push(month);
    }
  });
  
  return {
    hasStale: staleMonths.length > 0,
    staleMonths,
    currentMonths
  };
};

/**
 * Update amount for a specific category and month
 * @param {string} category - Category name (food, travel, entertainment, shopping, others)
 * @param {string} month - Month in "YYYY-MM" format
 * @param {number} amountDelta - Amount to add (can be negative for deletion)
 */
AnalysisSchema.methods.updateAmount = function(category, month, amountDelta) {
  // First ensure months are current
  const data = this.ensureCurrentMonths();
  
  // Validate category
  const categoryLower = category.toLowerCase();
  if (!CATEGORIES.includes(categoryLower)) {
    console.warn(`Invalid category: ${category}, defaulting to 'others'`);
    category = 'others';
  }
  
  // Find month index
  const monthIndex = data.months.indexOf(month);
  
  // If month is not in our 6-month window, ignore
  if (monthIndex === -1) {
    console.log(`Month ${month} is outside 6-month window, ignoring`);
    return false;
  }
  
  // Update the amount
  data.categories[categoryLower][monthIndex] = 
    Math.max(0, (data.categories[categoryLower][monthIndex] || 0) + amountDelta);
  
  // Round to 2 decimal places
  data.categories[categoryLower][monthIndex] = 
    Math.round(data.categories[categoryLower][monthIndex] * 100) / 100;
  
  this.setData(data);
  return true;
};

/**
 * Get analysis data in a format suitable for API response
 */
AnalysisSchema.methods.toJSON = function() {
  const data = this.ensureCurrentMonths();
  
  return {
    mailId: this._id,
    months: data.months,
    categories: data.categories,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static methods

/**
 * Find or create analysis document for a user
 */
AnalysisSchema.statics.findOrCreateByMailId = async function(mailId) {
  const normalizedMailId = mailId.toLowerCase().trim();
  
  let analysis = await this.findById(normalizedMailId);
  
  if (!analysis) {
    analysis = new this({
      _id: normalizedMailId,
      compressedData: compressData(getDefaultAnalysisData())
    });
    await analysis.save();
  }
  
  return analysis;
};

/**
 * Update analysis for multiple users (used when expense involves multiple payees)
 * @param {Array} userUpdates - Array of { mailId, category, month, amountDelta }
 */
AnalysisSchema.statics.bulkUpdateAnalysis = async function(userUpdates) {
  const results = [];
  
  for (const update of userUpdates) {
    try {
      const analysis = await this.findOrCreateByMailId(update.mailId);
      const success = analysis.updateAmount(update.category, update.month, update.amountDelta);
      
      if (success) {
        await analysis.save();
        results.push({ mailId: update.mailId, success: true });
      } else {
        results.push({ mailId: update.mailId, success: false, reason: 'Month out of range' });
      }
    } catch (error) {
      console.error(`Error updating analysis for ${update.mailId}:`, error);
      results.push({ mailId: update.mailId, success: false, reason: error.message });
    }
  }
  
  return results;
};

// Export constants for use in other modules
AnalysisSchema.statics.CATEGORIES = CATEGORIES;
AnalysisSchema.statics.MONTHS_COUNT = MONTHS_COUNT;
AnalysisSchema.statics.formatMonth = formatMonth;
AnalysisSchema.statics.getCurrentMonth = getCurrentMonth;

module.exports = mongoose.model('Analysis', AnalysisSchema);
