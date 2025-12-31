/**
 * Fix user name in database
 * 
 * Usage: node src/scripts/fixName.js "email@example.com" "New Name"
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/splitbill';

async function fixName() {
  const email = process.argv[2];
  const newName = process.argv[3];

  if (!email || !newName) {
    console.log('Usage: node src/scripts/fixName.js "email@example.com" "New Name"');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const result = await usersCollection.updateOne(
      { _id: email.toLowerCase() },
      { $set: { name: newName } }
    );

    if (result.matchedCount === 0) {
      console.log(`❌ User ${email} not found`);
    } else {
      console.log(`✅ Updated ${email} -> name: "${newName}"`);
    }

  } catch (error) {
    console.error('❌ Failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

fixName();

