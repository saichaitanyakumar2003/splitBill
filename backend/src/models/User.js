const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { compressData, decompressData } = require('../utils/compression');

/**
 * User Model
 * 
 * Schema:
 * - _id (PK): mail id (email) - indexed
 * - name: string (indexed for search)
 * - pswd: password hash
 * - compressedDetails: brotli compressed buffer containing:
 *   - phone: string (exactly 10 digits, validated)
 *   - groupIds: string[] (list of group IDs)
 *   - friends: string[] (list of friend mail IDs)
 * - sessionExpiresAt: Date
 */

const UserSchema = new mongoose.Schema({
  // Primary Key - Mail ID (email)
  _id: {
    type: String,
    required: [true, 'Mail ID is required'],
    lowercase: true,
    trim: true,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  },

  // Name - stored separately for indexing/search
  name: {
    type: String,
    required: true,
    trim: true,
    index: true // Index for efficient search
  },

  // Password hash
  pswd: {
    type: String,
    required: [true, 'Password is required'],
    select: false // Don't include in queries by default
  },

  // Compressed details (brotli) - contains phone, groupIds, friends
  compressedDetails: {
    type: Buffer,
    required: true
  },

  // Session expires at
  sessionExpiresAt: {
    type: Date,
    default: null
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Text index for full-text search on name and email
UserSchema.index({ name: 'text', _id: 'text' });

// ============ Static Methods ============

// Hash password
UserSchema.statics.hashPassword = async function(password) {
  return bcrypt.hash(password, 12);
};

// Create new user
UserSchema.statics.createUser = async function(mailId, password, details) {
  // Validate phone if provided (allow empty or exactly 10 digits)
  if (details.phone) {
    const digits = details.phone.replace(/\D/g, '');
    if (digits.length > 0 && digits.length !== 10) {
      throw new Error('Phone number must be exactly 10 digits');
    }
    details.phone = digits;
  }

  const user = new this({
    _id: mailId.toLowerCase().trim(),
    name: details.name || '',
    pswd: await this.hashPassword(password),
    compressedDetails: compressData({
      phone: details.phone || '',
      groupIds: details.groupIds || [],
      friends: details.friends || []
    })
  });
  return user.save();
};

// Find by mail ID with password included
UserSchema.statics.findByMailIdWithPassword = function(mailId) {
  return this.findById(mailId.toLowerCase().trim()).select('+pswd');
};

// Search users by name or email - uses index
UserSchema.statics.searchUsers = async function(query, excludeMailId = null, limit = 20) {
  const regex = new RegExp(query, 'i');
  
  const filter = {
    $or: [
      { name: regex },
      { _id: regex }
    ]
  };
  
  if (excludeMailId) {
    filter._id = { ...filter._id, $ne: excludeMailId };
  }

  const users = await this.find(filter).limit(limit);
  
  return users.map(user => ({
    mailId: user._id,
    name: user.name
  }));
};

// ============ Instance Methods ============

// Verify password
UserSchema.methods.verifyPassword = async function(password) {
  return bcrypt.compare(password, this.pswd);
};

// Get decompressed details (includes name from separate field)
UserSchema.methods.getDetails = function() {
  const compressed = this.compressedDetails ? decompressData(this.compressedDetails) : {};
  return {
    name: this.name || '',
    phone: compressed.phone || '',
    groupIds: compressed.groupIds || [],
    friends: compressed.friends || [],
    expoPushToken: compressed.expoPushToken || null
  };
};

// Set Expo push token for notifications
UserSchema.methods.setExpoPushToken = function(token) {
  const details = this.getDetails();
  const current = this.compressedDetails ? decompressData(this.compressedDetails) : {};
  current.expoPushToken = token;
  this.compressedDetails = compressData(current);
  this.updatedAt = new Date();
};

// Set details with phone validation (10 digits only, or empty)
UserSchema.methods.setDetails = function(details) {
  // Update name separately (indexed field)
  if (details.name !== undefined) {
    this.name = details.name;
  }
  
  // Get current compressed data
  const current = this.compressedDetails ? decompressData(this.compressedDetails) : {};
  
  if (details.phone !== undefined && details.phone !== null) {
    const digits = String(details.phone).replace(/\D/g, '');
    // Allow empty phone or exactly 10 digits
    if (digits.length > 0 && digits.length !== 10) {
      throw new Error('Phone number must be exactly 10 digits');
    }
    current.phone = digits;
  }
  
  if (details.groupIds !== undefined) {
    current.groupIds = details.groupIds;
  }
  
  if (details.friends !== undefined) {
    current.friends = details.friends;
  }
  
  this.compressedDetails = compressData(current);
  this.updatedAt = new Date();
};

// Add group ID to user's list (ensures uniqueness)
UserSchema.methods.addGroupId = function(groupId) {
  const details = this.getDetails();
  const groupIdStr = String(groupId); // Normalize to string
  
  // Ensure no duplicates - check both as-is and as string
  const isDuplicate = details.groupIds.some(id => String(id) === groupIdStr);
  
  if (!isDuplicate) {
    details.groupIds.push(groupIdStr);
    this.compressedDetails = compressData({
      phone: details.phone,
      groupIds: details.groupIds,
      friends: details.friends
    });
    this.updatedAt = new Date();
    return true; // Added successfully
  }
  return false; // Already exists
};

// Remove group ID from user's list
UserSchema.methods.removeGroupId = function(groupId) {
  const details = this.getDetails();
  const groupIdStr = String(groupId); // Normalize to string
  const originalLength = details.groupIds.length;
  
  details.groupIds = details.groupIds.filter(id => String(id) !== groupIdStr);
  
  if (details.groupIds.length !== originalLength) {
    this.compressedDetails = compressData({
      phone: details.phone,
      groupIds: details.groupIds,
      friends: details.friends
    });
    this.updatedAt = new Date();
    return true; // Removed successfully
  }
  return false; // Was not in list
};

// Max favorites limit
const MAX_FAVORITES = 20;

// Add friend mail ID
UserSchema.methods.addFriend = function(friendMailId) {
  const details = this.getDetails();
  const normalizedEmail = friendMailId.toLowerCase().trim();
  
  // Check max limit
  if (details.friends.length >= MAX_FAVORITES) {
    throw new Error(`Maximum ${MAX_FAVORITES} favorites allowed`);
  }
  
  if (!details.friends.includes(normalizedEmail)) {
    details.friends.push(normalizedEmail);
    this.compressedDetails = compressData({
      phone: details.phone,
      groupIds: details.groupIds,
      friends: details.friends
    });
    this.updatedAt = new Date();
  }
};

// Remove friend mail ID
UserSchema.methods.removeFriend = function(friendMailId) {
  const details = this.getDetails();
  details.friends = details.friends.filter(f => f !== friendMailId.toLowerCase().trim());
  this.compressedDetails = compressData({
    phone: details.phone,
    groupIds: details.groupIds,
    friends: details.friends
  });
  this.updatedAt = new Date();
};

// JSON output
UserSchema.methods.toJSON = function() {
  const details = this.getDetails();
  return {
    mailId: this._id,
    name: this.name,
    phone: details.phone,
    groupIds: details.groupIds,
    friends: details.friends,
    sessionExpiresAt: this.sessionExpiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', UserSchema);
