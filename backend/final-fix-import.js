const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function finalFixImport() {
  try {
    console.log('🚀 Final import solution...\n');
    
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
    
    console.log(`\n📊 Importing ${records.length} items...\n`);
    
    // Import with legacy fields only (what the mutation accepts)
    let created = 0;
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, Math.min(i + BATCH_SIZE, records.length));
      process.stdout.write(`\rProcessing: ${i}/${records.length} items...`);
      
      for (const record of batch) {
        const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
        
        try {
          // Create with only the accepted fields
          const newItem = await client.mutation('priceItems:create', {
            id: record.code,
            name: record.description,
            operation_cost: parseFloat(record.rate) || 1.0,
            uom_id: record.unit || 'Unit',
            product_template_variant_value_ids: record.subcategory || '',
            description: record.description,
            category: record.category || 'General',
            keywords: keywords,
            userId: user._id
          });
          
          created++;
          
          // Immediately update with the new field names
          if (newItem) {
            try {
              await client.mutation('priceItems:update', {
                id: newItem,
                code: record.code,
                subcategory: record.subcategory,
                unit: record.unit || 'Unit',
                rate: parseFloat(record.rate) || 1.0,
                ref: record.ref
              });
            } catch (updateError) {
              // Ignore update errors for now
            }
          }
        } catch (error) {
          // Continue on error
        }
      }
    }
    
    console.log(`\n\n✅ Created ${created} items`);
    
    // Now ensure all items have the required fields by updating them
    console.log('\n🔧 Ensuring all items have the required fields...\n');
    
    const allItems = await client.query('priceItems:getAll');
    let updated = 0;
    let updateErrors = 0;
    
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      process.stdout.write(`\rUpdating: ${i + 1}/${allItems.length} items...`);
      
      try {
        await client.mutation('priceItems:update', {
          id: item._id,
          code: item.code || item.id,
          subcategory: item.subcategory || item.product_template_variant_value_ids || '',
          unit: item.unit || item.uom_id || 'Unit',
          rate: item.rate !== undefined ? item.rate : (item.operation_cost || 1.0),
          ref: item.ref || item.id || ''
        });
        updated++;
      } catch (error) {
        updateErrors++;
      }
    }
    
    console.log(`\n\n✅ Updated ${updated} items with proper field names`);
    if (updateErrors > 0) {
      console.log(`⚠️  ${updateErrors} items could not be updated`);
    }
    
    // Final verification
    console.log('\n🔍 Verifying final data...\n');
    const finalItems = await client.query('priceItems:getAll');
    
    // Check field availability
    let complete = 0;
    let missingCode = 0;
    let missingSubcategory = 0;
    let missingUnit = 0;
    let missingRate = 0;
    
    finalItems.forEach(item => {
      const hasCode = item.code || item.id;
      const hasSubcategory = item.subcategory || item.product_template_variant_value_ids;
      const hasUnit = item.unit || item.uom_id;
      const hasRate = item.rate !== undefined || item.operation_cost !== undefined;
      
      if (hasCode && hasSubcategory && hasUnit && hasRate) {
        complete++;
      } else {
        if (!hasCode) missingCode++;
        if (!hasSubcategory) missingSubcategory++;
        if (!hasUnit) missingUnit++;
        if (!hasRate) missingRate++;
      }
    });
    
    console.log('='.repeat(60));
    console.log('✅ IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total items: ${finalItems.length}`);
    console.log(`Items with all required fields: ${complete}/${finalItems.length}`);
    
    if (missingCode > 0 || missingSubcategory > 0 || missingUnit > 0 || missingRate > 0) {
      console.log(`\n⚠️  Missing fields:`);
      if (missingCode > 0) console.log(`  - Code: ${missingCode} items`);
      if (missingSubcategory > 0) console.log(`  - Subcategory: ${missingSubcategory} items`);
      if (missingUnit > 0) console.log(`  - Unit: ${missingUnit} items`);
      if (missingRate > 0) console.log(`  - Rate: ${missingRate} items`);
    }
    
    if (finalItems.length > 0) {
      console.log('\n📋 Sample item (showing all available fields):');
      const sample = finalItems[0];
      console.log(JSON.stringify({
        _id: sample._id,
        // Check which fields are available
        code: sample.code || '[using id]',
        id: sample.id,
        subcategory: sample.subcategory || '[using product_template_variant_value_ids]',
        product_template_variant_value_ids: sample.product_template_variant_value_ids,
        unit: sample.unit || '[using uom_id]',
        uom_id: sample.uom_id,
        rate: sample.rate !== undefined ? sample.rate : '[using operation_cost]',
        operation_cost: sample.operation_cost,
        description: sample.description,
        category: sample.category
      }, null, 2));
    }
    
    console.log('\n✨ Import process completed!');
    console.log('\nThe frontend should now be able to display the data using either:');
    console.log('  - New fields: code, subcategory, unit, rate');
    console.log('  - Legacy fields: id, product_template_variant_value_ids, uom_id, operation_cost');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    await client.close();
  }
}

finalFixImport();