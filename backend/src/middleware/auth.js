const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'splitbill-secret-key';

/**
 * Authentication middleware - validates JWT token
 * Adds user info to req.user if valid
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login.',
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.',
      });
    }
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
      });
    }
    
    // Check if user exists
    const user = await User.findById(decoded.mailId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.',
      });
    }
    
    // Check session expiration
    const userDetails = user.getDetails();
    if (user.sessionExpiresAt && new Date() > new Date(user.sessionExpiresAt)) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.',
      });
    }
    
    // Add user info to request
    req.user = {
      mailId: user._id,
      name: user.name,
      phone: userDetails.phone,
    };
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Just adds user info if token is valid
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.mailId);
      
      if (user) {
        req.user = {
          mailId: user._id,
          name: user.name,
        };
        req.token = token;
      }
    } catch (err) {
      // Ignore token errors for optional auth
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = { authenticate, optionalAuth };

