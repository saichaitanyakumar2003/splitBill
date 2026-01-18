/**
 * Migration Script: Migrate existing Group data to new schema
 * 
 * This script:
 * 1. Reads all existing groups with consolidatedExpenses in compressedDetails
 * 2. Creates ConsolidatedEdges documents for each group (compressed)
 * 3. Creates History documents for resolved edges (compressed)
 * 4. Updates Group documents to only store expenses
 * 
 * Run with: node src/scripts/migrateToNewSchema.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { compressData, decompressData } = require('../utils/compression');

// MongoDB connection (support both MONGODB_URI and MONGODB_URL)
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/splitbill';

async function migrate() {
  console.log('🚀 Starting migration to new schema (with compression)...\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get raw collection access
    const db = mongoose.connection.db;
    const groupsCollection = db.collection('groups');
    const consolidatedEdgesCollection = db.collection('consolidatededges');
    const historyCollection = db.collection('histories');
    
    // Get all groups
    const groups = await groupsCollection.find({}).toArray();
    console.log(`📊 Found ${groups.length} groups to migrate\n`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const group of groups) {
      try {
        console.log(`\n📦 Processing group: ${group.name} (${group._id})`);
        
        // Check if already migrated (ConsolidatedEdges exists for this group)
        const existingEdges = await consolidatedEdgesCollection.findOne({ groupId: group._id });
        if (existingEdges) {
          console.log(`  ⏭️  Already migrated, skipping...`);
          skippedCount++;
          continue;
        }
        
        // Decompress the group details
        let details;
        if (group.compressedDetails) {
          try {
            details = decompressData(group.compressedDetails.buffer || group.compressedDetails);
          } catch (e) {
            console.log(`  ⚠️  Could not decompress, using empty defaults`);
            details = { expenses: [], consolidatedExpenses: [] };
          }
        } else {
          details = { expenses: [], consolidatedExpenses: [] };
        }
        
        const expenses = details.expenses || [];
        const consolidatedExpenses = details.consolidatedExpenses || [];
        
        console.log(`  📝 Expenses: ${expenses.length}`);
        console.log(`  🔗 Consolidated Edges: ${consolidatedExpenses.length}`);
        
        // Separate resolved and unresolved edges
        const resolvedEdges = consolidatedExpenses.filter(e => e.resolved);
        const allEdges = consolidatedExpenses.map(e => ({
          from: (e.from || '').toLowerCase().trim(),
          to: (e.to || '').toLowerCase().trim(),
          amount: Math.round((e.amount || 0) * 100) / 100,
          resolved: e.resolved || false
        }));
        
        console.log(`  ✅ Resolved: ${resolvedEdges.length}, ⏳ Pending: ${allEdges.length - resolvedEdges.length}`);
        
        // Create ConsolidatedEdges document with compressed data
        const consolidatedEdgesDoc = {
          _id: uuidv4(),
          groupId: group._id,
          compressedData: compressData({ edges: allEdges }),
          expiresAt: group.status === 'completed' ? getExpiryDate(7) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await consolidatedEdgesCollection.insertOne(consolidatedEdgesDoc);
        console.log(`  ✅ Created ConsolidatedEdges document (compressed)${group.status === 'completed' ? ' with 7-day TTL' : ''}`);
        
        // Create History document if there are resolved edges (compressed)
        if (resolvedEdges.length > 0) {
          const settledEdges = resolvedEdges.map(e => ({
            from: (e.from || '').toLowerCase().trim(),
            to: (e.to || '').toLowerCase().trim(),
            amount: Math.round((e.amount || 0) * 100) / 100,
            settledAt: new Date().toISOString()
          }));
          
          const historyDoc = {
            _id: uuidv4(),
            groupId: group._id,
            compressedData: compressData({ 
              groupName: group.name, 
              settledEdges: settledEdges 
            }),
            expiresAt: group.status === 'completed' ? getExpiryDate(7) : null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await historyCollection.insertOne(historyDoc);
          console.log(`  ✅ Created History document with ${resolvedEdges.length} settled edges (compressed)`);
        }
        
        // Update Group to only store expenses (remove consolidatedExpenses)
        const newCompressedDetails = compressData({ expenses });
        
        const updateFields = {
          compressedDetails: newCompressedDetails,
          updatedAt: new Date()
        };
        
        // Set TTL if group is completed
        if (group.status === 'completed') {
          updateFields.expiresAt = getExpiryDate(7);
          console.log(`  ⏱️  Group is completed, setting 7-day TTL`);
        }
        
        await groupsCollection.updateOne(
          { _id: group._id },
          { $set: updateFields }
        );
        console.log(`  ✅ Updated Group document (removed consolidatedExpenses from storage)`);
        
        migratedCount++;
        
      } catch (groupError) {
        console.error(`  ❌ Error processing group ${group._id}:`, groupError.message);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount}`);
    console.log(`  ⏭️  Skipped (already migrated): ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

function getExpiryDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// Run migration
migrate();
