/**
 * Migration script to compress existing EditHistory records
 * Run with: npm run migrate:editHistory (from backend folder)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const EditHistory = require('../models/EditHistory');

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/splitbill';

async function migrate() {
  console.log('Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    console.log('\nStarting EditHistory compression migration...');
    
    // Get count of records that need migration
    const totalUncompressed = await EditHistory.countDocuments({
      compressedDetails: null,
      details: { $exists: true, $ne: null }
    });
    
    console.log(`Found ${totalUncompressed} records to migrate`);
    
    if (totalUncompressed === 0) {
      console.log('No records to migrate. All records are already compressed.');
      return;
    }
    
    // Run migration
    const result = await EditHistory.migrateToCompressed();
    
    console.log('\n--- Migration Complete ---');
    console.log(`Successfully migrated: ${result.migrated}`);
    console.log(`Errors: ${result.errors}`);
    
    // Verify
    const remainingUncompressed = await EditHistory.countDocuments({
      compressedDetails: null,
      details: { $exists: true, $ne: null }
    });
    
    console.log(`\nRemaining uncompressed records: ${remainingUncompressed}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

migrate();
