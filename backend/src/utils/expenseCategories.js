/**
 * Expense Category Classification Utility
 * Uses Gemini AI to categorize expense titles into predefined categories
 * With caching to avoid repeated API calls
 * 
 * Categories: food, travel, entertainment, shopping, others
 */

const CategoryCache = require('../models/CategoryCache');

const CATEGORIES = ['food', 'travel', 'entertainment', 'shopping', 'others'];

// Keyword-based fallback categorization
const CATEGORY_KEYWORDS = {
  food: [
    'food', 'restaurant', 'cafe', 'coffee', 'tea', 'breakfast', 'lunch', 'dinner',
    'snack', 'pizza', 'burger', 'biryani', 'dosa', 'idli', 'meal', 'eat', 'drink',
    'beverage', 'juice', 'soda', 'beer', 'wine', 'alcohol', 'bar', 'pub', 'bakery',
    'cake', 'sweet', 'dessert', 'ice cream', 'chocolate', 'grocery', 'groceries',
    'vegetables', 'fruits', 'meat', 'chicken', 'fish', 'milk', 'bread', 'swiggy',
    'zomato', 'uber eats', 'dominos', 'mcdonalds', 'kfc', 'subway', 'starbucks',
    'chaayos', 'chai', 'maggi', 'noodles', 'pasta', 'rice', 'dal', 'curry',
    'thali', 'hotel', 'dhaba', 'canteen', 'mess', 'tiffin', 'parcel'
  ],
  travel: [
    'travel', 'trip', 'tour', 'flight', 'airline', 'airport', 'train', 'railway',
    'bus', 'metro', 'cab', 'taxi', 'uber', 'ola', 'rapido', 'auto', 'rickshaw',
    'petrol', 'diesel', 'fuel', 'gas', 'toll', 'parking', 'car', 'bike', 'vehicle',
    'transport', 'commute', 'ticket', 'booking', 'hotel room', 'hostel', 'airbnb',
    'oyo', 'makemytrip', 'goibibo', 'redbus', 'irctc', 'cleartrip', 'yatra',
    'luggage', 'passport', 'visa', 'vacation', 'holiday', 'getaway', 'road trip'
  ],
  entertainment: [
    'entertainment', 'movie', 'cinema', 'theatre', 'theater', 'film', 'show',
    'concert', 'music', 'party', 'club', 'disco', 'dance', 'event', 'festival',
    'game', 'gaming', 'playstation', 'xbox', 'steam', 'netflix', 'prime', 'hotstar',
    'disney', 'spotify', 'youtube', 'subscription', 'streaming', 'sports', 'match',
    'cricket', 'football', 'gym', 'fitness', 'yoga', 'spa', 'massage', 'salon',
    'haircut', 'grooming', 'book', 'magazine', 'newspaper', 'hobby', 'art',
    'museum', 'gallery', 'zoo', 'park', 'amusement', 'theme park', 'water park',
    'bookmyshow', 'paytm insider', 'pvr', 'inox', 'multiplex'
  ],
  shopping: [
    'shopping', 'shop', 'store', 'mall', 'market', 'purchase', 'buy', 'order',
    'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'snapdeal', 'nykaa',
    'clothes', 'clothing', 'dress', 'shirt', 'pant', 'jeans', 'shoes', 'footwear',
    'accessories', 'watch', 'bag', 'wallet', 'belt', 'jewelry', 'jewellery',
    'electronics', 'phone', 'mobile', 'laptop', 'computer', 'tablet', 'headphone',
    'earphone', 'charger', 'cable', 'appliance', 'furniture', 'home decor',
    'kitchen', 'utensils', 'bedding', 'curtains', 'cosmetics', 'makeup', 'skincare',
    'perfume', 'deodorant', 'medicine', 'pharmacy', 'medical', 'health', 'vitamin',
    'stationary', 'office supplies', 'gifts', 'presents', 'decathlon', 'ikea',
    'dmart', 'reliance', 'big bazaar', 'lifestyle', 'westside', 'pantaloons'
  ]
};

/**
 * Categorize expense using keyword matching (fast fallback)
 * @param {string} expenseTitle - The expense title/name
 * @returns {string} Category name
 */
function categorizeByKeywords(expenseTitle) {
  if (!expenseTitle) return 'others';
  
  const titleLower = expenseTitle.toLowerCase();
  
  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'others';
}

/**
 * Categorize expense using Gemini AI
 * @param {string} expenseTitle - The expense title/name
 * @returns {Promise<string>} Category name
 */
