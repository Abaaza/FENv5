const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function quickImport() {
  try {
    // Read CSV
    const csvPath = path.join(__dirname, 'tfp-pricelist-final.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`Loaded ${records.length} items from CSV`);
    
    // Get user
    const user = await client.query('users:getByEmail', { email: 'abaza@tfp.com' });
    if (!user) {
      console.error('User not found');
      return;
    }
    
    // Check how many already exist
    const existing = await client.query('priceItems.js:getAll');
    console.log(`\nExisting items in database: ${existing.length}`);
    
    // Create a map of existing items by description for comparison
    const existingMap = new Map(existing.map(item => [item.description, item]));
    
    // Filter out items that already exist
    const newRecords = records.filter(record => !existingMap.has(record.description));
    console.log(`New items to import: ${newRecords.length}`);
    
    if (newRecords.length === 0) {
      console.log('\n✅ All items are already imported!');
      return;
    }
    
    // Import remaining items in larger batches
    const BATCH_SIZE = 100; // Larger batches
    const totalBatches = Math.ceil(newRecords.length / BATCH_SIZE);
    
    console.log(`\nImporting ${newRecords.length} new items in ${totalBatches} batches...`);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, newRecords.length);
      const batch = newRecords.slice(start, end);
      
      console.log(`Batch ${i + 1}/${totalBatches} (items ${start + 1}-${end})...`);
      
      const transformedItems = batch.map(record => {
        const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
        
        return {
          id: record._id,
          name: record.description,
          operation_cost: parseFloat(record.rate) || 0,
          uom_id: record.unit || 'Unit',
          product_template_variant_value_ids: record.ref || '',
          description: record.description,
          category: record.category,
          keywords: keywords
        };
      });
      
      try {
        await client.mutation('priceItems.js:createBatch', {
          items: transformedItems,
          userId: user._id,
        });
        console.log(`  ✅ Batch ${i + 1} complete`);
      } catch (error) {
        console.error(`  ❌ Error in batch ${i + 1}:`, error.message);
        // Continue with next batch
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final check
    const finalCount = await client.query('priceItems.js:getAll');
    console.log(`\n✅ Import complete! Total items in database: ${finalCount.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

quickImport();