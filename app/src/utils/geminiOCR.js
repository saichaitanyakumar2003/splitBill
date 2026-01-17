/**
 * Client-side Gemini OCR
 * Calls Gemini API directly from the app for faster processing
 * Works on iOS, Android, and Web
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// OCR Prompt for bill extraction
const OCR_PROMPT = `Analyze this bill/receipt image and extract the information in JSON format.

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "billType": "restaurant" or "grocery" or "pharmacy" or "electronics" or "fuel" or "other",
  "merchantName": "Name of shop/restaurant or null",
  "date": "Date in DD/MM/YYYY format or null",
  "items": [
    {
      "name": "Item name",
      "quantity": 1,
      "unitPrice": 100,
      "totalPrice": 100,
      "category": "veg" or "nonveg" or "beverage" or "other"
    }
  ],
  "subtotal": 500,
  "taxes": [{"name": "CGST", "amount": 25}, {"name": "SGST", "amount": 25}],
  "total": 550,
  "totalQty": 5,
  "currency": "INR"
}

First, determine the bill type:
- "restaurant": If it's a food/restaurant bill (has food items like biryani, pizza, burger, dal, etc.)
- "grocery": If it's a grocery/supermarket bill
- "pharmacy": If it's a medical/pharmacy bill
- "electronics": If it's an electronics store bill
- "fuel": If it's a petrol/fuel bill
- "other": For any other type of bill

CRITICAL PRICE EXTRACTION RULES (MUST FOLLOW):

1. USE PRICES EXACTLY AS SHOWN ON THE BILL - VERY IMPORTANT:
   - Extract the EXACT numbers shown in the Rate/Price column
   - DO NOT calculate or reverse-engineer prices
   - If bill shows "GOBI CHILLI 1 190 190", use unitPrice=190, totalPrice=190
   - NEVER divide prices by tax rates or modify them in any way

2. TAX-INCLUSIVE BILLS - VERY IMPORTANT:
   - If bill says "Prices incl. of taxes", "Tax inclusive", "MRP inclusive of all taxes", etc.
   - The prices shown ALREADY INCLUDE TAX - use them as-is
   - Set taxes to EMPTY ARRAY [] (taxes are already in prices, don't double-count)
   - subtotal = total (they are the same for tax-inclusive bills)
   - Example: Bill shows "Food Total: 1210" and "Prices incl. of taxes" → subtotal=1210, total=1210, taxes=[]

3. TAX-EXCLUSIVE BILLS (taxes added separately):
   - If taxes are shown as separate line items ADDED to subtotal
   - Example: "Subtotal: 1000, CGST: 25, SGST: 25, Total: 1050"
   - Then include taxes: [{"name": "CGST", "amount": 25}, {"name": "SGST", "amount": 25}]

4. SKIP CONTINUATION LINES:
   - On thermal receipts, long item names wrap to the next line
   - If a line has ONLY text with NO quantity and NO price values, SKIP IT
   - Only include items that have actual Qty and Price values

5. QUANTITY EXTRACTION:
   - Read the ACTUAL quantity from the Qty column
   - Numbers in item names (like "Chicken 65") are part of the name, NOT the quantity

6. TOTAL: The final amount (Grand Total/Total Rs) shown on the bill

7. TOTAL QTY: If the bill shows "Total Qty: X" or "7/7", extract that number as totalQty

8. QUANTITY AND PRICE CALCULATION:
   - Read quantity from Qty column
   - unitPrice = price per single item (from Rate column)
   - totalPrice = unitPrice × quantity
   - Example: "2  Thali  419  838" → quantity=2, unitPrice=419, totalPrice=838

CATEGORY RULES based on billType:

For "restaurant" bills:
- "veg": ANY item containing PANEER is ALWAYS VEG. Also veg: Dal, Rice, Naan, Roti, Vegetables, Salads, Pulao, Sambar, Idli, Dosa, Gobi, Aloo, Chole, Rajma, Thali
- "nonveg": Items with CHICKEN, MUTTON, FISH, PRAWN, EGG, KEBAB, KEEMA
- "beverage": Juice, Soft drinks, Tea, Coffee, Lassi, Buttermilk, Milkshake
- "other": Water, Papad, Pickle, anything else

For ALL other bill types: Use "other" for ALL items

Extract ACTUAL values from the bill. All prices should be numbers.
IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no explanations.`;

/**
 * Read image and convert to base64
 * Handles both mobile (expo-file-system) and web (fetch/blob)
 */
