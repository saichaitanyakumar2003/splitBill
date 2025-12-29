/**
 * Dynamic Multi-Category Item Classifier
 * Classifies scanned bill items based on bill type
 */

// ============================================
// BILL TYPE DETECTION
// ============================================

const BILL_TYPE_KEYWORDS = {
  restaurant: [
    'restaurant', 'cafe', 'bistro', 'diner', 'eatery', 'kitchen', 'grill',
    'pizza', 'burger', 'sushi', 'thai', 'indian', 'chinese', 'mexican',
    'bar', 'pub', 'lounge', 'food court', 'canteen', 'dhaba', 'hotel',
    'biryani', 'tandoor', 'masala', 'curry', 'noodles', 'rice', 'roti',
    'table', 'dine', 'order', 'waiter', 'chef', 'tip', 'service charge'
  ],
  grocery: [
    'grocery', 'supermarket', 'mart', 'store', 'market', 'wholesale',
    'fresh', 'produce', 'dairy', 'bakery', 'dmart', 'bigbasket', 'zepto',
    'blinkit', 'reliance', 'more', 'spencer', 'walmart', 'costco'
  ],
  pharmacy: [
    'pharmacy', 'medical', 'chemist', 'drugstore', 'medicine', 'health',
    'apollo', 'medplus', 'netmeds', 'pharmeasy', 'tablet', 'capsule',
    'syrup', 'prescription', 'rx', 'doctor'
  ],
  electronics: [
    'electronics', 'mobile', 'phone', 'laptop', 'computer', 'gadget',
    'croma', 'reliance digital', 'vijay sales', 'amazon', 'flipkart',
    'samsung', 'apple', 'oneplus', 'charger', 'cable', 'headphone'
  ],
  clothing: [
    'clothing', 'apparel', 'fashion', 'wear', 'garment', 'boutique',
    'shirt', 'pant', 'dress', 'jeans', 'saree', 'kurta', 'jacket',
    'zara', 'h&m', 'uniqlo', 'levis', 'nike', 'adidas', 'puma'
  ],
  fuel: [
    'petrol', 'diesel', 'fuel', 'gas station', 'petroleum', 'pump',
    'indian oil', 'bharat petroleum', 'hp', 'shell', 'essar', 'litre'
  ],
  utility: [
    'electricity', 'water', 'gas', 'internet', 'broadband', 'mobile bill',
    'recharge', 'postpaid', 'prepaid', 'utility', 'bill payment'
  ]
};

// ============================================
// CATEGORY-SPECIFIC ITEM CLASSIFICATIONS
// ============================================

