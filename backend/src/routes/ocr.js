const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Gemini OCR (Google AI)
const { extractBillWithGemini } = require('../utils/geminiOCR');
const { getCategoriesForBillType } = require('../utils/itemClassifier');

// Check Gemini configuration on startup
if (process.env.GEMINI_API_KEY) {
  console.log('Gemini: ✅ Configured (Gemini 2.5 Flash)');
} else {
  console.log('Gemini: ❌ Not configured - Add GEMINI_API_KEY to environment');
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|heic/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// POST /api/ocr/scan - Scan a bill image using Gemini
router.post('/scan', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No image file provided' 
      });
    }

    // Check if Gemini is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OCR not configured. Please add GEMINI_API_KEY to environment.'
      });
    }

    const imagePath = req.file.path;

    try {
      console.log('🔵 Processing image with Gemini 2.5 Flash...');
      const billData = await extractBillWithGemini(imagePath);
      console.log('✅ OCR Success!');
      
      return res.json({
        success: true,
        confidence: 95,
        bill: billData,
        engine: 'gemini'
      });

    } catch (ocrError) {
      console.error('❌ OCR failed:', ocrError.message);
      return res.status(500).json({
        success: false,
        error: `OCR processing failed: ${ocrError.message}`
      });
    } finally {
      // Cleanup uploaded file
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

  } catch (error) {
    console.error('OCR Error:', error);
    next(error);
  }
});

// GET /api/ocr/categories/:billType - Get available categories for a bill type
router.get('/categories/:billType', (req, res) => {
  const { billType } = req.params;
  const categories = getCategoriesForBillType(billType);
  
  res.json({
    success: true,
    billType,
    categories
  });
});

// GET /api/ocr/bill-types - Get all supported bill types
router.get('/bill-types', (req, res) => {
  const billTypes = [
    { id: 'restaurant', name: '🍽️ Restaurant / Food', description: 'Veg, Non-Veg, Beverages, Desserts' },
    { id: 'grocery', name: '🛒 Grocery Store', description: 'Vegetables, Fruits, Dairy, Grains' },
    { id: 'pharmacy', name: '💊 Pharmacy / Medical', description: 'Tablets, Syrups, First Aid' },
    { id: 'electronics', name: '📱 Electronics', description: 'Mobile, Computing, Audio, Accessories' },
    { id: 'clothing', name: '👕 Clothing / Apparel', description: 'By type and brand' },
    { id: 'fuel', name: '⛽ Fuel / Petrol', description: 'Fuel type and quantity' },
    { id: 'utility', name: '🏠 Utility Bill', description: 'Electricity, Water, Internet' }
  ];

  res.json({
    success: true,
    billTypes
  });
});

module.exports = router;
