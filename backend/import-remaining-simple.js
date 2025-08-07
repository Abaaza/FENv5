const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

// Configuration
const CONVEX_URL = process.env.CONVEX_URL || 'https://bright-scorpion-424.convex.cloud';
const BATCH_SIZE = 10; // Very small batch size to avoid issues
const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds delay
const START_FROM_ITEM = 2301; // Start from item 2301

// Initialize Convex client
const client = new ConvexClient(CONVEX_URL);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanRef(ref) {
  // Clean up the __export__.product_product_ prefix
  if (ref && ref.startsWith('__export__.product_product_')) {
    return ref.replace('__export__.product_product_', '');
  }
  return ref;
}

async function importRemainingItems(userEmail = 'abaza@tfp.com') {
  try {
    console.log('🚀 Starting import of remaining items (simplified approach)...');
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
    
    // Process in batches using createBatch
    const totalBatches = Math.ceil(remainingRecords.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalErrors = [];
    let successfulBatches = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, remainingRecords.length);
      const batchRecords = remainingRecords.slice(start, end);
      const actualItemNumbers = `${START_FROM_ITEM + start}-${START_FROM_ITEM + end - 1}`;
      
      console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (items ${actualItemNumbers})...`);
      
      // Convert to the format expected by createBatch
      const batchItems = batchRecords.map(record => {
        const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
        
        return {
          id: record._id,
          code: record.code || undefined,
          ref: cleanRef(record.ref) || undefined, // Clean the ref field
          description: record.description,
          category: record.category || undefined,
          subcategory: record.subcategory || undefined,
          unit: record.unit || undefined,
          rate: parseFloat(record.rate) || 0,
          keywords: keywords
        };
      });
      
      try {
        // Use the createBatch mutation
        const result = await client.mutation('priceItems:createBatch', {
          items: batchItems,
          userId: userId,
        });
        
        if (result && Array.isArray(result)) {
          totalCreated += result.length;
          successfulBatches++;
          console.log(`   ✅ Batch complete: ${result.length} items created (Total: ${totalCreated})`);
        } else {
          successfulBatches++;
          totalCreated += batchItems.length;
          console.log(`   ✅ Batch complete: ${batchItems.length} items processed (Total: ${totalCreated})`);
        }
        
        // Add delay between batches
        if (i < totalBatches - 1) {
          console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await sleep(DELAY_BETWEEN_BATCHES);
        }
      } catch (error) {
        console.error(`   ❌ Error processing batch ${i + 1}:`, error.message);
        
        // If batch fails, try individual items
        console.log('   🔄 Retrying items individually...');
        let individualSuccess = 0;
        
        for (const item of batchItems) {
          try {
            await client.mutation('priceItems:create', {
              ...item,
              userId: userId,
            });
            individualSuccess++;
            totalCreated++;
          } catch (itemError) {
            // Item might already exist, continue
            if (itemError.message.includes('already exists')) {
              console.log(`   ℹ️ Item already exists: ${item.description}`);
            } else {
              console.error(`   ❌ Failed to create: ${item.description}`);
              totalErrors.push(`${item.description}: ${itemError.message}`);
            }
          }
          
          // Small delay between individual items
          await sleep(100);
        }
        
        if (individualSuccess > 0) {
          console.log(`   ✅ Individually created ${individualSuccess} items`);
        }
        
        // Longer delay after error
        if (error.message.includes('429') || error.message.includes('rate')) {
          console.log('   ⏳ Rate limited - waiting 10 seconds...');
          await sleep(10000);
        } else {
          await sleep(5000);
        }
      }
    }
    
    // Display final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${totalCreated} items`);
    console.log(`📦 Successful batches: ${successfulBatches}/${totalBatches}`);
    console.log(`❌ Errors: ${totalErrors.length}`);
    console.log(`📦 Total items to process: ${remainingRecords.length}`);
    
    if (totalErrors.length > 0 && totalErrors.length <= 10) {
      console.log('\n⚠️  Errors encountered:');
      totalErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n✨ Import completed!');
    
    // Check final count
    console.log('\n🔍 Checking final database count...');
    const allItems = await client.query('priceItems:getAll');
    console.log(`📊 Total items in database: ${allItems ? allItems.length : 0}`);
    
    // Show sample of newly imported items
    if (allItems && allItems.length > 2300) {
      console.log('\n📦 Sample of newly imported items:');
      const newItems = allItems.slice(2300, 2305);
      newItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.description} - ${item.unit || 'Unit'}: £${item.rate}`);
        if (item.ref && !item.ref.includes('__export__')) {
          console.log(`     REF: ${item.ref}`);
        }
      });
    }
    
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