async function imageToBase64(imageUri) {
  try {
    // Web platform - use fetch to get blob and convert to base64
    if (Platform.OS === 'web') {
      // If it's already a data URL, extract the base64 part
      if (imageUri.startsWith('data:')) {
        const base64 = imageUri.split(',')[1];
        return base64;
      }
      
      // Otherwise fetch the image and convert to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Result is data:image/jpeg;base64,<data> - extract just the base64 part
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    // Mobile platforms (iOS, Android) - use expo-file-system
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    throw new Error(`Failed to read image: ${error.message}`);
  }
}

/**
 * Call Gemini API with the image
 */
async function callGeminiAPI(apiKey, base64Image) {
  const requestBody = {
    contents: [
      {
        parts: [
          { text: OCR_PROMPT },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Parse Gemini response to extract bill data
 */
function parseGeminiResponse(response) {
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('No response from Gemini');
  }

  // Clean up markdown if present
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Failed to parse OCR response');
  }
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
  'south indian', 'indian', 'veg'
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
 * Categorize a food item based on its name (keyword-based fallback)
 */
function categorizeItemByKeywords(name) {
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
 * Transform raw OCR data to app format
 */
function transformBillData(rawData) {
  const billType = rawData.billType || 'other';
  const isRestaurant = billType === 'restaurant';

  // Category display map
  const categoryMap = {
    'veg': '🥬 Veg',
    'nonveg': '🍖 Non-Veg',
    'non-veg': '🍖 Non-Veg',
    'beverage': '🥤 Beverages',
    'other': '📦 Others',
  };

  // Process items with categories
  const items = (rawData.items || []).map(item => {
    const quantity = item.quantity || 1;
    const unitPrice = item.unitPrice || 0;
    const totalPrice = item.totalPrice || unitPrice * quantity;
    
    // Use Gemini's category, but verify/override with keyword-based categorization
    let categoryKey = item.category?.toLowerCase() || 'other';
    
    // For restaurant bills, use keyword-based categorization as primary (more reliable)
    if (isRestaurant) {
      categoryKey = categorizeItemByKeywords(item.name);
    }
    
    const category = isRestaurant 
      ? (categoryMap[categoryKey] || '📦 Others')
      : '📦 Others';

    return {
      name: item.name,
      quantity,
      price: unitPrice,
      totalPrice,
      category,
    };
  });

  // Categorize items for restaurant bills
  const categorizedItems = {
    '🥬 Veg': items.filter(i => i.category === '🥬 Veg'),
    '🍖 Non-Veg': items.filter(i => i.category === '🍖 Non-Veg'),
    '🥤 Beverages': items.filter(i => i.category === '🥤 Beverages'),
    '📦 Others': items.filter(i => i.category === '📦 Others'),
  };

  // Process taxes - normalize names
  const taxes = (rawData.taxes || []).map(tax => {
    let name = tax.name?.toUpperCase() || 'TAX';
    if (name.includes('CGST') || name === 'CST') name = 'CGST';
    if (name.includes('SGST') || name === 'SST') name = 'SGST';
    if (name.includes('IGST')) name = 'IGST';
    return { name, amount: tax.amount || 0, rate: tax.rate };
  });

  return {
    merchantName: rawData.merchantName,
    date: rawData.date,
    items,
    categorizedItems,
    subtotal: rawData.subtotal || items.reduce((sum, i) => sum + i.totalPrice, 0),
    taxes,
    total: rawData.total || rawData.subtotal,
    currency: rawData.currency || 'INR',
    billType,
    ocrEngine: 'gemini',
    modelUsed: 'gemini-2.5-flash',
  };
}

/**
 * Main function to scan a bill using Gemini
 * @param {string} imageUri - Local URI of the image
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} - Processed bill data
 */
export async function scanBillWithGemini(imageUri, apiKey) {
  console.log('═══════════════════════════════════════════');
  console.log('🚀 Starting CLIENT-SIDE OCR with Gemini...');
  console.log('═══════════════════════════════════════════');
  const startTime = Date.now();

  try {
    // Step 1: Convert image to base64
    console.log('📷 Step 1: Reading image from device...');
    const base64Image = await imageToBase64(imageUri);
    const imageSizeKB = Math.round(base64Image.length * 0.75 / 1024); // base64 is ~33% larger
    console.log(`📦 Image size: ~${imageSizeKB}KB (base64: ${Math.round(base64Image.length / 1024)}KB)`);

    // Step 2: Call Gemini API
    console.log('🤖 Step 2: Calling Gemini 2.5 Flash API...');
    const apiStartTime = Date.now();
    const response = await callGeminiAPI(apiKey, base64Image);
    const apiElapsed = ((Date.now() - apiStartTime) / 1000).toFixed(1);
    console.log(`✅ Gemini responded in ${apiElapsed}s`);
    
    // Step 3: Parse response
    console.log('📋 Step 3: Parsing OCR response...');
    const rawData = parseGeminiResponse(response);
    
    // Log extracted data
    console.log('📊 OCR Raw Response:', JSON.stringify({
      merchantName: rawData.merchantName,
      date: rawData.date,
      itemCount: rawData.items?.length || 0,
      subtotal: rawData.subtotal,
      total: rawData.total,
      taxes: rawData.taxes,
    }, null, 2));
    
    // Step 4: Transform to app format
    console.log('🔄 Step 4: Transforming to app format...');
    const billData = transformBillData(rawData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════════');
    console.log(`✅ OCR SUCCESS! Total time: ${elapsed}s`);
    console.log(`📝 Extracted ${billData.items?.length || 0} items`);
    console.log(`💰 Total: ${billData.currency} ${billData.total}`);
    console.log('═══════════════════════════════════════════');

    return {
      success: true,
      confidence: 95,
      bill: billData,
      engine: 'gemini-client',
    };
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════════');
    console.error(`❌ OCR FAILED (${elapsed}s):`, error.message);
    console.log('═══════════════════════════════════════════');
    throw error;
  }
}
