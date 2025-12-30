/**
 * Database Initialization Script
 * Creates collections and indexes for SplitBill
 * 
 * Run: node src/scripts/initDb.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection string - supports both MONGODB_URL and MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URL or MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Import models to register schemas
const User = require('../models/User');
const Group = require('../models/Group');

async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 URI: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs
    
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected to MongoDB successfully!\n');
    
    // Get database name
    const dbName = mongoose.connection.db.databaseName;
    console.log(`📊 Database: ${dbName}\n`);
    
    // ========================================
    // Create Users Collection & Indexes
    // ========================================
    console.log('📦 Setting up Users collection...');
    
    // Ensure indexes are created
    await User.createIndexes();
    
    // List indexes
    const userIndexes = await User.collection.indexes();
    console.log('   Indexes created:');
    userIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    // Get collection stats
    const userCount = await User.countDocuments();
    console.log(`   Documents: ${userCount}`);
    
    // Migrate existing users - add friends field if missing
    const migrateResult = await User.updateMany(
      { friends: { $exists: false } },
      { $set: { friends: [] } }
    );
    if (migrateResult.modifiedCount > 0) {
      console.log(`   ✅ Migrated ${migrateResult.modifiedCount} users (added friends field)`);
    }
    console.log('');
    
    // ========================================
    // Create Groups Collection & Indexes
    // ========================================
    console.log('📦 Setting up Groups collection...');
    
    // Ensure indexes are created (including TTL index)
    await Group.createIndexes();
    
    // Create TTL index for auto-deletion
    try {
      await Group.collection.createIndex(
        { expires_at: 1 },
        { expireAfterSeconds: 0, name: 'ttl_expires_at' }
      );
      console.log('   ✅ TTL index created for auto-deletion');
    } catch (err) {
      if (err.code === 85) {
        console.log('   ℹ️ TTL index already exists');
      } else {
        throw err;
      }
    }
    
    // List indexes
    const groupIndexes = await Group.collection.indexes();
    console.log('   Indexes created:');
    groupIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    // Get collection stats
    const groupCount = await Group.countDocuments();
    console.log(`   Documents: ${groupCount}\n`);
    
    // ========================================
    // Summary
    // ========================================
    console.log('═══════════════════════════════════════');
    console.log('✅ Database initialization complete!');
    console.log('═══════════════════════════════════════\n');
    
    console.log('📋 Collections created:');
    console.log('   1. users    - Stores user profiles and sessions');
    console.log('   2. groups   - Stores bill splitting groups\n');
    
    console.log('🔑 Schema Summary:');
    console.log('');
    console.log('   USERS:');
    console.log('   ├─ mailId (PK, unique, indexed)');
    console.log('   ├─ name');
    console.log('   ├─ pswd (hashed, hidden by default)');
    console.log('   ├─ profile_image (base64)');
    console.log('   ├─ phone_number');
    console.log('   ├─ group_ids (array of ObjectIds)');
    console.log('   ├─ friends (array of mail IDs)');
    console.log('   ├─ session_expires_at');
    console.log('   ├─ oauth_provider');
    console.log('   └─ oauth_id');
    console.log('');
    console.log('   GROUPS:');
    console.log('   ├─ _id (PK, auto-generated)');
    console.log('   ├─ name');
    console.log('   ├─ active (boolean)');
    console.log('   ├─ edges [{payer, payee, amount}]');
    console.log('   ├─ members (array of emails)');
    console.log('   ├─ created_by');
    console.log('   └─ expires_at (TTL: 3 months active, 1 sec inactive)');
    console.log('');
    
    console.log('🚀 Your database is ready to use!');
    console.log('   Start the server: npm run dev\n');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run initialization
initializeDatabase();

