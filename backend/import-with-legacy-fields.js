const { ConvexClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function importWithLegacyFields() {
  try {
    console.log('🚀 Importing with legacy field names...\n');
    
    // Get admin user
    const user = await client.query('users:getByEmail', { email: 'abaza@tfp.com' });
    if (!user) {
      console.error('❌ Admin user not found');
      return;
    }
    
    // Read CSV
    const csvPath = path.join(__dirname, 'complete-pricelist.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`📊 Loaded ${records.length} items from CSV`);
    
    // Create items one by one with proper field mapping
    let created = 0;
    let failed = 0;
    
    for (let i = 0; i < Math.min(10, records.length); i++) {
      const record = records[i];
      const keywords = record.keywords ? record.keywords.split('; ').filter(k => k.trim()) : [];
      
      try {
        // Map to the expected field names
        const item = {
          // The system expects these specific fields
          id: record.code,
          name: record.description,  // 'name' is required
          operation_cost: parseFloat(record.rate) || 1.0,  // 'operation_cost' instead of 'rate'
          uom_id: record.unit || 'Unit',  // 'uom_id' instead of 'unit'
          product_template_variant_value_ids: record.subcategory || '',  // This instead of 'subcategory'
          
          // Additional fields
          description: record.description,
          category: record.category || 'General',
          keywords: keywords,
          
          userId: user._id
        };
        
        // First try with the create mutation that expects these fields
        await client.mutation('priceItems:create', item);
        
        created++;
        console.log(`✅ Created item ${i + 1}: ${record.description}`);
        
      } catch (error) {
        failed++;
        console.error(`❌ Failed item ${i + 1}: ${error.message}`);
        
        // Log what we tried to send
        console.log('  Attempted data:', {
          id: record.code,
          name: record.description,
          operation_cost: parseFloat(record.rate) || 1.0,
          uom_id: record.unit || 'Unit',
          product_template_variant_value_ids: record.subcategory || ''
        });
      }
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`  Created: ${created}`);
    console.log(`  Failed: ${failed}`);
    
    if (created > 0) {
      console.log('\n✅ Successfully created items with legacy field names!');
      console.log('\nTo import all items, modify this script to process all records.');
      
      // Check what fields are actually stored
      const items = await client.query('priceItems:getAll');
      if (items.length > 0) {
        console.log('\n📋 Actual stored fields:');
        const sample = items[items.length - 1];
        console.log(JSON.stringify(sample, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.close();
  }
}

importWithLegacyFields();