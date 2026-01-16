/**
 * OpenRouter OCR - Uses FREE vision models
 * Get API key from: https://openrouter.ai/keys
 * FREE models with vision support!
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Free vision models - Nvidia → Qwen → Google
const FREE_VISION_MODELS = [
  'nvidia/nemotron-nano-12b-v2-vl:free',     // Primary - Nvidia
  'qwen/qwen-2.5-vl-7b-instruct:free',       // Fallback 1 - Qwen
  'google/gemma-3-27b-it:free',              // Fallback 2 - Google
];

// Image optimization settings - aggressive for speed
const MAX_IMAGE_DIMENSION = 640; // Smaller for faster upload
const JPEG_QUALITY = 50; // More compression
const MODEL_TIMEOUT_MS = 60000; // 60 second timeout per model

/**
 * Compress and optimize image for faster API processing
 */
async function optimizeImage(imagePath) {
  const originalSize = fs.statSync(imagePath).size;
  
  // Resize and compress to JPEG
  const optimizedBuffer = await sharp(imagePath)
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  
  const newSize = optimizedBuffer.length;
  const savings = Math.round((1 - newSize / originalSize) * 100);
  console.log(`📦 Image optimized: ${Math.round(originalSize/1024)}KB → ${Math.round(newSize/1024)}KB (${savings}% smaller)`);
  
  return optimizedBuffer;
}

/**
 * Extract bill data from image using OpenRouter free vision models
 */