const ITEM_CATEGORIES = {
  // RESTAURANT / FOOD BILL CATEGORIES
  restaurant: {
    categories: ['🥬 Veg', '🍖 Non-Veg', '🥤 Beverages', '🍰 Desserts', '🍟 Sides', '🍞 Breads', '📦 Others'],
    keywords: {
      '🥬 Veg': [
        // Indian Veg
        'paneer', 'dal', 'daal', 'sabzi', 'sabji', 'aloo', 'gobi', 'palak',
        'matar', 'bhindi', 'baingan', 'mushroom', 'veg', 'vegetable', 'salad',
        'raita', 'chole', 'rajma', 'kadhi', 'khichdi', 'pulao', 'biryani veg',
        'idli', 'dosa', 'vada', 'uttapam', 'upma', 'poha', 'sambar',
        // International Veg
        'margherita', 'veg pizza', 'pasta arrabiata', 'veg burger', 'fries',
        'corn', 'beans', 'tofu', 'tempeh', 'hummus', 'falafel', 'veggie',
        'capsicum', 'onion rings', 'veg manchurian', 'veg fried rice',
        'spring roll veg', 'veg momos', 'chilli paneer', 'kadai paneer',
        'shahi paneer', 'butter paneer', 'malai kofta', 'mix veg',
        'jeera rice', 'plain rice', 'steamed rice', 'curd rice'
      ],
      '🍖 Non-Veg': [
        // Chicken
        'chicken', 'chiken', 'murgh', 'tandoori chicken', 'butter chicken',
        'chicken tikka', 'chicken biryani', 'chicken curry', 'chicken 65',
        'chicken manchurian', 'chicken fried rice', 'chicken momos',
        'chicken wings', 'chicken nuggets', 'grilled chicken', 'roast chicken',
        // Mutton/Lamb
        'mutton', 'lamb', 'gosht', 'keema', 'rogan josh', 'mutton biryani',
        'mutton curry', 'seekh kebab', 'shammi kebab', 'galouti',
        // Fish & Seafood
        'fish', 'prawn', 'shrimp', 'crab', 'lobster', 'squid', 'calamari',
        'pomfret', 'salmon', 'tuna', 'surmai', 'bangda', 'rawas',
        'fish curry', 'fish fry', 'prawn masala', 'tandoori fish',
        // Egg
        'egg', 'anda', 'omelette', 'omelet', 'scrambled', 'boiled egg',
        'egg curry', 'egg biryani', 'egg fried rice', 'bhurji',
        // Meat
        'meat', 'beef', 'pork', 'bacon', 'ham', 'sausage', 'salami',
        'pepperoni', 'steak', 'ribs', 'bbq', 'barbeque', 'kebab', 'tikka',
        // Non-veg indicators
        'non-veg', 'nonveg', 'non veg', 'nv', 'n.v'
      ],
      '🥤 Beverages': [
        // Cold Drinks
        'coke', 'coca cola', 'pepsi', 'sprite', 'fanta', 'limca', 'thums up',
        'mirinda', '7up', 'mountain dew', 'soda', 'soft drink', 'cold drink',
        // Juices
        'juice', 'fresh juice', 'orange juice', 'apple juice', 'mango juice',
        'watermelon', 'pineapple juice', 'mixed fruit', 'sugarcane',
        // Hot Beverages
        'tea', 'chai', 'coffee', 'cappuccino', 'latte', 'espresso',
        'americano', 'mocha', 'hot chocolate', 'green tea', 'masala tea',
        // Shakes & Smoothies
        'shake', 'milkshake', 'smoothie', 'lassi', 'buttermilk', 'chaas',
        'mango shake', 'chocolate shake', 'strawberry shake',
        // Water
        'water', 'mineral water', 'packaged water', 'soda water',
        // Alcohol (if applicable)
        'beer', 'wine', 'whisky', 'vodka', 'rum', 'cocktail', 'mocktail'
      ],
      '🍰 Desserts': [
        // Indian Sweets
        'gulab jamun', 'rasgulla', 'rasmalai', 'jalebi', 'kheer', 'halwa',
        'ladoo', 'laddu', 'barfi', 'peda', 'kulfi', 'rabri', 'phirni',
        'gajar halwa', 'moong dal halwa', 'besan ladoo',
        // Western Desserts
        'ice cream', 'sundae', 'brownie', 'cake', 'pastry', 'pudding',
        'cheesecake', 'tiramisu', 'mousse', 'pie', 'tart', 'cookie',
        'donut', 'waffle', 'pancake', 'crepe',
        // Dessert indicators
        'dessert', 'sweet', 'mithai'
      ],
      '🍟 Sides': [
        'fries', 'french fries', 'wedges', 'chips', 'nachos', 'papad',
        'pickle', 'chutney', 'sauce', 'dip', 'mayo', 'ketchup',
        'coleslaw', 'onion rings', 'garlic bread', 'soup', 'starter'
      ],
      '🍞 Breads': [
        'naan', 'roti', 'chapati', 'paratha', 'kulcha', 'bhatura',
        'puri', 'bread', 'bun', 'pav', 'toast', 'garlic naan',
        'butter naan', 'tandoori roti', 'rumali roti', 'laccha paratha'
      ]
    }
  },

  // GROCERY BILL CATEGORIES
  grocery: {
    categories: ['🥬 Vegetables', '🍎 Fruits', '🥛 Dairy', '🌾 Grains', '🥫 Packaged', '🧹 Household', '📦 Others'],
    keywords: {
      '🥬 Vegetables': [
        'tomato', 'potato', 'onion', 'carrot', 'cabbage', 'cauliflower',
        'spinach', 'brinjal', 'lady finger', 'capsicum', 'cucumber',
        'beans', 'peas', 'corn', 'lettuce', 'broccoli', 'mushroom',
        'ginger', 'garlic', 'green chilli', 'coriander', 'mint'
      ],
      '🍎 Fruits': [
        'apple', 'banana', 'orange', 'mango', 'grapes', 'watermelon',
        'papaya', 'pineapple', 'pomegranate', 'guava', 'kiwi', 'strawberry',
        'lemon', 'lime', 'coconut', 'fruit'
      ],
      '🥛 Dairy': [
        'milk', 'curd', 'yogurt', 'butter', 'cheese', 'paneer', 'cream',
        'ghee', 'buttermilk', 'lassi', 'ice cream', 'dairy'
      ],
      '🌾 Grains': [
        'rice', 'wheat', 'flour', 'atta', 'maida', 'sooji', 'rava',
        'dal', 'lentils', 'pulses', 'oats', 'cereal', 'bread', 'pasta'
      ],
      '🥫 Packaged': [
        'biscuit', 'chips', 'namkeen', 'snack', 'noodles', 'sauce',
        'ketchup', 'jam', 'pickle', 'oil', 'spices', 'masala', 'salt',
        'sugar', 'tea', 'coffee', 'ready to eat'
      ],
      '🧹 Household': [
        'soap', 'detergent', 'shampoo', 'toothpaste', 'cleaning',
        'tissue', 'toilet', 'cleaner', 'brush', 'mop', 'bucket'
      ]
    }
  },

  // PHARMACY BILL CATEGORIES
  pharmacy: {
    categories: ['💊 Tablets', '💉 Injections', '🧴 Syrups', '🩹 First Aid', '💪 Supplements', '📦 Others'],
    keywords: {
      '💊 Tablets': [
        'tablet', 'tab', 'capsule', 'cap', 'pill', 'paracetamol',
        'ibuprofen', 'aspirin', 'antibiotic', 'vitamin'
      ],
      '💉 Injections': [
        'injection', 'inj', 'vaccine', 'insulin', 'syringe'
      ],
      '🧴 Syrups': [
        'syrup', 'suspension', 'liquid', 'drops', 'solution', 'cough syrup'
      ],
      '🩹 First Aid': [
        'bandage', 'band-aid', 'cotton', 'dettol', 'antiseptic', 'ointment',
        'cream', 'gel', 'spray', 'thermometer', 'bp monitor'
      ],
      '💪 Supplements': [
        'vitamin', 'calcium', 'iron', 'protein', 'omega', 'multivitamin',
        'supplement', 'health drink', 'energy', 'boost'
      ]
    }
  },

  // ELECTRONICS BILL CATEGORIES
  electronics: {
    categories: ['📱 Mobile', '💻 Computing', '🎧 Audio', '📺 Display', '🔌 Accessories', '📦 Others'],
    keywords: {
      '📱 Mobile': [
        'mobile', 'phone', 'smartphone', 'iphone', 'samsung', 'oneplus',
        'xiaomi', 'redmi', 'realme', 'oppo', 'vivo', 'pixel'
      ],
      '💻 Computing': [
        'laptop', 'computer', 'pc', 'tablet', 'ipad', 'macbook',
        'keyboard', 'mouse', 'monitor', 'printer', 'scanner'
      ],
      '🎧 Audio': [
        'headphone', 'earphone', 'earbuds', 'airpods', 'speaker',
        'soundbar', 'bluetooth', 'wireless', 'microphone'
      ],
      '📺 Display': [
        'tv', 'television', 'led', 'oled', 'smart tv', 'projector',
        'screen', 'display', 'monitor'
      ],
      '🔌 Accessories': [
        'charger', 'cable', 'adapter', 'power bank', 'case', 'cover',
        'screen guard', 'tempered glass', 'stand', 'holder', 'usb'
      ]
    }
  }
};

