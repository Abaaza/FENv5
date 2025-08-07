const { ConvexClient } = require('convex/browser');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://bright-scorpion-424.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function checkPriceItems() {
  try {
    console.log('Checking price items in Convex...');
    console.log('Convex URL:', CONVEX_URL);
    
    // Get all items to count
    const allItems = await client.query('priceItems:getAll');
    console.log('\n📊 Price Items Statistics:');
    console.log(`Total items: ${allItems ? allItems.length : 0}`);
    
    // Get categories
    const categories = await client.query('priceItems:getCategories');
    console.log(`Categories: ${categories ? categories.length : 0}`);
    
    // Get a sample of items
    const items = allItems ? allItems.slice(0, 10) : [];
    
    if (items && items.length > 0) {
      console.log(`\n📦 Sample items (showing first ${items.length}):`);
      items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.description || item.name} - Unit: ${item.unit || item.uom_id} - Rate: £${item.rate || item.operation_cost}`);
      });
    } else {
      console.log('\n⚠️ No price items found in database');
    }
    
    // Check for items with missing data
    console.log('\n🔍 Checking for completeness...');
    const searchTest = await client.query('priceItems:search', { 
      query: 'steel drill bit',
      limit: 5 
    });
    
    if (searchTest && searchTest.length > 0) {
      console.log(`✅ Search test passed - found ${searchTest.length} items for "steel drill bit"`);
    } else {
      console.log('⚠️ Search test failed - no items found for "steel drill bit"');
    }
    
  } catch (error) {
    console.error('Error checking price items:', error);
  } finally {
    await client.close();
  }
}

checkPriceItems();