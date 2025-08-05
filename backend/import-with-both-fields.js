const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function importWithBothFields() {
  try {
    console.log('🚀 Final import with both legacy and new field names...\n');
    
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
      const batchSize = 50;
      for (let i = 0; i < existingItems.length; i += batchSize) {
        const batch = existingItems.slice(i, Math.min(i + batchSize, existingItems.length));
        const ids = batch.map(item => item._id);
        await client.mutation('priceItems:deleteBatch', { ids });
        console.log(`  Cleared ${i + batch.length}/${existingItems.length} items`);
      }
    }
    
    // Read CSV
    const csvPath = path.join(__dirname, 'complete-pricelist.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`\n📊 Loading ${records.length} items...`);
    
    // Process all items
    let created = 0;
    let failed = 0;
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, Math.min(i + BATCH_SIZE, records.length));
      console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(records.length/BATCH_SIZE)} (items ${i+1}-${Math.min(i+BATCH_SIZE, records.length)})`);
      
      for (const record of batch) {
        const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
        
        try {
          // Create item with legacy field names (required by the mutation)
          await client.mutation('priceItems:create', {
            // Legacy fields (required)
            id: record.code,
            name: record.description,
            operation_cost: parseFloat(record.rate) || 1.0,
            uom_id: record.unit || 'Unit',
            product_template_variant_value_ids: record.subcategory || '',
            
            // Additional fields
            description: record.description,
            category: record.category || 'General',
            keywords: keywords,
            
            // New schema fields (will be stored if the mutation accepts them)
            code: record.code,
            subcategory: record.subcategory,
            unit: record.unit,
            rate: parseFloat(record.rate) || 1.0,
            ref: record.ref,
            
            userId: user._id
          });
          
          created++;
        } catch (error) {
          failed++;
          if (failed <= 5) {
            console.error(`  ❌ Failed: ${record.code} - ${error.message}`);
          }
        }
      }
      
      console.log(`  ✅ Batch complete: ${created} created so far`);
    }
    
    // After import, update all items to ensure new fields are set
    console.log('\n🔧 Updating items with new field names...');
    
    const allItems = await client.query('priceItems:getAll');
    let updated = 0;
    
    for (const item of allItems) {
      try {
        // Update with the new field names
        await client.mutation('priceItems:update', {
          id: item._id,
          code: item.id || item.code,
          subcategory: item.product_template_variant_value_ids || item.subcategory,
          unit: item.uom_id || item.unit,
          rate: item.operation_cost || item.rate
        });
        updated++;
      } catch (error) {
        // Ignore update errors
      }
    }
    
    console.log(`✅ Updated ${updated} items with new field names`);
    
    // Final verification
    console.log('\n🔍 Verifying final data...');
    const finalItems = await client.query('priceItems:getAll');
    
    // Check both sets of fields
    let hasNewFields = 0;
    let hasLegacyFields = 0;
    
    finalItems.forEach(item => {
      if (item.code && item.subcategory && item.unit && item.rate !== undefined) {
        hasNewFields++;
      }
      if (item.id && item.product_template_variant_value_ids && item.uom_id && item.operation_cost !== undefined) {
        hasLegacyFields++;
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total items: ${finalItems.length}`);
    console.log(`Successfully created: ${created}`);
    console.log(`Failed: ${failed}`);
    console.log(`\n📊 Field availability:`);
    console.log(`  Items with new fields (code, subcategory, unit, rate): ${hasNewFields}`);
    console.log(`  Items with legacy fields: ${hasLegacyFields}`);
    
    if (finalItems.length > 0) {
      console.log('\n📋 Sample item structure:');
      const sample = finalItems[0];
      console.log(JSON.stringify({
        _id: sample._id,
        // New fields
        code: sample.code,
        subcategory: sample.subcategory,
        unit: sample.unit,
        rate: sample.rate,
        // Legacy fields
        id: sample.id,
        product_template_variant_value_ids: sample.product_template_variant_value_ids,
        uom_id: sample.uom_id,
        operation_cost: sample.operation_cost,
        // Common fields
        description: sample.description,
        category: sample.category
      }, null, 2));
    }
    
    if (hasNewFields < finalItems.length) {
      console.log('\n⚠️  Warning: Not all items have the new field names.');
      console.log('The frontend may still show missing data.');
    } else {
      console.log('\n✨ All items have proper field names!');
      console.log('The frontend should now display all data correctly.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
  }
}

importWithBothFields();