// ============================================
// CLASSIFIER FUNCTIONS
// ============================================

/**
 * Detect the type of bill from OCR text
 * @param {string} ocrText - Raw text from OCR
 * @returns {string} - Bill type (restaurant, grocery, pharmacy, etc.)
 */
function detectBillType(ocrText) {
  const text = ocrText.toLowerCase();
  const scores = {};

  // Calculate match score for each bill type
  for (const [billType, keywords] of Object.entries(BILL_TYPE_KEYWORDS)) {
    scores[billType] = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        scores[billType] += 1;
      }
    }
  }

  // Find the bill type with highest score
  let maxScore = 0;
  let detectedType = 'restaurant'; // Default to restaurant

  for (const [billType, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = billType;
    }
  }

  // If no matches found, default to restaurant (most common for split bills)
  return maxScore > 0 ? detectedType : 'restaurant';
}

/**
 * Classify a single item into a category
 * @param {string} itemName - Name of the item
 * @param {string} billType - Type of bill
 * @returns {string} - Category name
 */
function classifyItem(itemName, billType) {
  const name = itemName.toLowerCase();
  const categoryConfig = ITEM_CATEGORIES[billType];

  if (!categoryConfig) {
    return '📦 Others';
  }

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(categoryConfig.keywords)) {
    for (const keyword of keywords) {
      if (name.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return '📦 Others';
}

/**
 * Classify all items from a parsed bill
 * @param {Array} items - Array of item objects {name, price, quantity}
 * @param {string} ocrText - Original OCR text for bill type detection
 * @returns {Object} - Classified items with metadata
 */
function classifyBillItems(items, ocrText) {
  // Detect bill type
  const billType = detectBillType(ocrText);
  const categoryConfig = ITEM_CATEGORIES[billType] || ITEM_CATEGORIES.restaurant;

  // Initialize category groups
  const categorizedItems = {};
  for (const category of categoryConfig.categories) {
    categorizedItems[category] = [];
  }

  // Classify each item
  const classifiedItems = items.map(item => {
    const category = classifyItem(item.name, billType);
    const classifiedItem = {
      ...item,
      category
    };

    // Add to category group
    if (categorizedItems[category]) {
      categorizedItems[category].push(classifiedItem);
    } else {
      categorizedItems['📦 Others'].push(classifiedItem);
    }

    return classifiedItem;
  });

  // Calculate category totals
  const categoryTotals = {};
  for (const [category, categoryItems] of Object.entries(categorizedItems)) {
    categoryTotals[category] = categoryItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0) * (item.quantity || 1);
    }, 0);
  }

  return {
    billType,
    billTypeDisplay: getBillTypeDisplay(billType),
    categories: categoryConfig.categories,
    items: classifiedItems,
    categorizedItems,
    categoryTotals,
    summary: {
      totalItems: items.length,
      categoriesUsed: Object.entries(categorizedItems)
        .filter(([_, items]) => items.length > 0)
        .map(([cat, items]) => ({ category: cat, count: items.length }))
    }
  };
}

