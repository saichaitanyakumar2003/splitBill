/**
 * OpenRouter OCR - Uses FREE vision models
 * Get API key from: https://openrouter.ai/keys
 * FREE models with vision support!
 */

const fs = require('fs');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Free vision models on OpenRouter
const FREE_VISION_MODELS = [
  'qwen/qwen-2.5-vl-7b-instruct:free',       // User's available free model
];

/**
 * Extract bill data from image using OpenRouter free vision models
 */
async function extractBillWithOpenRouter(imagePath) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured. Get free key from https://openrouter.ai/keys');
  }

  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  // Determine mime type
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

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
  "currency": "INR"
}

CRITICAL PRICE EXTRACTION RULES (MUST FOLLOW):
1. ITEM PRICES: Look for "Price" or "Rate" column, NOT "Amount" or "Amt" column
   - "Price/Rate" = base price before tax (USE THIS for unitPrice and totalPrice)
   - "Amount/Amt" = price after per-item tax (IGNORE THIS COLUMN)
   - Example: If row shows "Price: 100" and "Amt: 112", use unitPrice=100, totalPrice=100

2. SUBTOTAL: This is the SUM OF BASE PRICES (Price column) of all items
   - Subtotal = sum of all item's "Price" values (NOT "Amt" values)
   - Example: Items with prices 400, 100, 100, 150, 50, 100 → subtotal = 900
   - If bill shows "Subtotal: 900", use 900 (the base price sum)

3. TAXES - VERY IMPORTANT:
   - ONLY include taxes if they are EXPLICITLY printed on the bill (look for CGST, SGST, GST, IGST, Service Tax lines with amounts)
   - If the bill shows NO tax lines, return "taxes": [] (empty array)
   - If Grand Total equals Subtotal, there are NO taxes - return "taxes": []
   - DO NOT calculate or assume taxes - only extract what is printed
   - Example WITH taxes: Bill shows "CGST: 27.35, SGST: 27.35" → include them
   - Example WITHOUT taxes: Bill shows only "Subtotal: 1094, Grand Total: 1094" → "taxes": []

4. TOTAL: The final amount (Grand Total) shown on the bill
   - If no taxes exist, total = subtotal

CATEGORY RULES based on billType:

For "restaurant" bills:
- "veg": Paneer, Dal, Rice, Naan, Roti, Vegetables, Salads, Pulao, Sambar, Rasam, Idli, Dosa (plain/masala), Uttapam, Veg Biryani, Gobi, Aloo, Chole, Rajma
- "nonveg": ANY item containing these words MUST be nonveg:
  * CHICKEN: Chicken Biryani, Chicken Fry, Chicken 65, Chicken Lollypop, Chicken Tikka, Butter Chicken, Tandoori Chicken, Chicken Curry, Chicken Manchurian, Chilli Chicken
  * MUTTON: Mutton Biryani, Mutton Curry, Mutton Fry, Mutton Keema, Rogan Josh, Mutton Korma
  * FISH: Fish Fry, Fish Curry, Apollo Fish, Fish Biryani, Pomfret, Surmai, Fish Tikka
  * PRAWNS/SHRIMP: Prawn Fry, Prawn Curry, Prawn Biryani, Chilli Prawns, Tandoori Prawns
  * EGG: Egg Curry, Egg Biryani, Omelette, Egg Fried Rice, Egg Bhurji
  * OTHER MEAT: Kebab, Seekh Kebab, Keema, Gosht, Lamb, Beef, Pork, Crab, Lobster, Squid
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
          max_tokens: 2048,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`${model} failed:`, errorData.error?.message || errorData);
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
        itemPrices: billData.items?.map(i => ({ name: i.name, unitPrice: i.unitPrice, totalPrice: i.totalPrice }))
      }, null, 2));
      return transformResponse(billData);

    } catch (err) {
      console.error(`${model} error:`, err.message);
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('All OpenRouter models failed');
}

/**
 * Transform response to standard format
 */
function transformResponse(data) {
  const billType = data.billType || 'restaurant';
  const isRestaurant = billType === 'restaurant';

  const items = (data.items || []).map(item => ({
    name: item.name,
    quantity: item.quantity || 1,
    price: item.unitPrice || item.totalPrice,
    totalPrice: item.totalPrice || item.unitPrice,
    category: isRestaurant ? mapCategory(item.category) : '📦 Others'
  }));

  // For restaurant bills, categorize items
  // For other bills, put everything in "Others"
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
    ocrEngine: 'openrouter'
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

