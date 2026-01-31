const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

/**
 * CategoryCache Model
 * Caches expense title -> category mappings to avoid repeated Gemini API calls
 * 
 * Similar to how image scanning results are cached, this caches categorization results
 * Uses compression for consistency with other models
 */

const CategoryCacheSchema = new mongoose.Schema({
  // Primary key is the normalized expense title (lowercase, trimmed)
  _id: {
    type: String,
    required: true
  },

  // Compressed data containing originalTitle, category, source, hitCount
  compressedData: {
    type: Buffer,
    required: true
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Helper to create default data
function createCacheData(originalTitle, category, source = 'gemini', hitCount = 1) {
  return {
    originalTitle,
    category,
    source,
    hitCount
  };
}

// Instance methods
CategoryCacheSchema.methods.getData = function() {
  if (!this.compressedData) return null;
  return decompressData(this.compressedData);
};

CategoryCacheSchema.methods.setData = function(data) {
  this.compressedData = compressData(data);
  this.updatedAt = new Date();
};

CategoryCacheSchema.methods.incrementHitCount = function() {
  const data = this.getData();
  if (data) {
    data.hitCount = (data.hitCount || 0) + 1;
    this.setData(data);
  }
};

CategoryCacheSchema.methods.toJSON = function() {
  const data = this.getData();
  return {
    normalizedTitle: this._id,
    originalTitle: data?.originalTitle,
    category: data?.category,
    source: data?.source,
    hitCount: data?.hitCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/**
 * Normalize a title for use as cache key
 * @param {string} title - The expense title
 * @returns {string} Normalized title
 */
function normalizeTitle(title) {
  if (!title) return '';
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get category from cache
 * @param {string} title - The expense title
 * @returns {Promise<string|null>} Category if found, null otherwise
 */
CategoryCacheSchema.statics.getCategory = async function(title) {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return null;
  
  const cached = await this.findById(normalizedTitle);
  
  if (cached) {
    const data = cached.getData();
    if (data && data.category) {
      // Increment hit count (async, don't wait)
      cached.incrementHitCount();
      cached.save().catch(() => {});
      
      console.log(`📦 CategoryCache: Hit for "${title}" → ${data.category}`);
      return data.category;
    }
  }
  
  return null;
};

/**
 * Save category to cache
 * @param {string} title - The expense title
 * @param {string} category - The category
 * @param {string} source - Source of categorization ('gemini', 'keywords', 'manual')
 */
CategoryCacheSchema.statics.setCategory = async function(title, category, source = 'gemini') {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return;
  
  try {
    // Check if exists
    let cached = await this.findById(normalizedTitle);
    
    if (cached) {
      // Update existing
      const data = cached.getData();
      data.category = category;
      data.source = source;
      cached.setData(data);
      await cached.save();
    } else {
      // Create new
      cached = new this({
        _id: normalizedTitle,
        compressedData: compressData(createCacheData(title, category, source, 1))
      });
      await cached.save();
    }
    
    console.log(`💾 CategoryCache: Saved "${title}" → ${category} (${source})`);
  } catch (error) {
    console.error('Error saving to category cache:', error.message);
  }
};

/**
 * Get cache statistics
 */
CategoryCacheSchema.statics.getStats = async function() {
  const allEntries = await this.find({});
  
  const stats = {
    totalCached: allEntries.length,
    byCategory: {},
    bySource: {},
    totalHits: 0
  };
  
  // Process each entry to get stats from compressed data
  for (const entry of allEntries) {
    const data = entry.getData();
    if (data) {
      // By category
      if (!stats.byCategory[data.category]) {
        stats.byCategory[data.category] = { count: 0, totalHits: 0 };
      }
      stats.byCategory[data.category].count++;
      stats.byCategory[data.category].totalHits += data.hitCount || 0;
      
      // By source
      if (!stats.bySource[data.source]) {
        stats.bySource[data.source] = 0;
      }
      stats.bySource[data.source]++;
      
      stats.totalHits += data.hitCount || 0;
    }
  }
  
  return stats;
};

/**
 * Clear all cache entries (for testing)
 */
CategoryCacheSchema.statics.clearCache = async function() {
  const result = await this.deleteMany({});
  console.log(`🗑️ CategoryCache: Cleared ${result.deletedCount} entries`);
  return result.deletedCount;
};

// Export the normalize function for external use
CategoryCacheSchema.statics.normalizeTitle = normalizeTitle;

module.exports = mongoose.model('CategoryCache', CategoryCacheSchema);
