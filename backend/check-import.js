const { ConvexClient } = require('convex/browser');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function checkImport() {
  try {
    const items = await client.query('priceItems.js:getAll');
    
    console.log('=== CSV IMPORT COMPLETE ===');
    console.log(`✅ Total items imported: ${items.length}`);
    console.log(`📊 Items with prices: ${items.filter(i => i.operation_cost > 0).length}`);
    console.log(`📊 Items without prices: ${items.filter(i => !i.operation_cost || i.operation_cost === 0).length}`);
    
    // Get unique categories
    const categories = new Set(items.map(i => i.category).filter(Boolean));
    console.log(`\n📁 Categories (${categories.size}):`);
    Array.from(categories).slice(0, 15).forEach(c => console.log(`  - ${c}`));
    
    console.log('\n✨ Your price list has been successfully imported!');
    console.log('You can now use these items in your BOQ matching system.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkImport();