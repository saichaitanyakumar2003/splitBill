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
  "taxes": [
    {"name": "CGST (2.5%)", "amount": 18.10}
  ],
  "total": 760,
  "currency": "INR"
}

CATEGORY RULES based on billType:

For "restaurant" bills:
- "veg": Paneer, Dal, Rice, Naan, Roti, Vegetables, Salads
- "nonveg": Chicken, Mutton, Fish, Egg, Prawn, Meat, Biryani with meat
- "beverage": Juice, Soft drinks, Tea, Coffee, Lassi
- "other": Water, Water Bottle, Mineral Water, anything else

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

