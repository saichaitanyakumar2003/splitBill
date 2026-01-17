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

// Parallel models - call both simultaneously, use first successful response
// Qwen first (better at reading taxes), nvidia as backup
const MODELS = [
  { id: 'qwen/qwen-2.5-vl-7b-instruct:free', name: 'qwen' },
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'nvidia' }
];

// Image optimization settings
const MAX_IMAGE_DIMENSION = 640;
const JPEG_QUALITY = 50;
const MODEL_TIMEOUT_MS = 180000; // 180 second timeout per model

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

  // Detailed prompt for bill extraction
  const prompt = `Analyze this bill/receipt image and extract the information in JSON format.

First, determine the bill type:
- "restaurant": If it's a food/restaurant bill (has food items like biryani, pizza, burger, dal, etc.)
- "grocery": If it's a grocery/supermarket bill
- "pharmacy": If it's a medical/pharmacy bill
- "electronics": If it's an electronics store bill
- "fuel": If it's a petrol/fuel bill
- "other": For any other type of bill

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "billType": "restaurant" or "grocery" or "pharmacy" or "electronics" or "fuel" or "other",
  "merchantName": "Name of shop/restaurant or null",
  "date": "Date in DD/MM/YYYY format or null",
  "items": [
    {
      "name": "Item name (clean, no quantity suffix)",
      "quantity": 1,
      "unitPrice": 240,
      "totalPrice": 240,
      "category": "see category rules below"
    }
  ],
  "subtotal": 760,
  "taxes": [],
  "total": 760,
  "totalQty": 6,
  "currency": "INR"
}

CRITICAL PRICE EXTRACTION RULES (MUST FOLLOW):
1. SKIP CONTINUATION LINES - VERY IMPORTANT:
   - On thermal receipts, long item names wrap to the next line
   - If a line has ONLY text with NO quantity and NO price values, SKIP IT completely
   - DO NOT create an item for such lines - they are just continuations of previous item names
   - Only include items that have actual Qty and Price values in the row
   
   EXAMPLE:
   Line 1: "Chicken Fry      1   270.00   270.00" → Include this (has qty=1, price=270)
   Line 2: "Biryani"  → SKIP this completely (no qty, no price - it's just text overflow)
   
   - Numbers in item names (like "Chicken Lollipop 6") are part of the name, NOT the quantity
   - Always look at the Qty column to get actual quantity

2. ITEM PRICES: Look for "Price" or "Rate" column, NOT "Amount" or "Amt" column
   - "Price/Rate" = base price before tax (USE THIS for unitPrice and totalPrice)
   - "Amount/Amt" = price after per-item tax (IGNORE THIS COLUMN)
   - Example: If row shows "Price: 100" and "Amt: 112", use unitPrice=100, totalPrice=100

3. SUBTOTAL: This is the SUM OF BASE PRICES (Price column) of all items
   - Subtotal = sum of all item's "Price" values (NOT "Amt" values)
   - Example: Items with prices 400, 100, 100, 150, 50, 100 → subtotal = 900
   - If bill shows "Subtotal: 900", use 900 (the base price sum)

4. TAXES - VERY IMPORTANT:
   - ONLY include taxes if they are EXPLICITLY printed on the bill (look for CGST, SGST, GST, IGST, Service Tax lines with amounts)
   - If the bill shows NO tax lines, return "taxes": [] (empty array)
   - If Grand Total equals Subtotal, there are NO taxes - return "taxes": []
   - DO NOT calculate or assume taxes - only extract what is printed
   - Example WITH taxes: Bill shows "CGST: 27.35, SGST: 27.35" → include them
   - Example WITHOUT taxes: Bill shows only "Subtotal: 1094, Grand Total: 1094" → "taxes": []

5. TOTAL: The final amount (Grand Total) shown on the bill
   - If no taxes exist, total = subtotal

6. TOTAL QTY: If the bill shows "Total Qty: X", extract that number as totalQty
   - This helps validate the correct number of items were extracted

7. QUANTITY EXTRACTION - VERY IMPORTANT:
   - Read the ACTUAL quantity from the "QTY", "Qty", "Quantity", or "No." column on the bill
   - DO NOT assume quantity = 1 for all items
   - The first number in each row is usually the quantity
   - Example row: "2  South Indian Thali  419.00  838.00" → quantity=2, unitPrice=419, totalPrice=838
   - Example row: "3  Water Btl Dinein    5.50   16.50" → quantity=3, unitPrice=5.50, totalPrice=16.50
   - unitPrice = price per single item, totalPrice = unitPrice × quantity

CATEGORY RULES based on billType:

For "restaurant" bills:
- "veg": ANY item containing PANEER is ALWAYS VEG (Paneer Tikka, Paneer Biryani, Shahi Paneer, Paneer Butter Masala, Kadai Paneer, Paneer Tikka Biryani, Paneer 65, Paneer Manchurian)
  Also veg: Dal, Rice, Naan, Roti, Vegetables, Salads, Pulao, Sambar, Rasam, Idli, Dosa (plain/masala), Uttapam, Veg Biryani, Gobi, Aloo, Chole, Rajma, Thali (if not specified as non-veg), North Indian Thali, South Indian Thali
- "nonveg": ONLY items containing actual meat keywords:
  * CHICKEN: Chicken Biryani, Chicken Fry, Chicken 65, Chicken Lollypop, Chicken Tikka, Butter Chicken, Tandoori Chicken, Chicken Curry, Chicken Manchurian, Chilli Chicken
  * MUTTON: Mutton Biryani, Mutton Curry, Mutton Fry, Mutton Keema, Rogan Josh, Mutton Korma
  * FISH: Fish Fry, Fish Curry, Apollo Fish, Fish Biryani, Pomfret, Surmai, Fish Tikka
  * PRAWNS/SHRIMP: Prawn Fry, Prawn Curry, Prawn Biryani, Chilli Prawns, Tandoori Prawns
  * EGG: Egg Curry, Egg Biryani, Omelette, Egg Fried Rice, Egg Bhurji
  * OTHER MEAT: Kebab (without Paneer), Seekh Kebab, Keema, Gosht, Lamb, Beef, Pork, Crab, Lobster, Squid
  NOTE: "Tikka" alone does NOT mean non-veg. "Paneer Tikka" is VEG. Only "Chicken Tikka", "Fish Tikka" etc. are non-veg.
- "beverage": Juice, Soft drinks, Tea, Coffee, Lassi, Buttermilk, Milkshake, Mocktail, Soda, Lime Water
- "other": Water, Water Bottle, Mineral Water, Papad, Pickle, anything that doesn't fit above

For ALL other bill types (grocery, pharmacy, electronics, fuel, other):
- Use "other" for ALL items (we display them as single "Items" category)

Extract ACTUAL values from the bill. All prices should be numbers.`;

  const startTime = Date.now();
  console.log(`🚀 Calling ${MODELS.length} models in parallel (${MODELS.map(m => m.name).join(', ')}) with ${MODEL_TIMEOUT_MS/1000}s timeout each`);

  // Create API call promise for a specific model with timeout
  const createModelPromise = (model) => {
    const modelStartTime = Date.now();
    
    // Create timeout promise for this model
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`TIMEOUT after ${MODEL_TIMEOUT_MS/1000}s`)), MODEL_TIMEOUT_MS);
    });
    
    // Create API call promise
    const apiPromise = (async () => {
      console.log(`  📡 Starting ${model.name}...`);
      
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://splitbill.app',
          'X-Title': 'SplitBill OCR'
        },
        body: JSON.stringify({
          model: model.id,
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
          max_tokens: 2048,
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
      const elapsed = ((Date.now() - modelStartTime) / 1000).toFixed(1);
      console.log(`  ✅ ${model.name} succeeded in ${elapsed}s`);
      
      return { billData, model };
    })();
    
    // Race API call against timeout
    return Promise.race([apiPromise, timeoutPromise]).catch(err => {
      const elapsed = ((Date.now() - modelStartTime) / 1000).toFixed(1);
      console.log(`  ❌ ${model.name} failed (${elapsed}s): ${err.message}`);
      throw err;
    });
  };

  try {
    // Call all models in parallel, use first successful response
    const modelPromises = MODELS.map(model => createModelPromise(model));
    const { billData, model } = await Promise.any(modelPromises);
    
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`🏆 Winner: ${model.name} (total time: ${totalElapsed}s)`);
    
    console.log('📋 OCR Raw Response:', JSON.stringify({
      subtotal: billData.subtotal,
      total: billData.total,
      taxes: billData.taxes,
      itemPrices: billData.items?.map(i => ({ name: i.name, unitPrice: i.unitPrice, totalPrice: i.totalPrice, category: i.category }))
    }, null, 2));

    return transformResponse(billData, model.name);

  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    // Promise.any throws AggregateError when all promises reject
    const errorMsg = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
    console.error(`❌ All models failed (${elapsed}s): ${errorMsg}`);
    throw new Error(`OCR failed: All models failed - ${errorMsg}`);
  }
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
 * Fix and normalize tax names
 * Common OCR mistakes: CST → CGST, SST → SGST, etc.
 */
