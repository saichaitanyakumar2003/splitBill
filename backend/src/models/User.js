const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Primary Key - Email ID
  mailId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  
  // User's full name
  name: {
    type: String,
    required: true,
    trim: true,
  },
  
  // Password (hashed, not plain text)
  pswd: {
    type: String,
    required: false, // Not required for OAuth users
    select: false, // Don't return password by default in queries
  },
  
  // Profile image stored as Base64 encoded string
  profile_image: {
    type: String,
    default: null,
  },
  
  // Phone number
  phone_number: {
    type: String,
    default: null,
    trim: true,
  },
  
  // List of Group IDs the user belongs to
  group_ids: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Group',
    default: [],
  },
  
  // Session expiration timestamp
  session_expires_at: {
    type: Date,
    default: null,
  },
  
  // OAuth provider (if user signed up via OAuth)
  oauth_provider: {
    type: String,
    enum: ['google', 'apple', 'email', null],
    default: null,
  },
  
  // OAuth provider user ID
  oauth_id: {
    type: String,
    default: null,
  },
  
  // Account creation timestamp
  created_at: {
    type: Date,
    default: Date.now,
  },
  
  // Last updated timestamp
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Update the updated_at field before saving
userSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Index for faster queries
userSchema.index({ oauth_provider: 1, oauth_id: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;

