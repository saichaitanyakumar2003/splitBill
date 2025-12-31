require('dotenv').config();
const { connectDB, mongoose } = require('../utils/mongodb');

async function resetDatabase() {
  try {
    await connectDB();
    console.log('🔄 Resetting database...\n');

    // Drop all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
      console.log(`🗑️  Dropped collection: ${collection.name}`);
    }

    console.log('\n✅ Database reset complete!');
    console.log('📦 Models ready: User, Group');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
}

resetDatabase();

