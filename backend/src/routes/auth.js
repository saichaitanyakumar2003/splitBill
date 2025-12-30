const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'splitbill-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SESSION_DURATION_DAYS = parseInt(process.env.SESSION_DURATION_DAYS) || 7;

/**
 * Helper: Calculate session expiration date
 */
const getSessionExpiration = () => {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
};

/**
 * Helper: Generate JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      mailId: user.mailId,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone_number } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ mailId: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please login instead.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      mailId: email.toLowerCase(),
      name,
      pswd: hashedPassword,
      phone_number: phone_number || null,
      oauth_provider: 'email',
      session_expires_at: getSessionExpiration(),
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          mailId: user.mailId,
          name: user.name,
          phone_number: user.phone_number,
          profile_image: user.profile_image,
          session_expires_at: user.session_expires_at,
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user and include password field
    const user = await User.findOne({ mailId: email.toLowerCase() }).select('+pswd');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No account found with this email. Please sign up first.',
      });
    }

    // Check if user has a password (not OAuth-only user)
    if (!user.pswd) {
      return res.status(401).json({
        success: false,
        message: 'This account was created with Google/Apple. Please use social login.',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.pswd);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.',
      });
    }

    // Update session expiration
    user.session_expires_at = getSessionExpiration();
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          mailId: user.mailId,
          name: user.name,
          phone_number: user.phone_number,
          profile_image: user.profile_image,
          group_ids: user.group_ids,
          session_expires_at: user.session_expires_at,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/google
 * Authenticate with Google OAuth
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required',
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Find or create user
    let user = await User.findOne({ mailId: email.toLowerCase() });

    if (user) {
      // Update existing user's session and OAuth info
      user.session_expires_at = getSessionExpiration();
      if (!user.oauth_provider) {
        user.oauth_provider = 'google';
        user.oauth_id = googleId;
      }
      if (picture && !user.profile_image) {
        user.profile_image = picture;
      }
      await user.save();
    } else {
      // Create new user
      user = new User({
        mailId: email.toLowerCase(),
        name,
        oauth_provider: 'google',
        oauth_id: googleId,
        profile_image: picture || null,
        session_expires_at: getSessionExpiration(),
      });
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        token,
        user: {
          mailId: user.mailId,
          name: user.name,
          phone_number: user.phone_number,
          profile_image: user.profile_image,
          group_ids: user.group_ids,
          session_expires_at: user.session_expires_at,
        },
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Error authenticating with Google',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/apple
 * Authenticate with Apple OAuth
 */
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, email, fullName } = req.body;

    if (!identityToken) {
      return res.status(400).json({
        success: false,
        message: 'Apple identity token is required',
      });
    }

    // Note: In production, you should verify the Apple token
    // For now, we'll trust the token and use the provided email

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for Apple authentication',
      });
    }

    // Find or create user
    let user = await User.findOne({ mailId: email.toLowerCase() });

    if (user) {
      // Update existing user's session
      user.session_expires_at = getSessionExpiration();
      if (!user.oauth_provider) {
        user.oauth_provider = 'apple';
      }
      await user.save();
    } else {
      // Create new user
      const name = fullName 
        ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() 
        : email.split('@')[0];

      user = new User({
        mailId: email.toLowerCase(),
        name: name || 'Apple User',
        oauth_provider: 'apple',
        session_expires_at: getSessionExpiration(),
      });
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Apple authentication successful',
      data: {
        token,
        user: {
          mailId: user.mailId,
          name: user.name,
          phone_number: user.phone_number,
          profile_image: user.profile_image,
          group_ids: user.group_ids,
          session_expires_at: user.session_expires_at,
        },
      },
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Error authenticating with Apple',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh session (extend session_expires_at)
 */
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user and update session
    const user = await User.findOne({ mailId: decoded.mailId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update session expiration
    user.session_expires_at = getSessionExpiration();
    await user.save();

    // Generate new token
    const newToken = generateToken(user);

    res.json({
      success: true,
      message: 'Session refreshed',
      data: {
        token: newToken,
        session_expires_at: user.session_expires_at,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (invalidate session)
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user and invalidate session
    const user = await User.findOne({ mailId: decoded.mailId });
    if (user) {
      user.session_expires_at = new Date(0); // Set to past date
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if token is invalid, respond with success
    res.json({
      success: true,
      message: 'Logged out',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user
    const user = await User.findOne({ mailId: decoded.mailId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if session is expired
    if (user.session_expires_at && new Date() > user.session_expires_at) {
      return res.status(401).json({
        success: false,
        message: 'Session expired',
      });
    }

    res.json({
      success: true,
      data: {
        mailId: user.mailId,
        name: user.name,
        phone_number: user.phone_number,
        profile_image: user.profile_image,
        group_ids: user.group_ids,
        session_expires_at: user.session_expires_at,
        oauth_provider: user.oauth_provider,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile (name, phone_number, profile_image)
 * Note: Email (mailId) cannot be changed
 */
router.put('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user
    const user = await User.findOne({ mailId: decoded.mailId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { name, phone_number, profile_image } = req.body;

    // Update allowed fields only (NOT mailId/email)
    if (name !== undefined) user.name = name;
    if (phone_number !== undefined) user.phone_number = phone_number;
    if (profile_image !== undefined) user.profile_image = profile_image;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        mailId: user.mailId,
        name: user.name,
        phone_number: user.phone_number,
        profile_image: user.profile_image,
        group_ids: user.group_ids,
        session_expires_at: user.session_expires_at,
        oauth_provider: user.oauth_provider,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
    });
  }
});

/**
 * PUT /api/auth/password
 * Change user password
 */
router.put('/password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findOne({ mailId: decoded.mailId }).select('+pswd');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    // If user has existing password, verify current password
    if (user.pswd) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required',
        });
      }
      
      const isMatch = await bcrypt.compare(currentPassword, user.pswd);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.pswd = await bcrypt.hash(newPassword, salt);
    user.oauth_provider = user.oauth_provider || 'email';
    
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
    });
  }
});

module.exports = router;

