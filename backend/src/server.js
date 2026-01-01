// SplitBill Backend Server v1.0.1
// Deployed via GitHub Actions → Render
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import MongoDB connection
const { connectDB, getConnectionStatus } = require('./utils/mongodb');

// Import routes
const ocrRoutes = require('./routes/ocr');
const billRoutes = require('./routes/bills');
const groupRoutes = require('./routes/groups');
const authRoutes = require('./routes/auth');

// Import middleware
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
// Auth routes - some public (login, register), some protected (handled inside)
app.use('/api/auth', authRoutes);

// Protected routes - require valid JWT token
app.use('/api/ocr', authenticate, ocrRoutes);
app.use('/api/bills', authenticate, billRoutes);
app.use('/api/groups', authenticate, groupRoutes);

// Health check with DB status
app.get('/health', (req, res) => {
  const dbStatus = getConnectionStatus();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SplitBill API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      ocr: '/api/ocr',
      bills: '/api/bills',
      groups: '/api/groups',
      health: '/health',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server with MongoDB connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 SplitBill server running on port ${PORT}`);
      console.log(`📍 API available at http://localhost:${PORT}`);
      console.log(`💚 Health check at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    // Start server anyway even if DB connection fails
    // This allows health checks to work
    app.listen(PORT, () => {
      console.log(`⚠️ SplitBill server running on port ${PORT} (without database)`);
    });
  }
};

startServer();
