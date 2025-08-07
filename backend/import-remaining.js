const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

// Configuration
const CONVEX_URL = process.env.CONVEX_URL || 'https://bright-scorpion-424.convex.cloud';
const BATCH_SIZE = 25; // Smaller batch size for better success rate
const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds delay
const START_FROM_ITEM = 2301; // Start from item 2301

// Initialize Convex client
const client = new ConvexClient(CONVEX_URL);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importRemainingItems(userEmail = 'abaza@tfp.com') {
  try {
    console.log('🚀 Starting import of remaining items...');
    console.log('Convex URL:', CONVEX_URL);
    console.log(`Starting from item ${START_FROM_ITEM}`);
    
    // Read the CSV file
    const csvPath = path.join(__dirname, 'tfp-pricelist-final.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    // Get only the remaining items
    const remainingRecords = records.slice(START_FROM_ITEM - 1);
    console.log(`\n📊 Processing ${remainingRecords.length} remaining items (${START_FROM_ITEM} to ${records.length})`);
    
    // Get admin user by email
    console.log(`\n🔍 Looking up user: ${userEmail}`);
    const user = await client.query('users:getByEmail', { email: userEmail });
    
    if (!user) {
      console.error(`❌ User not found with email: ${userEmail}`);
      process.exit(1);
    }
    
    const userId = user._id;
    console.log(`✅ Found user: ${user.name} (ID: ${userId})`);
    
    // Convert CSV records to price items format
    const priceItems = remainingRecords.map(record => {
      const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
      
      return {
        id: record._id,
        code: record.code || undefined,
        ref: record.ref || undefined,
        description: record.description,
        category: record.category || undefined,
        subcategory: record.subcategory || undefined,
        unit: record.unit || undefined,
        rate: parseFloat(record.rate) || 0,
        keywords: keywords
      };
    });
    
    // Process in batches
    const totalBatches = Math.ceil(priceItems.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = [];
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, priceItems.length);
      const batch = priceItems.slice(start, end);
      const actualItemNumbers = `${START_FROM_ITEM + start}-${START_FROM_ITEM + end - 1}`;
      
      console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (items ${actualItemNumbers})...`);
      
      try {
        // Process items one by one in this batch for better success rate
        for (const item of batch) {
          try {
            await client.mutation('priceItems:create', {
              ...item,
              userId: userId,
            });
            totalCreated++;
          } catch (itemError) {
            if (itemError.message.includes('already exists')) {
              totalUpdated++;
            } else {
              console.error(`   ❌ Error with item ${item.description}: ${itemError.message}`);
              totalErrors.push(`${item.description}: ${itemError.message}`);
            }
          }
        }
        
        console.log(`   ✅ Batch complete: ${totalCreated} created so far`);
        
        // Add delay between batches
        if (i < totalBatches - 1) {
          console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await sleep(DELAY_BETWEEN_BATCHES);
        }
      } catch (error) {
        console.error(`   ❌ Error processing batch ${i + 1}:`, error.message);
        totalErrors.push(`Batch ${i + 1}: ${error.message}`);
        
        // If rate limited, wait longer
        if (error.message.includes('429') || error.message.includes('rate')) {
          console.log('   ⏳ Rate limited - waiting 10 seconds...');
          await sleep(10000);
        }
      }
    }
    
    // Display final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${totalCreated} items`);
    console.log(`🔄 Updated/Skipped: ${totalUpdated} items`);
    console.log(`❌ Errors: ${totalErrors.length}`);
    console.log(`📦 Total processed: ${priceItems.length} items`);
    
    if (totalErrors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      totalErrors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (totalErrors.length > 10) {
        console.log(`  ... and ${totalErrors.length - 10} more errors`);
      }
    }
    
    console.log('\n✨ Remaining items import completed!');
    
  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the import
importRemainingItems().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});