async function extractBillWithOpenRouter(imagePath) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured. Get free key from https://openrouter.ai/keys');
  }

  // Optimize image for faster processing
  const optimizedBuffer = await optimizeImage(imagePath);
  const base64Image = optimizedBuffer.toString('base64');
  const mimeType = 'image/jpeg'; // Always JPEG after optimization

  // Simplified prompt - just extract raw data, backend handles categorization
  const prompt = `Extract bill data as JSON. Return ONLY valid JSON (no markdown): {"merchantName":"shop name or null","date":"DD/MM/YYYY or null","items":[{"name":"item name","qty":1,"rate":100,"amt":100}],"subtotal":500,"taxes":[{"name":"CGST","amount":25}],"total":550}. Rules: 1) Skip text-only lines without qty/price. 2) Only include taxes if printed on bill. 3) Read actual qty from Qty column.`;

  const startTime = Date.now();
  console.log(`🚀 Calling models sequentially: qwen → nvidia → google (${MODEL_TIMEOUT_MS/1000}s timeout each)`);

  // Create API call function for a single model with timeout
  const callModelWithTimeout = async (model) => {
    const modelStart = Date.now();
    console.log(`📡 Trying ${model}...`);
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`TIMEOUT`)), MODEL_TIMEOUT_MS);
    });
    
    // Create API call promise
    const apiPromise = (async () => {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://splitbill.app',
          'X-Title': 'SplitBill OCR'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { 
                  type: 'image_url', 
                  image_url: { 
                    url: `data:${mimeType};base64,${base64Image}` 
                  } 
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const textResponse = data.choices?.[0]?.message?.content;

      if (!textResponse) {
        throw new Error('No response content');
      }

      // Parse JSON response
      let jsonStr = textResponse.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const billData = JSON.parse(jsonStr);
      return billData;
    })();

    // Race API call against timeout
    const billData = await Promise.race([apiPromise, timeoutPromise]);
    
    const elapsed = ((Date.now() - modelStart) / 1000).toFixed(1);
    console.log(`✅ ${model} responded in ${elapsed}s`);
    
    return { billData, model };
  };

  // Try models sequentially
  let lastError = null;
  
  for (const model of FREE_VISION_MODELS) {
    try {
      const result = await callModelWithTimeout(model);
      
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🏆 Success with ${model} (total: ${totalElapsed}s)`);
      
      console.log('📋 OCR Raw Response:', JSON.stringify({
        subtotal: result.billData.subtotal,
        total: result.billData.total,
        itemPrices: result.billData.items?.map(i => ({ name: i.name, unitPrice: i.unitPrice, totalPrice: i.totalPrice, category: i.category }))
      }, null, 2));

      return transformResponse(result.billData, result.model);
      
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`❌ ${model} failed (${elapsed}s): ${err.message}`);
      lastError = err;
      // Continue to next model
    }
  }

  // All models failed
  throw new Error(`All AI models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Validate and fix items based on total amount
 * Removes duplicate/continuation items if sum exceeds total
 */
function validateAndFixItems(items, expectedSubtotal, expectedTotal, taxes, expectedQty) {
  if (!items || items.length === 0) return items;
  
  const totalTax = (taxes || []).reduce((sum, t) => sum + (t.amount || 0), 0);
  
  // Calculate current sum (totalPrice is already unitPrice × quantity)
  const currentSum = items.reduce((sum, item) => {
    return sum + (item.totalPrice || item.unitPrice || 0);
  }, 0);
  
  // Calculate current total quantity
  const currentQty = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  
  const expectedAmount = expectedSubtotal || (expectedTotal - totalTax) || currentSum;
  const excessAmount = currentSum - expectedAmount;
  
  console.log(`📊 Validation: Items sum=₹${currentSum}, Expected=₹${expectedAmount}, Qty=${currentQty}/${expectedQty || '?'}`);
  
  // If sum matches expected (within ₹1 tolerance), no fix needed
  if (Math.abs(excessAmount) < 1) {
    console.log('✅ Validation passed: amounts match');
    return items;
  }
  
  // If sum exceeds expected, find and remove the excess items
  if (excessAmount > 0) {
    console.log(`⚠️ Sum exceeds expected by ₹${excessAmount}. Looking for items to remove...`);
    
    // Single-word food suffixes that are likely continuations
    const continuationWords = new Set([
      'biryani', 'rice', 'curry', 'fry', 'gravy', 'masala', 'tikka', 
      'kebab', 'korma', 'roast', 'manchurian', 'noodles', 'pulao', 
      'dal', 'roti', 'naan', 'paratha', 'thali', 'meal'
    ]);
    
    // Get price counts to find duplicates
    const priceCount = {};
    items.forEach(item => {
      const price = item.totalPrice || item.unitPrice;
      priceCount[price] = (priceCount[price] || 0) + 1;
    });
    
    // Find candidates for removal (single-word continuations with duplicate prices)
    const candidates = items.map((item, index) => {
      const name = item.name?.trim().toLowerCase() || '';
      const words = name.split(/\s+/);
      const itemTotal = item.totalPrice || item.unitPrice || 0; // totalPrice is already the total
      
      const isSingleWord = words.length === 1;
      const isContinuationWord = continuationWords.has(name);
      const hasDuplicatePrice = priceCount[itemTotal] > 1;
      
      return {
        index,
        item,
        itemTotal,
        isCandidate: isSingleWord && isContinuationWord && hasDuplicatePrice
      };
    });
    
    // Find items to remove that match the excess amount
    const toRemove = new Set();
    let removedSum = 0;
    
    for (const candidate of candidates) {
      if (candidate.isCandidate && removedSum < excessAmount) {
        // Check if removing this item helps match the total
        if (Math.abs((removedSum + candidate.itemTotal) - excessAmount) < Math.abs(removedSum - excessAmount) ||
            removedSum + candidate.itemTotal <= excessAmount) {
          toRemove.add(candidate.index);
          removedSum += candidate.itemTotal;
          console.log(`🚫 Removing: "${candidate.item.name}" (₹${candidate.itemTotal}) - likely continuation`);
        }
      }
    }
    
    // Filter out the items to remove
    const filtered = items.filter((_, index) => !toRemove.has(index));
    
    const newSum = filtered.reduce((sum, item) => sum + (item.totalPrice || item.unitPrice || 0), 0);
    console.log(`📊 After fix: Items sum=₹${newSum}, Expected=₹${expectedAmount}`);
    
    return filtered;
  }
  
  return items;
}

// ============ CATEGORIZATION KEYWORDS ============
const NON_VEG_KEYWORDS = [
  'chicken', 'mutton', 'fish', 'prawn', 'prawns', 'shrimp', 'egg', 'omelette',
  'kebab', 'keema', 'gosht', 'lamb', 'beef', 'pork', 'crab', 'lobster', 'squid',
  'pomfret', 'surmai', 'apollo', 'tandoori chicken', 'butter chicken', 'seekh'
];

const VEG_KEYWORDS = [
  'paneer', 'dal', 'rice', 'naan', 'roti', 'paratha', 'chapati', 'pulao', 'biryani',
  'sambar', 'rasam', 'idli', 'dosa', 'uttapam', 'gobi', 'aloo', 'chole', 'tikka',
  'rajma', 'thali', 'salad', 'raita', 'palak', 'matar', 'bhindi', 'sabzi', 'curry',
  'mushroom', 'corn', 'baby corn', 'manchurian', 'noodles', 'fried rice', 'north indian',
  'south indian', 'indian'
];

const BEVERAGE_KEYWORDS = [
  'juice', 'tea', 'coffee', 'lassi', 'buttermilk', 'chaas', 'milkshake', 'shake',
  'mocktail', 'soda', 'cola', 'pepsi', 'coke', 'sprite', 'fanta', 'limca', 'thumbsup',
  'maaza', 'frooti', 'slice', 'lime', 'lemon', 'nimbu', 'jaljeera', 'soft drink'
];

const OTHER_KEYWORDS = [
  'water', 'mineral', 'papad', 'pickle', 'achar', 'chutney', 'sauce', 'extra',
  'packing', 'container', 'delivery', 'service'
];

/**
 * Categorize a food item based on its name
 */
function categorizeItem(name) {
  const lowerName = (name || '').toLowerCase();
  
  // Priority 1: If contains paneer, it's ALWAYS veg (even "Paneer Tikka Biryani")
  if (lowerName.includes('paneer')) {
    return 'veg';
  }
  
  // Priority 2: Check for non-veg keywords
  for (const keyword of NON_VEG_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return 'nonveg';
    }
  }
  
  // Priority 3: Check for veg keywords
  for (const keyword of VEG_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return 'veg';
    }
  }
  
  // Priority 4: Check for beverage keywords
  for (const keyword of BEVERAGE_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return 'beverage';
    }
  }
  
  // Priority 5: Check for other keywords
  for (const keyword of OTHER_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return 'other';
    }
  }
  
  // Default: If contains common food words, assume veg
  const commonFoodWords = ['curry', 'masala', 'fry', 'gravy', 'special', 'combo', 'meal'];
  for (const word of commonFoodWords) {
    if (lowerName.includes(word)) {
      return 'veg'; // Default food to veg unless explicitly non-veg
    }
  }
  
  return 'other';
}

