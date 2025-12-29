const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { parseBillText } = require('../utils/billParser');
const { classifyBillItems, getCategoriesForBillType } = require('../utils/itemClassifier');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
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

// Preprocess image for better OCR results
async function preprocessImage(imagePath) {
  const processedPath = imagePath.replace(/\.[^.]+$/, '_processed.png');
  
  await sharp(imagePath)
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(128)
    .toFile(processedPath);
  
  return processedPath;
}

// POST /api/ocr/scan - Scan a bill image and extract items
router.post('/scan', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imagePath = req.file.path;
    let processedPath = null;

    try {
      // Preprocess image for better OCR
      processedPath = await preprocessImage(imagePath);

      // Perform OCR
      const { data: { text, confidence } } = await Tesseract.recognize(
        processedPath,
        'eng',
        {
          logger: m => console.log(`OCR Progress: ${m.status} - ${Math.round(m.progress * 100)}%`)
        }
      );

      console.log('OCR Result:', text);
      console.log('Confidence:', confidence);

      // Parse the extracted text to find bill items
      const parsedBill = parseBillText(text);

      // Classify items into dynamic categories based on bill type
      const classifiedData = classifyBillItems(parsedBill.items, text);

      res.json({
        success: true,
        rawText: text,
        confidence,
        bill: {
          ...parsedBill,
          ...classifiedData
        }
      });

    } finally {
      // Cleanup uploaded files
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      if (processedPath && fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
    }

  } catch (error) {
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

