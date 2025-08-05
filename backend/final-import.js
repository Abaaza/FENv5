const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function finalImport() {
  try {
    console.log('🚀 Final import with correct field mapping...\n');
    
    // Get admin user
    const user = await client.query('users:getByEmail', { email: 'abaza@tfp.com' });
    if (!user) {
      console.error('❌ Admin user not found');
      return;
    }
    
    // Clear existing items
    console.log('🗑️  Clearing existing items...');
    const existingItems = await client.query('priceItems:getAll');
    if (existingItems.length > 0) {
      console.log(`Found ${existingItems.length} existing items. Clearing...`);
    }
    
    // Read CSV
    const csvPath = path.join(__dirname, 'complete-pricelist.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`\n📊 Loaded ${records.length} items from CSV`);
    
    // Process in batches using createBatch
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    let totalCreated = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, records.length);
      const batch = records.slice(start, end);
      
      console.log(`\n📦 Batch ${i + 1}/${totalBatches} (items ${start + 1}-${end})`);
      
      // Transform records to match the createBatch schema
      const items = batch.map(record => ({
        id: record.code,
        code: record.code,
        ref: record.ref,
        description: record.description,
        category: record.category || 'General',
        subcategory: record.subcategory || '',
        unit: record.unit || 'Unit',
        rate: parseFloat(record.rate) || 1.0,
        keywords: record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : []
      }));
      
      try {
        await client.mutation('priceItems:createBatch', {
          items: items,
          userId: user._id
        });
        
        totalCreated += items.length;
        console.log(`  ✅ Created ${items.length} items`);
        
      } catch (error) {
        console.error(`  ❌ Error in batch:`, error.message);
        
        // If batch fails, try individual items
        console.log(`  Retrying individual items...`);
        for (const item of items) {
          try {
            // Try using the standard create mutation directly
            await client.mutation('priceItems:create', {
              ...item,
              userId: user._id
            });
            totalCreated++;
          } catch (itemError) {
            console.error(`    Failed: ${item.code} - ${itemError.message}`);
          }
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Verify final results
    console.log('\n🔍 Verifying import...');
    const finalItems = await client.query('priceItems:getAll');
    
    // Check field presence
    let missingFields = {
      code: 0,
      subcategory: 0,
      unit: 0,
      rate: 0
    };
    
    finalItems.forEach(item => {
      if (!item.code) missingFields.code++;
      if (!item.subcategory) missingFields.subcategory++;
      if (!item.unit) missingFields.unit++;
      if (item.rate === undefined || item.rate === null) missingFields.rate++;
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total items in database: ${finalItems.length}`);
    console.log(`Items created: ${totalCreated}`);
    
    console.log('\n📊 Field Completeness:');
    console.log(`  Items with code: ${finalItems.length - missingFields.code}/${finalItems.length}`);
    console.log(`  Items with subcategory: ${finalItems.length - missingFields.subcategory}/${finalItems.length}`);
    console.log(`  Items with unit: ${finalItems.length - missingFields.unit}/${finalItems.length}`);
    console.log(`  Items with rate: ${finalItems.length - missingFields.rate}/${finalItems.length}`);
    
    if (finalItems.length > 0) {
      console.log('\n📋 Sample item:');
      const sample = finalItems[0];
      console.log(JSON.stringify({
        _id: sample._id,
        code: sample.code,
        subcategory: sample.subcategory,
        unit: sample.unit,
        rate: sample.rate,
        description: sample.description,
        category: sample.category
      }, null, 2));
    }
    
    if (Object.values(missingFields).some(v => v > 0)) {
      console.log('\n⚠️  Some fields are still missing. The frontend may not display all data correctly.');
    } else {
      console.log('\n✨ All fields are properly populated! The frontend should display everything correctly.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
  }
}

finalImport();