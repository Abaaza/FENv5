const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
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

async function importPriceList(userEmail = 'abaza@tfp.com') {
  try {
    console.log('Starting price list import to Convex...');
    console.log('Convex URL:', CONVEX_URL);
    
    // Read the JSON file
    const dataPath = path.join(__dirname, 'data', 'tfp-pricelist.json');
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Price list file not found at:', dataPath);
      console.log('Please run the conversion script first: node convert-pricelist.js');
      process.exit(1);
    }
    
    const priceItems = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`\n📊 Loaded ${priceItems.length} items from tfp-pricelist.json`);
    
    // Get admin user by email
    console.log(`\n🔍 Looking up user: ${userEmail}`);
    const user = await client.query('users:getByEmail', { email: userEmail });
    
    if (!user) {
      console.error(`❌ User not found with email: ${userEmail}`);
      console.log('\nAvailable options:');
      console.log('1. Create the user first through the application');
      console.log('2. Use a different email');
      console.log('3. Check the Convex dashboard for existing users');
      process.exit(1);
    }
    
    const userId = user._id;
    console.log(`✅ Found user: ${user.name} (ID: ${userId})`);
    
    // Ask for confirmation
    console.log('\n⚠️  This will import all price items to the database.');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    await sleep(3000);
    
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
        // Prepare items for Convex (remove _id field as it's auto-generated)
        const itemsForImport = batch.map(item => {
          const { _id, createdAt, updatedAt, isActive, ...rest } = item;
          return rest;
        });
        
        // Call the Convex mutation
        const result = await client.mutation('importPriceList:importPriceItems', {
          items: itemsForImport,
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
    
    console.log('\n✨ Import process completed!');
    
  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Alternative: Import with actual user lookup
async function importWithUserLookup(userEmail) {
  try {
    console.log('Starting price list import with user lookup...');
    console.log('Looking up user:', userEmail);
    
    // First, get the user by email
    const user = await client.query('users:getUserByEmail', { email: userEmail });
    
    if (!user) {
      console.error(`❌ User not found with email: ${userEmail}`);
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.name} (${user._id})`);
    
    // Now proceed with import using the actual user ID
    // ... rest of the import logic using user._id
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 TFP Price List Import Tool\n');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const userEmail = args.find(arg => arg.startsWith('--email='))?.split('=')[1] || 'abaza@tfp.com';
  
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
  await importPriceList(userEmail);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { importPriceList };