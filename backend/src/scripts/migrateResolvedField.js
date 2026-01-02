/**
 * Migration Script: Add 'resolved' field to consolidated expenses
 * 
 * This script updates all existing groups to add the 'resolved: false' field
 * to any consolidated expenses that don't have it.
 * 
 * Run with: node src/scripts/migrateResolvedField.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('../models/Group');

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

async function migrate() {
  console.log('🔄 Starting migration: Add resolved field to consolidated expenses\n');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all groups
    const groups = await Group.find({});
    console.log(`📋 Found ${groups.length} groups to check\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const group of groups) {
      const details = group.getDetails();
      let needsUpdate = false;
      
      if (details.consolidatedExpenses && details.consolidatedExpenses.length > 0) {
        // Check if any edge is missing the 'resolved' field
        const updatedEdges = details.consolidatedExpenses.map(edge => {
          if (edge.resolved === undefined) {
            needsUpdate = true;
            return { ...edge, resolved: false };
          }
          return edge;
        });
        
        if (needsUpdate) {
          details.consolidatedExpenses = updatedEdges;
          group.setDetails(details);
          await group.save();
          console.log(`  ✅ Updated: ${group.name} (${group._id})`);
          updatedCount++;
        } else {
          console.log(`  ⏭️  Skipped: ${group.name} (already has resolved field)`);
          skippedCount++;
        }
      } else {
        console.log(`  ⏭️  Skipped: ${group.name} (no consolidated expenses)`);
        skippedCount++;
      }
    }
    
    console.log('\n========================================');
    console.log('📊 Migration Summary:');
    console.log(`   Total groups: ${groups.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log('========================================\n');
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run migration
migrate();

