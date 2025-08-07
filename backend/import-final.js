const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

// Configuration
const CONVEX_URL = process.env.CONVEX_URL || 'https://bright-scorpion-424.convex.cloud';
const BATCH_SIZE = 50; // Can use larger batches with the import mutation
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay

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

async function importAllItems(userEmail = 'abaza@tfp.com', startFrom = 1) {
  try {
    console.log('🚀 Starting complete import with proper formatting...');
    console.log('Convex URL:', CONVEX_URL);
    if (startFrom > 1) {
      console.log(`Starting from item ${startFrom}`);
    }
    
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
    
    // Get items to process
    const itemsToProcess = startFrom > 1 ? records.slice(startFrom - 1) : records;
    console.log(`\n📊 Processing ${itemsToProcess.length} items`);
    
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
    const priceItems = itemsToProcess.map(record => {
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
    
    // Process in batches using importPriceItems mutation
    const totalBatches = Math.ceil(priceItems.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = [];
    let successfulBatches = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, priceItems.length);
      const batch = priceItems.slice(start, end);
      const actualItemNumbers = startFrom > 1 
        ? `${startFrom + start}-${startFrom + end - 1}`
        : `${start + 1}-${end}`;
      
      console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (items ${actualItemNumbers})...`);
      
      try {
        // Use the importPriceItems mutation
        const result = await client.mutation('importPriceList:importPriceItems', {
          items: batch,
          userId: userId,
        });
        
        if (result) {
          totalCreated += result.created || 0;
          totalUpdated += result.updated || 0;
          if (result.errors && result.errors.length > 0) {
            totalErrors = totalErrors.concat(result.errors);
          }
          successfulBatches++;
          console.log(`   ✅ Batch complete: ${result.created || 0} created, ${result.updated || 0} updated`);
          
          if (result.errors && result.errors.length > 0) {
            console.log(`   ⚠️ ${result.errors.length} errors in this batch`);
          }
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
            const retryResult = await client.mutation('importPriceList:importPriceItems', {
              items: batch,
              userId: userId,
            });
            if (retryResult) {
              totalCreated += retryResult.created || 0;
              totalUpdated += retryResult.updated || 0;
              console.log(`   ✅ Retry successful: ${retryResult.created || 0} created, ${retryResult.updated || 0} updated`);
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
    console.log(`🔄 Updated: ${totalUpdated} items`);
    console.log(`📦 Successful batches: ${successfulBatches}/${totalBatches}`);
    console.log(`❌ Failed batches: ${totalBatches - successfulBatches}`);
    console.log(`📦 Total items processed: ${priceItems.length}`);
    
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
    
    // Show sample of imported items
    if (allItems && allItems.length > 0) {
      console.log('\n📦 Sample of imported items:');
      const samples = allItems.slice(-5); // Last 5 items
      samples.forEach((item, idx) => {
        const ref = item.ref && !item.ref.startsWith('__export__') 
          ? ` (${item.ref})` 
          : '';
        console.log(`  ${idx + 1}. ${item.description}${ref} - ${item.unit}: £${item.rate}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  console.log('🚀 TFP Price List Import Tool (Final Version)\n');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const userEmail = args.find(arg => arg.startsWith('--email='))?.split('=')[1] || 'abaza@tfp.com';
  const startFrom = parseInt(args.find(arg => arg.startsWith('--start='))?.split('=')[1] || '2301');
  
  if (args.includes('--help')) {
    console.log('Usage: node import-final.js [options]');
    console.log('\nOptions:');
    console.log('  --email=<email>   Email of the admin user (default: abaza@tfp.com)');
    console.log('  --start=<number>  Start from item number (default: 2301)');
    console.log('  --clear           Clear all existing price items before import');
    console.log('  --help            Show this help message');
    return;
  }
  
  if (args.includes('--clear')) {
    console.log('⚠️  WARNING: This will delete all existing price items!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await sleep(5000);
    
    try {
      // Get user first
      const user = await client.query('users:getByEmail', { email: userEmail });
      if (!user) {
        console.error(`❌ User not found: ${userEmail}`);
        process.exit(1);
      }
      
      const result = await client.mutation('importPriceList:clearAllPriceItems', {
        userId: user._id,
      });
      console.log(`✅ Cleared ${result.deleted} existing price items\n`);
    } catch (error) {
      console.error('❌ Error clearing items:', error);
    }
  }
  
  // Import items
  await importAllItems(userEmail, startFrom);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { importAllItems };