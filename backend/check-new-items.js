const { ConvexClient } = require('convex/browser');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://bright-scorpion-424.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function checkNewItems() {
  try {
    console.log('🔍 Checking newly imported items...');
    
    // Get all items
    const allItems = await client.query('priceItems:getAll');
    console.log(`\n📊 Total items in database: ${allItems ? allItems.length : 0}`);
    
    // Check items from position 2300 onwards (the new ones)
    if (allItems && allItems.length > 2300) {
      console.log('\n📦 Sample of newly imported items (items 2301-2310):');
      const newItems = allItems.slice(2300, 2310);
      
      newItems.forEach((item, idx) => {
        console.log(`\n${2301 + idx}. ${item.description}`);
        console.log(`   Category: ${item.category || 'N/A'}`);
        console.log(`   Subcategory: ${item.subcategory || 'N/A'}`);
        console.log(`   Unit: ${item.unit || 'N/A'}`);
        console.log(`   Rate: £${item.rate || 0}`);
        if (item.ref) {
          console.log(`   Ref: ${item.ref}`);
          if (item.ref.includes('__export__')) {
            console.log('   ⚠️ WARNING: Ref still contains __export__ prefix!');
          }
        }
      });
      
      // Check last few items
      console.log('\n📦 Last 5 items in database:');
      const lastItems = allItems.slice(-5);
      
      lastItems.forEach((item, idx) => {
        console.log(`\n${allItems.length - 4 + idx}. ${item.description}`);
        console.log(`   Category: ${item.category || 'N/A'}`);
        console.log(`   Unit: ${item.unit || 'N/A'}`);
        console.log(`   Rate: £${item.rate || 0}`);
        if (item.ref) {
          console.log(`   Ref: ${item.ref}`);
        }
      });
    }
    
    // Count items with __export__ in ref
    let itemsWithExportInRef = 0;
    allItems.forEach(item => {
      if (item.ref && item.ref.includes('__export__')) {
        itemsWithExportInRef++;
      }
    });
    
    if (itemsWithExportInRef > 0) {
      console.log(`\n⚠️ ${itemsWithExportInRef} items still have __export__ in ref field`);
    } else {
      console.log('\n✅ All ref fields are clean (no __export__ prefix)');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkNewItems();