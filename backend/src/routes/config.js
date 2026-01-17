const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/config/ocr
 * Returns OCR configuration (Gemini API key) for authenticated users
 * This allows client-side OCR processing for better latency
 */
router.get('/ocr', authenticate, (req, res) => {
  console.log('🔑 GET /api/config/ocr - User:', req.user?.mailId);
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY not configured');
    return res.status(503).json({
      success: false,
      error: 'OCR service not configured'
    });
  }

  console.log('✅ Returning Gemini API key');
  res.json({
    success: true,
    data: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: apiKey
    }
  });
});

module.exports = router;