function normalizeTaxName(name) {
  if (!name) return name;
  const upper = name.toUpperCase().trim();
  
  // Fix common OCR misreads
  if (upper === 'CST' || upper === 'C.G.S.T' || upper === 'C GST') return 'CGST';
  if (upper === 'SST' || upper === 'S.G.S.T' || upper === 'S GST') return 'SGST';
  if (upper === 'IST' || upper === 'I.G.S.T' || upper === 'I GST') return 'IGST';
  if (upper.includes('CGST')) return 'CGST';
  if (upper.includes('SGST')) return 'SGST';
  if (upper.includes('IGST')) return 'IGST';
  if (upper.includes('SERVICE')) return 'Service Tax';
  
  return name;
}

/**
 * Deduplicate taxes with the same name
 * Merges duplicate tax entries by keeping unique entries
 */
function deduplicateTaxes(taxes) {
  if (!taxes || taxes.length === 0) return [];
  
  const seen = new Map();
  
  for (const tax of taxes) {
    // Normalize tax name first
    const normalizedName = normalizeTaxName(tax.name);
    const key = normalizedName?.toLowerCase() || `tax_${tax.amount}`;
    
    if (!seen.has(key)) {
      seen.set(key, { ...tax, name: normalizedName });
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
  const total = data.total || subtotal;
  
  // Deduplicate and normalize taxes
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
    total: roundToTwo(total),
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

