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

// Free vision models on OpenRouter
const FREE_VISION_MODELS = [
  'nvidia/nemotron-nano-12b-v2-vl:free',     // Primary - Nvidia vision model
  'qwen/qwen-2.5-vl-7b-instruct:free',       // Fallback 1 - Qwen vision
  'google/gemma-3-27b-it:free',              // Fallback 2 - Google Gemma
];

// Image optimization settings
const MAX_IMAGE_DIMENSION = 1200; // Max width or height
const JPEG_QUALITY = 80; // Compression quality (0-100)

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

  let lastError = null;

  // Try each free model
  for (const model of FREE_VISION_MODELS) {
    try {
      console.log(`Trying OpenRouter model: ${model}`);
      
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
          max_tokens: 4096,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`${model} failed:`);
        console.error(`  Status: ${response.status}`);
        console.error(`  Full error:`, JSON.stringify(errorData, null, 2));
        lastError = new Error(errorData.error?.message || 'API error');
        continue;
      }

      const data = await response.json();
      const textResponse = data.choices?.[0]?.message?.content;

      if (!textResponse) {
        console.error(`${model}: No response content`);
        continue;
      }

      console.log(`✅ Success with ${model}`);
      
      // Parse JSON response
      let jsonStr = textResponse.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const billData = JSON.parse(jsonStr);
      console.log('📋 OCR Raw Response:', JSON.stringify({
        subtotal: billData.subtotal,
        total: billData.total,
        itemPrices: billData.items?.map(i => ({ name: i.name, unitPrice: i.unitPrice, totalPrice: i.totalPrice, category: i.category }))
      }, null, 2));
      return transformResponse(billData, model);

    } catch (err) {
      console.error(`${model} error:`, err.message);
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('All OpenRouter models failed');
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

/**
 * Fix items with post-processing rules
 * - Paneer items are ALWAYS veg
 * - Fix quantities based on totalPrice/unitPrice ratio
 */
function fixItemsPostProcessing(items) {
  return items.map(item => {
    const name = (item.name || '').toLowerCase();
    const fixedItem = { ...item };
    
    // Fix 1: Paneer items are ALWAYS vegetarian
    if (name.includes('paneer')) {
      fixedItem.category = 'veg';
    }
    
    // Fix 2: Calculate correct quantity from totalPrice/unitPrice
    const unitPrice = item.unitPrice || 0;
    const totalPrice = item.totalPrice || 0;
    
    if (unitPrice > 0 && totalPrice > 0 && totalPrice > unitPrice) {
      const calculatedQty = Math.round(totalPrice / unitPrice);
      // Verify it's a clean division (within 1% tolerance)
      if (Math.abs((calculatedQty * unitPrice) - totalPrice) < totalPrice * 0.01) {
        fixedItem.quantity = calculatedQty;
      }
    }
    
    return fixedItem;
  });
}

/**
 * Transform response to standard format
 */
function transformResponse(data, modelUsed) {
  const billType = data.billType || 'restaurant';
  const isRestaurant = billType === 'restaurant';

  // First apply post-processing fixes
  const fixedItems = fixItemsPostProcessing(data.items || []);

  // Then validate and fix items based on totals
  const validatedItems = validateAndFixItems(
    fixedItems,
    data.subtotal,
    data.total,
    data.taxes,
    data.totalQty
  );

  const items = validatedItems.map(item => ({
    name: item.name,
    quantity: item.quantity || 1,
    price: item.unitPrice || item.totalPrice,
    totalPrice: item.totalPrice || item.unitPrice,
    category: isRestaurant ? mapCategory(item.category) : '📦 Others'
  }));

  // For restaurant bills, categorize items
  const vegItems = isRestaurant ? items.filter(i => i.category === '🥬 Veg') : [];
  const nonVegItems = isRestaurant ? items.filter(i => i.category === '🍖 Non-Veg') : [];
  const beverageItems = isRestaurant ? items.filter(i => i.category === '🥤 Beverages') : [];
  const otherItems = isRestaurant ? items.filter(i => i.category === '📦 Others') : items;

  const subtotal = data.subtotal || items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

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
    taxes: data.taxes || [],
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