/**
 * Determine bill type from merchant name and items
 */
function detectBillType(merchantName, items) {
  const name = (merchantName || '').toLowerCase();
  const itemNames = items.map(i => (i.name || '').toLowerCase()).join(' ');
  
  // Restaurant indicators
  const restaurantKeywords = ['restaurant', 'cafe', 'hotel', 'dhaba', 'kitchen', 'food', 'biryani', 'pizza', 'burger'];
  for (const kw of restaurantKeywords) {
    if (name.includes(kw) || itemNames.includes(kw)) return 'restaurant';
  }
  
  // Check if items look like food
  const foodKeywords = ['biryani', 'rice', 'roti', 'naan', 'curry', 'dal', 'chicken', 'paneer', 'thali', 'fry'];
  for (const kw of foodKeywords) {
    if (itemNames.includes(kw)) return 'restaurant';
  }
  
  return 'other';
}

/**
 * Process raw OCR items into standardized format with categories
 */
function processItems(rawItems) {
  return (rawItems || []).map(item => {
    // Handle both old format (unitPrice/totalPrice) and new format (rate/amt)
    const unitPrice = item.unitPrice || item.rate || item.price || 0;
    const totalPrice = item.totalPrice || item.amt || item.amount || unitPrice;
    let quantity = item.quantity || item.qty || 1;
    
    // Fix: Calculate quantity from totalPrice/unitPrice if needed
    if (unitPrice > 0 && totalPrice > unitPrice) {
      const calculatedQty = Math.round(totalPrice / unitPrice);
      if (Math.abs((calculatedQty * unitPrice) - totalPrice) < totalPrice * 0.01) {
        quantity = calculatedQty;
      }
    }
    
    // Fix: Round decimal quantities to whole numbers
    if (!Number.isInteger(quantity)) {
      console.log(`🔢 Rounding quantity: ${item.name} ${quantity} → ${Math.round(quantity)}`);
      quantity = Math.round(quantity);
    }
    
    // Categorize the item
    const category = categorizeItem(item.name);
    
    return {
      name: item.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity, // Recalculate to ensure consistency
      category
    };
  });
}

