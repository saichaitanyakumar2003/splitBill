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
  return this.findById(mailId.toLowerCase().trim()).select('+pswd');
};

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

UserSchema.methods.verifyPassword = async function(password) {
  return bcrypt.compare(password, this.pswd);
};

UserSchema.methods.getDetails = function() {
  const compressed = this.compressedDetails ? decompressData(this.compressedDetails) : {};
  return {
    name: this.name || '',
    phone: compressed.phone || '',
    upiId: compressed.upiId || '',
    groupIds: compressed.groupIds || [],
    friends: compressed.friends || [],
    expoPushToken: compressed.expoPushToken || null
  };
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
  
  this.compressedDetails = compressData(current);
  this.updatedAt = new Date();
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
    sessionExpiresAt: this.sessionExpiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', UserSchema);
