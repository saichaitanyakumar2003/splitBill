const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { compressData, decompressData } = require('../utils/compression');

const UserSchema = new mongoose.Schema({
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

  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  pswd: {
    type: String,
    required: [true, 'Password is required'],
    select: false
  },

  tempPassword: {
    type: String,
    select: false,
    default: null
  },

  tempPasswordExpiry: {
    type: Date,
    default: null
  },

  compressedDetails: {
    type: Buffer,
    required: true
  },

  sessionExpiresAt: {
    type: Date,
    default: null
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

UserSchema.index({ name: 'text', _id: 'text' });

UserSchema.statics.hashPassword = async function(password) {
  return bcrypt.hash(password, 12);
};

UserSchema.statics.createUser = async function(mailId, password, details) {
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

UserSchema.statics.findByMailIdWithPassword = function(mailId) {
  return this.findById(mailId.toLowerCase().trim()).select('+pswd +tempPassword +tempPasswordExpiry');
};

UserSchema.statics.searchUsers = async function(query, excludeMailId = null, limit = 20, filterPreviousMails = false) {
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

  const users = await this.find(filter).limit(limit * 2); // Fetch more to account for filtering
  
  let results = users.map(user => {
    const details = user.getDetails();
    return {
      mailId: user._id,
      name: user.name,
      previous_mails: details.previous_mails || []
    };
  });
  
  // Filter out users whose previous_mails contains the search query (for payer search)
  if (filterPreviousMails) {
    const queryLower = query.toLowerCase();
    results = results.filter(user => {
      // Keep user if none of their previous_mails match the query
      return !user.previous_mails.some(pm => pm.toLowerCase().includes(queryLower));
    });
  }
  
  // Remove previous_mails from response and limit results
  return results.slice(0, limit).map(({ mailId, name }) => ({ mailId, name }));
};

UserSchema.methods.verifyPassword = async function(password) {
  // First check original password
  const originalMatch = await bcrypt.compare(password, this.pswd);
  if (originalMatch) {
    return { valid: true, usedTempPassword: false };
  }
  
  // If original password doesn't match, check temporary password
  if (this.tempPassword && this.tempPasswordExpiry) {
    // Check if temp password has expired
    if (new Date() > this.tempPasswordExpiry) {
      // Temp password expired, clear it
      this.tempPassword = null;
      this.tempPasswordExpiry = null;
      await this.save();
      return { valid: false, usedTempPassword: false };
    }
    
    // Check temp password
    const tempMatch = await bcrypt.compare(password, this.tempPassword);
    if (tempMatch) {
      return { valid: true, usedTempPassword: true };
    }
  }
  
  return { valid: false, usedTempPassword: false };
};

// Method to set temporary password with expiry (30 minutes)
UserSchema.methods.setTempPassword = async function(tempPassword) {
  this.tempPassword = await bcrypt.hash(tempPassword, 12);
  this.tempPasswordExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  await this.save();
};

// Method to clear temporary password (after user changes password)
UserSchema.methods.clearTempPassword = async function() {
  this.tempPassword = null;
  this.tempPasswordExpiry = null;
  await this.save();
};

UserSchema.methods.getDetails = function() {
  const compressed = this.compressedDetails ? decompressData(this.compressedDetails) : {};
  return {
    name: this.name || '',
    phone: compressed.phone || '',
    upiId: compressed.upiId || '',
    groupIds: compressed.groupIds || [],
    friends: compressed.friends || [],
    expoPushToken: compressed.expoPushToken || null,
    previous_mails: compressed.previous_mails || []
  };
};

UserSchema.methods.getGroupIds = function() {
  const details = this.getDetails();
  return details.groupIds || [];
};

UserSchema.methods.setExpoPushToken = function(token) {
  const details = this.getDetails();
  const current = this.compressedDetails ? decompressData(this.compressedDetails) : {};
  current.expoPushToken = token;
  this.compressedDetails = compressData(current);
  this.updatedAt = new Date();
};

UserSchema.methods.setDetails = function(details) {
  if (details.name !== undefined) {
    this.name = details.name;
  }
  
  const current = this.compressedDetails ? decompressData(this.compressedDetails) : {};
  
  if (details.phone !== undefined && details.phone !== null) {
    const digits = String(details.phone).replace(/\D/g, '');
    if (digits.length > 0 && digits.length !== 10) {
      throw new Error('Phone number must be exactly 10 digits');
    }
    current.phone = digits;
  }
  
  if (details.upiId !== undefined) {
    current.upiId = details.upiId || '';
  }
  
  if (details.groupIds !== undefined) {
    current.groupIds = details.groupIds;
  }
  
  if (details.friends !== undefined) {
    current.friends = details.friends;
  }
  
  if (details.previous_mails !== undefined) {
    current.previous_mails = details.previous_mails;
  }
  
  this.compressedDetails = compressData(current);
  this.updatedAt = new Date();
};

UserSchema.methods.addPreviousMail = function(mailId) {
  const details = this.getDetails();
  const normalizedEmail = mailId.toLowerCase().trim();
  
  if (!details.previous_mails.includes(normalizedEmail)) {
    details.previous_mails.push(normalizedEmail);
    const current = this.compressedDetails ? decompressData(this.compressedDetails) : {};
    current.previous_mails = details.previous_mails;
    this.compressedDetails = compressData(current);
    this.updatedAt = new Date();
    return true;
  }
  return false;
};

UserSchema.methods.removePreviousMail = function(mailId) {
  const details = this.getDetails();
  const normalizedEmail = mailId.toLowerCase().trim();
  const originalLength = details.previous_mails.length;
  
  details.previous_mails = details.previous_mails.filter(m => m !== normalizedEmail);
  
  if (details.previous_mails.length !== originalLength) {
    const current = this.compressedDetails ? decompressData(this.compressedDetails) : {};
    current.previous_mails = details.previous_mails;
    this.compressedDetails = compressData(current);
    this.updatedAt = new Date();
    return true;
  }
  return false;
};

UserSchema.methods.addGroupId = function(groupId) {
  const details = this.getDetails();
  const groupIdStr = String(groupId);
  
  const isDuplicate = details.groupIds.some(id => String(id) === groupIdStr);
  
  if (!isDuplicate) {
    details.groupIds.push(groupIdStr);
    this.compressedDetails = compressData({
      phone: details.phone,
      upiId: details.upiId,
      groupIds: details.groupIds,
      friends: details.friends,
      expoPushToken: details.expoPushToken
    });
    this.updatedAt = new Date();
    return true;
  }
  return false;
};

UserSchema.methods.removeGroupId = function(groupId) {
  const details = this.getDetails();
  const groupIdStr = String(groupId);
  const originalLength = details.groupIds.length;
  
  details.groupIds = details.groupIds.filter(id => String(id) !== groupIdStr);
  
  if (details.groupIds.length !== originalLength) {
    this.compressedDetails = compressData({
      phone: details.phone,
      upiId: details.upiId,
      groupIds: details.groupIds,
      friends: details.friends,
      expoPushToken: details.expoPushToken
    });
    this.updatedAt = new Date();
    return true;
  }
  return false;
};

const MAX_FAVORITES = 20;

UserSchema.methods.addFriend = function(friendMailId) {
  const details = this.getDetails();
  const normalizedEmail = friendMailId.toLowerCase().trim();
  
  if (details.friends.length >= MAX_FAVORITES) {
    throw new Error(`Maximum ${MAX_FAVORITES} favorites allowed`);
  }
  
  if (!details.friends.includes(normalizedEmail)) {
    details.friends.push(normalizedEmail);
    this.compressedDetails = compressData({
      phone: details.phone,
      upiId: details.upiId,
      groupIds: details.groupIds,
      friends: details.friends,
      expoPushToken: details.expoPushToken
    });
    this.updatedAt = new Date();
  }
};

UserSchema.methods.removeFriend = function(friendMailId) {
  const details = this.getDetails();
  details.friends = details.friends.filter(f => f !== friendMailId.toLowerCase().trim());
  this.compressedDetails = compressData({
    phone: details.phone,
    upiId: details.upiId,
    groupIds: details.groupIds,
    friends: details.friends,
    expoPushToken: details.expoPushToken
  });
  this.updatedAt = new Date();
};

UserSchema.methods.toJSON = function() {
  const details = this.getDetails();
  return {
    mailId: this._id,
    name: this.name,
    phone: details.phone,
    upiId: details.upiId,
    groupIds: details.groupIds,
    friends: details.friends,
    previous_mails: details.previous_mails,
    sessionExpiresAt: this.sessionExpiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', UserSchema);