async function categorizeWithGemini(expenseTitle) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('Gemini API key not configured, using keyword fallback');
    return categorizeByKeywords(expenseTitle);
  }
  
  try {
    const prompt = `Categorize the following expense into exactly one of these categories: food, travel, entertainment, shopping, others.

Expense: "${expenseTitle}"

Rules:
- food: Restaurants, groceries, beverages, snacks, food delivery
- travel: Transportation, flights, hotels, fuel, cabs, tickets
- entertainment: Movies, subscriptions, games, sports, events, fitness
- shopping: Clothes, electronics, home items, online shopping, gifts
- others: Anything that doesn't fit above categories (bills, rent, utilities, services, etc.)

Reply with ONLY the category name in lowercase, nothing else.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 10,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status, response.statusText);
      return categorizeByKeywords(expenseTitle);
    }

    const data = await response.json();
    const categoryResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    
    // Validate the response is a valid category
    if (CATEGORIES.includes(categoryResult)) {
      return categoryResult;
    }
    
    // If Gemini returned an invalid category, try to extract it
    for (const cat of CATEGORIES) {
      if (categoryResult?.includes(cat)) {
        return cat;
      }
    }
    
    // Fall back to keyword-based categorization
    console.log(`Gemini returned invalid category: "${categoryResult}", using keyword fallback`);
    return categorizeByKeywords(expenseTitle);
    
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    return categorizeByKeywords(expenseTitle);
  }
}

/**
 * Main categorization function - checks cache first, then Gemini, falls back to keywords
 * @param {string} expenseTitle - The expense title/name
 * @param {boolean} useGemini - Whether to use Gemini AI (default: true)
 * @returns {Promise<string>} Category name
 */
async function categorizeExpense(expenseTitle, useGemini = true) {
  if (!expenseTitle || typeof expenseTitle !== 'string') {
    return 'others';
  }
  
  // Clean up the title
  const cleanTitle = expenseTitle.trim();
  
  if (!cleanTitle) {
    return 'others';
  }
  
  // Step 1: Check cache first
  try {
    const cachedCategory = await CategoryCache.getCategory(cleanTitle);
    if (cachedCategory) {
      return cachedCategory;
    }
  } catch (error) {
    console.error('Error checking category cache:', error.message);
    // Continue without cache
  }
  
  // Step 2: For short/simple titles, use keyword matching (faster)
  if (cleanTitle.length <= 15) {
    const keywordResult = categorizeByKeywords(cleanTitle);
    if (keywordResult !== 'others') {
      // Save to cache
      CategoryCache.setCategory(cleanTitle, keywordResult, 'keywords').catch(() => {});
      return keywordResult;
    }
  }
  
  // Step 3: Use Gemini for better categorization
  if (useGemini) {
    const geminiResult = await categorizeWithGemini(cleanTitle);
    // Save to cache (Gemini or keyword fallback)
    const source = geminiResult !== categorizeByKeywords(cleanTitle) ? 'gemini' : 'keywords';
    CategoryCache.setCategory(cleanTitle, geminiResult, source).catch(() => {});
    return geminiResult;
  }
  
  // Step 4: Final fallback to keywords
  const keywordResult = categorizeByKeywords(cleanTitle);
  CategoryCache.setCategory(cleanTitle, keywordResult, 'keywords').catch(() => {});
  return keywordResult;
}

/**
 * Batch categorize multiple expenses
 * @param {Array<string>} expenseTitles - Array of expense titles
 * @returns {Promise<Array<{title: string, category: string}>>}
 */
async function batchCategorize(expenseTitles) {
  const results = [];
  
  for (const title of expenseTitles) {
    const category = await categorizeExpense(title);
    results.push({ title, category });
  }
  
  return results;
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache stats
 */
async function getCacheStats() {
  try {
    return await CategoryCache.getStats();
  } catch (error) {
    console.error('Error getting cache stats:', error.message);
    return null;
  }
}

/**
 * Clear the category cache
 * @returns {Promise<number>} Number of entries cleared
 */
async function clearCache() {
  try {
    return await CategoryCache.clearCache();
  } catch (error) {
    console.error('Error clearing cache:', error.message);
    return 0;
  }
}

module.exports = {
  categorizeExpense,
  categorizeByKeywords,
  categorizeWithGemini,
  batchCategorize,
  getCacheStats,
  clearCache,
  CATEGORIES,
  CATEGORY_KEYWORDS
};
