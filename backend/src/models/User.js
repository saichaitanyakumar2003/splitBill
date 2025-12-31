const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { compressData, decompressData } = require('../utils/compression');

/**
 * User Model
 * 
 * Schema:
 * - _id (PK): mail id (email)
 * - pswd: password hash
 * - compressedDetails: brotli compressed buffer containing:
 *   - name: string
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

  // Password hash
  pswd: {
    type: String,
    required: [true, 'Password is required'],
    select: false // Don't include in queries by default
  },

  // Compressed details (brotli) - contains name, phone, groupIds, friends
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
    pswd: await this.hashPassword(password),
    compressedDetails: compressData({
      name: details.name || '',
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

// ============ Instance Methods ============

// Verify password
UserSchema.methods.verifyPassword = async function(password) {
  return bcrypt.compare(password, this.pswd);
};

// Get decompressed details
UserSchema.methods.getDetails = function() {
  if (!this.compressedDetails) return { name: '', phone: '', groupIds: [], friends: [] };
  return decompressData(this.compressedDetails);
};

// Set details with phone validation (10 digits only, or empty)
UserSchema.methods.setDetails = function(details) {
  if (details.phone !== undefined && details.phone !== null) {
    const digits = String(details.phone).replace(/\D/g, '');
    // Allow empty phone or exactly 10 digits
    if (digits.length > 0 && digits.length !== 10) {
      throw new Error('Phone number must be exactly 10 digits');
    }
    details.phone = digits;
  }
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
};

// Add group ID to user's list
UserSchema.methods.addGroupId = function(groupId) {
  const details = this.getDetails();
  if (!details.groupIds.includes(groupId)) {
    details.groupIds.push(groupId);
    this.compressedDetails = compressData(details);
    this.updatedAt = new Date();
  }
};

// Remove group ID from user's list
UserSchema.methods.removeGroupId = function(groupId) {
  const details = this.getDetails();
  details.groupIds = details.groupIds.filter(id => id !== groupId);
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
};

// Add friend mail ID
UserSchema.methods.addFriend = function(friendMailId) {
  const details = this.getDetails();
  const normalizedEmail = friendMailId.toLowerCase().trim();
  if (!details.friends.includes(normalizedEmail)) {
    details.friends.push(normalizedEmail);
    this.compressedDetails = compressData(details);
    this.updatedAt = new Date();
  }
};

// Remove friend mail ID
UserSchema.methods.removeFriend = function(friendMailId) {
  const details = this.getDetails();
  details.friends = details.friends.filter(f => f !== friendMailId.toLowerCase().trim());
  this.compressedDetails = compressData(details);
  this.updatedAt = new Date();
};

// JSON output
UserSchema.methods.toJSON = function() {
  const details = this.getDetails();
  return {
    mailId: this._id,
    name: details.name,
    phone: details.phone,
    groupIds: details.groupIds,
    friends: details.friends,
    sessionExpiresAt: this.sessionExpiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', UserSchema);
