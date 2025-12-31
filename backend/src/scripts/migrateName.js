/**
 * Migration Script: Move name field outside of compressedDetails
 * 
 * Run: node src/scripts/migrateName.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { compressData, decompressData } = require('../utils/compression');

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/splitbill';

async function migrate() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Get all users
    const users = await usersCollection.find({}).toArray();
    console.log(`📦 Found ${users.length} users to migrate\n`);

    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if already has name field outside
      if (user.name && typeof user.name === 'string') {
        console.log(`⏭️  Skipping ${user._id} - already has name field`);
        skipped++;
        continue;
      }

      // Decompress details to get name
      let details = {};
      if (user.compressedDetails) {
        try {
          details = decompressData(user.compressedDetails);
        } catch (e) {
          console.log(`⚠️  Could not decompress ${user._id}, setting empty name`);
          details = {};
        }
      }

      const name = details.name || user._id.split('@')[0]; // Fallback to email prefix

      // Create new compressed details without name
      const newCompressedDetails = compressData({
        phone: details.phone || '',
        groupIds: details.groupIds || [],
        friends: details.friends || []
      });

      // Update user
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            name: name,
            compressedDetails: newCompressedDetails
          }
        }
      );

      console.log(`✅ Migrated ${user._id} -> name: "${name}"`);
      migrated++;
    }

    console.log('\n========================================');
    console.log(`✅ Migration complete!`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

migrate();

