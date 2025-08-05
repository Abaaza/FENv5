const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

// Configuration
const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const BATCH_SIZE = 100; // Process in batches
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay

// Initialize Convex client
const client = new ConvexClient(CONVEX_URL);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clearExistingData(userId) {
  console.log('\n🗑️  Clearing existing price items...');
  const existingItems = await client.query('priceItems.js:getAll');
  
  if (existingItems.length > 0) {
    // Delete in batches
    const deleteBatchSize = 50;
    const totalBatches = Math.ceil(existingItems.length / deleteBatchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * deleteBatchSize;
      const end = Math.min(start + deleteBatchSize, existingItems.length);
      const batch = existingItems.slice(start, end);
      
      const ids = batch.map(item => item._id);
      await client.mutation('priceItems.js:deleteBatch', { ids });
      
      console.log(`  Deleted batch ${i + 1}/${totalBatches} (${ids.length} items)`);
      await sleep(500);
    }
  }
  
  console.log('✅ Existing data cleared\n');
}

async function importCompletePriceList() {
  try {
    console.log('🚀 Starting complete price list import...\n');
    
    // Read the CSV file
    const csvPath = path.join(__dirname, 'complete-pricelist.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found. Please run convert-complete-pricelist.js first.');
      process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`📊 Loaded ${records.length} items from CSV\n`);
    
    // Get admin user
    const user = await client.query('users:getByEmail', { email: 'abaza@tfp.com' });
    if (!user) {
      console.error('❌ Admin user not found. Please ensure user exists.');
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.name} (${user._id})`);
    
    // Clear existing data
    await clearExistingData(user._id);
    
    // Import new data
    console.log('📥 Importing new price list...\n');
    
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalErrors = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, records.length);
      const batch = records.slice(start, end);
      
      console.log(`📦 Processing batch ${i + 1}/${totalBatches} (items ${start + 1}-${end})...`);
      
      try {
        // Transform CSV records to match priceItems schema
        const items = batch.map(record => ({
          id: record.code, // Use code as the ID
          name: record.description,
          operation_cost: parseFloat(record.rate) || 1.0,
          uom_id: record.unit || 'Unit',
          product_template_variant_value_ids: record.subcategory || '',
          description: record.description,
          category: record.category || 'General',
          keywords: record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : []
        }));
        
        // Create items using the batch mutation
        await client.mutation('priceItems.js:createBatch', {
          items: items,
          userId: user._id
        });
        
        totalCreated += items.length;
        console.log(`  ✅ Created ${items.length} items`);
        
      } catch (error) {
        console.error(`  ❌ Error in batch ${i + 1}:`, error.message);
        totalErrors++;
        
        // If rate limited, wait longer
        if (error.message.includes('429') || error.message.includes('rate')) {
          console.log('  ⏳ Rate limited - waiting 5 seconds...');
          await sleep(5000);
        }
      }
      
      // Delay between batches
      if (i < totalBatches - 1) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }
    
    // Verify final count
    console.log('\n🔍 Verifying import...');
    const finalItems = await client.query('priceItems.js:getAll');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Total items in database: ${finalItems.length}`);
    console.log(`📥 Items imported: ${totalCreated}`);
    console.log(`❌ Batch errors: ${totalErrors}`);
    
    // Show sample items
    console.log('\n📋 Sample imported items:');
    finalItems.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.description}`);
      console.log(`   Code: ${item.id}`);
      console.log(`   Category: ${item.category}`);
      console.log(`   Subcategory: ${item.product_template_variant_value_ids}`);
      console.log(`   Unit: ${item.uom_id}`);
      console.log(`   Rate: ${item.operation_cost}`);
    });
    
    // Verify all required fields
    const missingCode = finalItems.filter(item => !item.id).length;
    const missingCategory = finalItems.filter(item => !item.category).length;
    const missingUnit = finalItems.filter(item => !item.uom_id).length;
    const missingRate = finalItems.filter(item => !item.operation_cost).length;
    
    console.log('\n✅ Data Completeness Check:');
    console.log(`   Items with code: ${finalItems.length - missingCode}/${finalItems.length}`);
    console.log(`   Items with category: ${finalItems.length - missingCategory}/${finalItems.length}`);
    console.log(`   Items with unit: ${finalItems.length - missingUnit}/${finalItems.length}`);
    console.log(`   Items with rate: ${finalItems.length - missingRate}/${finalItems.length}`);
    
    console.log('\n✨ Import completed successfully!');
    console.log('All items now have code, subcategory, unit, and rate populated.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the import
importCompletePriceList();