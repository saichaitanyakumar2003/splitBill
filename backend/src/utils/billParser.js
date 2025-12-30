/**
 * Parse OCR text to extract bill items, totals, and other details
 */

function parseBillText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  const items = [];
  let subtotal = null;
  let tax = null;
  let tip = null;
  let total = null;
  let merchantName = null;

  // Common patterns for prices
  const pricePattern = /\$?\d+[.,]\d{2}/g;
  const itemLinePattern = /^(.+?)\s+\$?(\d+[.,]\d{2})$/;
  const quantityItemPattern = /^(\d+)\s*[xX@]?\s*(.+?)\s+\$?(\d+[.,]\d{2})$/;

  // Keywords for identifying special lines
  const subtotalKeywords = ['subtotal', 'sub total', 'sub-total'];
  const taxKeywords = ['tax', 'vat', 'gst', 'hst'];
  const tipKeywords = ['tip', 'gratuity', 'service charge', 'service fee'];
  const totalKeywords = ['total', 'amount due', 'balance due', 'grand total'];
  const excludeKeywords = ['change', 'cash', 'card', 'credit', 'debit', 'visa', 'mastercard', 'amex', 'thank'];

  // First non-numeric line is often the merchant name
  for (const line of lines.slice(0, 5)) {
    if (!/\d/.test(line) && line.length > 2 && line.length < 50) {
      merchantName = line;
      break;
    }
  }

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Skip excluded lines
    if (excludeKeywords.some(kw => lowerLine.includes(kw))) {
      continue;
    }

    // Check for subtotal
    if (subtotalKeywords.some(kw => lowerLine.includes(kw))) {
      const prices = line.match(pricePattern);
      if (prices) {
        subtotal = parsePrice(prices[prices.length - 1]);
      }
      continue;
    }

    // Check for tax
    if (taxKeywords.some(kw => lowerLine.includes(kw))) {
      const prices = line.match(pricePattern);
      if (prices) {
        tax = parsePrice(prices[prices.length - 1]);
      }
      continue;
    }

    // Check for tip
    if (tipKeywords.some(kw => lowerLine.includes(kw))) {
      const prices = line.match(pricePattern);
      if (prices) {
        tip = parsePrice(prices[prices.length - 1]);
      }
      continue;
    }

    // Check for total
    if (totalKeywords.some(kw => lowerLine.includes(kw))) {
      const prices = line.match(pricePattern);
      if (prices) {
        total = parsePrice(prices[prices.length - 1]);
      }
      continue;
    }

    // Try to parse as an item line
    const quantityMatch = line.match(quantityItemPattern);
    if (quantityMatch) {
      const quantity = parseInt(quantityMatch[1], 10);
      const name = cleanItemName(quantityMatch[2]);
      const price = parsePrice(quantityMatch[3]);
      
      if (name && price > 0) {
        items.push({
          name,
          quantity,
          price,
          totalPrice: price
        });
      }
      continue;
    }

    const itemMatch = line.match(itemLinePattern);
    if (itemMatch) {
      const name = cleanItemName(itemMatch[1]);
      const price = parsePrice(itemMatch[2]);
      
      if (name && price > 0 && name.length > 1) {
        items.push({
          name,
          quantity: 1,
          price,
          totalPrice: price
        });
      }
    }
  }

  // Calculate subtotal from items if not found
  if (!subtotal && items.length > 0) {
    subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  // Estimate total if not found
  if (!total && subtotal) {
    total = subtotal + (tax || 0) + (tip || 0);
  }

  return {
    merchantName,
    items,
    subtotal: subtotal ? roundToTwo(subtotal) : null,
    tax: tax ? roundToTwo(tax) : null,
    tip: tip ? roundToTwo(tip) : null,
    total: total ? roundToTwo(total) : null,
    itemCount: items.length
  };
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[$,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function cleanItemName(name) {
  return name
    .replace(/^\d+\s*[xX@]?\s*/, '') // Remove leading quantity
    .replace(/\s+/g, ' ')             // Normalize spaces
    .replace(/[^\w\s&'-]/g, '')       // Remove special chars except common ones
    .trim();
}

function roundToTwo(num) {
  return Math.round(num * 100) / 100;
}

module.exports = { parseBillText, parsePrice, cleanItemName };