/**
 * Deduplicate taxes with the same name
 * Merges duplicate tax entries by keeping unique entries
 */
function deduplicateTaxes(taxes) {
  if (!taxes || taxes.length === 0) return [];
  
  const seen = new Map();
  
  for (const tax of taxes) {
    const key = tax.name?.toLowerCase() || `tax_${tax.amount}`;
    
    if (!seen.has(key)) {
      seen.set(key, tax);
    } else {
      console.log(`🔄 Removing duplicate tax: ${tax.name} ₹${tax.amount}`);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Transform response to standard format
 */
function transformResponse(data, modelUsed) {
  // Process raw items into standardized format with categories
  const processedItems = processItems(data.items);
  
  // Detect bill type from content
  const billType = data.billType || detectBillType(data.merchantName, processedItems);
  const isRestaurant = billType === 'restaurant';

  // Validate and fix items based on totals
  const validatedItems = validateAndFixItems(
    processedItems,
    data.subtotal,
    data.total,
    data.taxes,
    data.totalQty
  );

  // Map to final format
  const items = validatedItems.map(item => ({
    name: item.name,
    quantity: item.quantity || 1,
    price: item.unitPrice,
    totalPrice: item.totalPrice,
    category: isRestaurant ? mapCategory(item.category) : '📦 Others'
  }));

  // Categorize items for restaurant bills
  const vegItems = isRestaurant ? items.filter(i => i.category === '🥬 Veg') : [];
  const nonVegItems = isRestaurant ? items.filter(i => i.category === '🍖 Non-Veg') : [];
  const beverageItems = isRestaurant ? items.filter(i => i.category === '🥤 Beverages') : [];
  const otherItems = isRestaurant ? items.filter(i => i.category === '📦 Others') : items;

  const subtotal = data.subtotal || items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  
  // Deduplicate taxes
  const dedupedTaxes = deduplicateTaxes(data.taxes || []);

  return {
    merchantName: data.merchantName || data.restaurantName,
    date: data.date,
    items,
    categorizedItems: {
      '🥬 Veg': vegItems,
      '🍖 Non-Veg': nonVegItems,
      '🥤 Beverages': beverageItems,
      '📦 Others': otherItems
    },
    subtotal: roundToTwo(subtotal),
    taxes: dedupedTaxes,
    total: data.total ? roundToTwo(data.total) : roundToTwo(subtotal),
    currency: data.currency || 'INR',
    billType: billType,
    ocrEngine: 'openrouter',
    modelUsed: modelUsed || 'unknown'
  };
}

function mapCategory(category) {
  const map = {
    'veg': '🥬 Veg',
    'nonveg': '🍖 Non-Veg',
    'non-veg': '🍖 Non-Veg',
    'beverage': '🥤 Beverages',
    'other': '📦 Others'
  };
  return map[category?.toLowerCase()] || '📦 Others';
}

function roundToTwo(num) {
  return Math.round(num * 100) / 100;
}

module.exports = { extractBillWithOpenRouter };