/**
 * Get display name for bill type
 */
function getBillTypeDisplay(billType) {
  const displays = {
    restaurant: '🍽️ Restaurant / Food',
    grocery: '🛒 Grocery Store',
    pharmacy: '💊 Pharmacy / Medical',
    electronics: '📱 Electronics',
    clothing: '👕 Clothing / Apparel',
    fuel: '⛽ Fuel / Petrol',
    utility: '🏠 Utility Bill'
  };
  return displays[billType] || '📄 General Bill';
}

/**
 * Get available categories for a bill type
 */
function getCategoriesForBillType(billType) {
  const config = ITEM_CATEGORIES[billType];
  return config ? config.categories : ['📦 Others'];
}

/**
 * Add custom category for a bill type (runtime)
 */
function addCustomCategory(billType, categoryName, keywords = []) {
  if (!ITEM_CATEGORIES[billType]) {
    ITEM_CATEGORIES[billType] = { categories: [], keywords: {} };
  }
  
  if (!ITEM_CATEGORIES[billType].categories.includes(categoryName)) {
    ITEM_CATEGORIES[billType].categories.push(categoryName);
  }
  
  ITEM_CATEGORIES[billType].keywords[categoryName] = keywords;
}

module.exports = {
  detectBillType,
  classifyItem,
  classifyBillItems,
  getBillTypeDisplay,
  getCategoriesForBillType,
  addCustomCategory,
  BILL_TYPE_KEYWORDS,
  ITEM_CATEGORIES
};

