const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

// Configuration
const CONVEX_URL = process.env.CONVEX_URL || 'https://bright-scorpion-424.convex.cloud';
const BATCH_SIZE = 50; // Import in batches to avoid timeouts
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay

// Initialize Convex client
const client = new ConvexClient(CONVEX_URL);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importCSVPriceList(userEmail = 'abaza@tfp.com') {
  try {
    console.log('🚀 Starting CSV import to Convex...');
    console.log('Convex URL:', CONVEX_URL);
    
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
    
    console.log(`\n📊 Loaded ${records.length} items from CSV file`);
    
    // Get admin user by email
    console.log(`\n🔍 Looking up user: ${userEmail}`);
    const user = await client.query('users:getByEmail', { email: userEmail });
    
    if (!user) {
      console.error(`❌ User not found with email: ${userEmail}`);
      console.log('\nPlease make sure the user exists in the database.');
      process.exit(1);
    }
    
    const userId = user._id;
    console.log(`✅ Found user: ${user.name} (ID: ${userId})`);
    
    // Ask for confirmation
    console.log('\n⚠️  This will import all price items to the database.');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    await sleep(3000);
    
    // Convert CSV records to price items format
    const priceItems = records.map(record => {
      // Parse keywords from semicolon-separated string back to array
      const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
      
      return {
        id: record._id, // Use _id from CSV as the id field
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
      
      console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (items ${start + 1}-${end})...`);
      
      try {
        // Call the existing Convex mutation for batch creation
        // Transform items to match the expected format
        const transformedItems = batch.map(item => ({
          id: item.id,
          name: item.description,
          operation_cost: item.rate,
          uom_id: item.unit || 'Unit',
          product_template_variant_value_ids: item.ref || '',
          description: item.description,
          category: item.category,
          keywords: item.keywords
        }));
        
        const result = await client.mutation('priceItems.js:createBatch', {
          items: transformedItems,
          userId: userId,
        });
        
        totalCreated += result.created || 0;
        totalUpdated += result.updated || 0;
        if (result.errors && result.errors.length > 0) {
          totalErrors = totalErrors.concat(result.errors);
        }
        
        console.log(`   ✅ Batch complete: ${result.created} created, ${result.updated} updated`);
        
        // Add delay between batches to avoid rate limiting
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
    console.log(`🔄 Updated: ${totalUpdated} items`);
    console.log(`❌ Errors: ${totalErrors.length}`);
    console.log(`📦 Total processed: ${priceItems.length} items`);
    
    if (totalErrors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      totalErrors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (totalErrors.length > 10) {
        console.log(`  ... and ${totalErrors.length - 10} more errors`);
      }
    }
    
    console.log('\n✨ CSV import completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  console.log('🚀 TFP CSV Price List Import Tool\n');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const userEmail = args.find(arg => arg.startsWith('--email='))?.split('=')[1] || 'abaza@tfp.com';
  
  if (args.includes('--help')) {
    console.log('Usage: node import-csv-to-convex.js [options]');
    console.log('\nOptions:');
    console.log('  --email=<email>   Email of the admin user (default: abaza@tfp.com)');
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
  
  // Run the import
  await importCSVPriceList(userEmail);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { importCSVPriceList };