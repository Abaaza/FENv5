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

function cleanRef(ref) {
  // Clean up the __export__.product_product_ prefix
  if (ref && ref.startsWith('__export__.product_product_')) {
    return ref.replace('__export__.product_product_', '');
  }
  return ref;
}

async function importRemainingItems(userEmail = 'abaza@tfp.com') {
  try {
    console.log('🚀 Starting import of remaining items with proper formatting...');
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
    
    // Convert CSV records to price items format with cleaned ref
    const priceItems = remainingRecords.map(record => {
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
    
    // Process in batches using createBatch
    const totalBatches = Math.ceil(priceItems.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalErrors = [];
    let successfulBatches = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, priceItems.length);
      const batch = priceItems.slice(start, end);
      const actualItemNumbers = `${START_FROM_ITEM + start}-${START_FROM_ITEM + end - 1}`;
      
      console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (items ${actualItemNumbers})...`);
      
      try {
        // Use the createBatch mutation with correct format
        const result = await client.mutation('priceItems:createBatch', {
          items: batch,
          userId: userId,
        });
        
        if (result && Array.isArray(result)) {
          totalCreated += result.length;
          successfulBatches++;
          console.log(`   ✅ Batch complete: ${result.length} items created (Total: ${totalCreated})`);
        } else {
          console.log(`   ✅ Batch complete (Total created so far: ${totalCreated})`);
          successfulBatches++;
        }
        
        // Add delay between batches
        if (i < totalBatches - 1) {
          console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await sleep(DELAY_BETWEEN_BATCHES);
        }
      } catch (error) {
        console.error(`   ❌ Error processing batch ${i + 1}:`, error.message);
        totalErrors.push(`Batch ${i + 1} (items ${actualItemNumbers}): ${error.message}`);
        
        // If rate limited, wait longer
        if (error.message.includes('429') || error.message.includes('rate')) {
          console.log('   ⏳ Rate limited - waiting 10 seconds...');
          await sleep(10000);
          // Retry the batch once
          try {
            const retryResult = await client.mutation('priceItems:createBatch', {
              items: batch,
              userId: userId,
            });
            if (retryResult && Array.isArray(retryResult)) {
              totalCreated += retryResult.length;
              console.log(`   ✅ Retry successful: ${retryResult.length} items created`);
            }
          } catch (retryError) {
            console.error(`   ❌ Retry failed:`, retryError.message);
          }
        }
      }
    }
    
    // Display final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${totalCreated} items`);
    console.log(`📦 Successful batches: ${successfulBatches}/${totalBatches}`);
    console.log(`❌ Failed batches: ${totalBatches - successfulBatches}`);
    console.log(`📦 Total items to process: ${priceItems.length}`);
    
    if (totalErrors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      totalErrors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (totalErrors.length > 10) {
        console.log(`  ... and ${totalErrors.length - 10} more errors`);
      }
    }
    
    console.log('\n✨ Import completed!');
    
    // Check final count
    console.log('\n🔍 Checking final database count...');
    const allItems = await client.query('priceItems:getAll');
    console.log(`📊 Total items in database: ${allItems ? allItems.length : 0}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Also create a function to update existing items to clean their ref field
async function cleanExistingRefs(userEmail = 'abaza@tfp.com') {
  try {
    console.log('\n🧹 Cleaning existing ref fields...');
    
    // Get admin user
    const user = await client.query('users:getByEmail', { email: userEmail });
    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      return;
    }
    
    // Get all items
    const allItems = await client.query('priceItems:getAll');
    console.log(`Found ${allItems.length} items to check`);
    
    let cleaned = 0;
    const batchSize = 10;
    
    for (let i = 0; i < allItems.length; i += batchSize) {
      const batch = allItems.slice(i, Math.min(i + batchSize, allItems.length));
      
      for (const item of batch) {
        if (item.ref && item.ref.startsWith('__export__.product_product_')) {
          try {
            await client.mutation('priceItems:update', {
              id: item._id,
              updates: {
                ref: cleanRef(item.ref)
              },
              userId: user._id
            });
            cleaned++;
          } catch (err) {
            // Try updateById if update doesn't work
            try {
              await client.mutation('priceItems:updateById', {
                id: item._id,
                ref: cleanRef(item.ref),
                userId: user._id
              });
              cleaned++;
            } catch (err2) {
              console.error(`Failed to clean ref for item ${item._id}`);
            }
          }
        }
      }
      
      if ((i + batchSize) % 100 === 0) {
        console.log(`Processed ${Math.min(i + batchSize, allItems.length)}/${allItems.length} items, cleaned ${cleaned} refs`);
        await sleep(1000); // Small delay every 100 items
      }
    }
    
    console.log(`\n✅ Cleaned ${cleaned} ref fields`);
    
  } catch (error) {
    console.error('Error cleaning refs:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 TFP Price List Import Tool (Fixed)\n');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const userEmail = args.find(arg => arg.startsWith('--email='))?.split('=')[1] || 'abaza@tfp.com';
  
  if (args.includes('--help')) {
    console.log('Usage: node import-remaining-fixed.js [options]');
    console.log('\nOptions:');
    console.log('  --email=<email>   Email of the admin user (default: abaza@tfp.com)');
    console.log('  --clean-refs      Clean existing ref fields');
    console.log('  --help            Show this help message');
    return;
  }
  
  // Import remaining items
  await importRemainingItems(userEmail);
  
  // Optionally clean existing refs
  if (args.includes('--clean-refs')) {
    await cleanExistingRefs(userEmail);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { importRemainingItems, cleanExistingRefs };