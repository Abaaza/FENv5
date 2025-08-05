const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function fixFieldNames() {
  try {
    console.log('🔧 Fixing field names in price items...\n');
    
    // Get admin user
    const user = await client.query('users:getByEmail', { email: 'abaza@tfp.com' });
    if (!user) {
      console.error('❌ Admin user not found');
      return;
    }
    
    // Clear all existing items first
    console.log('🗑️  Clearing existing items...');
    const existingItems = await client.query('priceItems:getAll');
    
    if (existingItems.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < existingItems.length; i += batchSize) {
        const batch = existingItems.slice(i, Math.min(i + batchSize, existingItems.length));
        const ids = batch.map(item => item._id);
        await client.mutation('priceItems:deleteBatch', { ids });
        console.log(`  Deleted ${i + batch.length}/${existingItems.length} items`);
      }
    }
    
    console.log('\n📥 Importing with correct field names...\n');
    
    // Read the complete price list CSV
    const csvPath = path.join(__dirname, 'complete-pricelist.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    // Process in batches with correct field mapping
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, records.length);
      const batch = records.slice(start, end);
      
      console.log(`Processing batch ${i + 1}/${totalBatches}...`);
      
      // Create price items with ALL the correct fields
      for (const record of batch) {
        const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
        
        try {
          await client.mutation('priceItems:create', {
            // Primary ID field
            id: record.code,
            
            // Core fields that MUST be populated
            code: record.code,
            ref: record.ref,
            description: record.description,
            category: record.category || 'General',
            subcategory: record.subcategory,
            unit: record.unit || 'Unit',
            rate: parseFloat(record.rate) || 1.0,
            keywords: keywords,
            
            // User ID
            userId: user._id
          });
        } catch (error) {
          console.error(`Error creating item ${record.code}:`, error.message);
        }
      }
      
      console.log(`  ✅ Batch ${i + 1} complete`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Verify the results
    console.log('\n🔍 Verifying field names...\n');
    const finalItems = await client.query('priceItems:getAll');
    
    // Check a sample item
    if (finalItems.length > 0) {
      const sample = finalItems[0];
      console.log('Sample item structure:');
      console.log(`  code: ${sample.code || 'MISSING'}`);
      console.log(`  subcategory: ${sample.subcategory || 'MISSING'}`);
      console.log(`  unit: ${sample.unit || 'MISSING'}`);
      console.log(`  rate: ${sample.rate !== undefined ? sample.rate : 'MISSING'}`);
      console.log(`  description: ${sample.description}`);
      console.log(`  category: ${sample.category}`);
    }
    
    // Count items with all required fields
    const complete = finalItems.filter(item => 
      item.code && 
      item.subcategory && 
      item.unit && 
      item.rate !== undefined
    ).length;
    
    console.log(`\n✅ Import complete!`);
    console.log(`Total items: ${finalItems.length}`);
    console.log(`Items with all fields: ${complete}`);
    console.log(`\nThe frontend should now display all fields correctly.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixFieldNames();