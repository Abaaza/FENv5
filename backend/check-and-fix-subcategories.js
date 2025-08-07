const { ConvexClient } = require('convex/browser');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://bright-scorpion-424.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function checkAndFixSubcategories() {
  try {
    console.log('🔍 Checking subcategory fields in database...');
    console.log('Convex URL:', CONVEX_URL);
    
    // Get all items
    const allItems = await client.query('priceItems:getAll');
    console.log(`\n📊 Total items: ${allItems ? allItems.length : 0}`);
    
    // Check for items with __export__ in ref or subcategory
    let itemsWithExportPrefix = 0;
    let sampleItems = [];
    
    if (allItems) {
      allItems.forEach(item => {
        if ((item.ref && item.ref.includes('__export__')) || 
            (item.subcategory && item.subcategory.includes('__export__'))) {
          itemsWithExportPrefix++;
          if (sampleItems.length < 5) {
            sampleItems.push({
              description: item.description,
              ref: item.ref,
              subcategory: item.subcategory
            });
          }
        }
      });
    }
    
    console.log(`\n⚠️  Items with __export__ prefix: ${itemsWithExportPrefix}`);
    
    if (sampleItems.length > 0) {
      console.log('\n📦 Sample items with __export__ prefix:');
      sampleItems.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.description}`);
        if (item.ref && item.ref.includes('__export__')) {
          console.log(`   REF: ${item.ref}`);
        }
        if (item.subcategory && item.subcategory.includes('__export__')) {
          console.log(`   SUBCATEGORY: ${item.subcategory}`);
        }
      });
    }
    
    // Get user for updates
    const user = await client.query('users:getByEmail', { email: 'abaza@tfp.com' });
    if (!user) {
      console.error('❌ Admin user not found');
      return;
    }
    
    if (itemsWithExportPrefix > 0) {
      console.log('\n🔧 Fixing items with __export__ prefix...');
      
      let fixed = 0;
      const batchSize = 10;
      
      for (let i = 0; i < allItems.length; i += batchSize) {
        const batch = allItems.slice(i, Math.min(i + batchSize, allItems.length));
        
        for (const item of batch) {
          let needsUpdate = false;
          let updates = {};
          
          // Clean ref field
          if (item.ref && item.ref.includes('__export__')) {
            updates.ref = item.ref.replace('__export__.product_product_', '');
            needsUpdate = true;
          }
          
          // Clean subcategory field (if it has the prefix)
          if (item.subcategory && item.subcategory.includes('__export__')) {
            updates.subcategory = item.subcategory.replace('__export__.product_product_', '');
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            try {
              // Try to update the item
              await client.mutation('priceItems:updateById', {
                id: item._id,
                ...item,
                ...updates,
                userId: user._id
              });
              fixed++;
            } catch (err) {
              // If updateById doesn't work, try create to overwrite
              try {
                await client.mutation('priceItems:create', {
                  ...item,
                  ...updates,
                  userId: user._id
                });
                fixed++;
              } catch (err2) {
                console.error(`Failed to fix item ${item._id}: ${err2.message}`);
              }
            }
          }
        }
        
        if ((i + batchSize) % 100 === 0 || i + batchSize >= allItems.length) {
          console.log(`Processed ${Math.min(i + batchSize, allItems.length)}/${allItems.length} items, fixed ${fixed} items`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`\n✅ Fixed ${fixed} items with __export__ prefix`);
    } else {
      console.log('\n✅ No items need fixing - all refs and subcategories are clean!');
    }
    
    // Show final sample
    console.log('\n📊 Final check - sample items:');
    const finalItems = await client.query('priceItems:getAll');
    if (finalItems && finalItems.length > 0) {
      finalItems.slice(0, 5).forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.description}`);
        if (item.ref) console.log(`   REF: ${item.ref}`);
        if (item.subcategory) console.log(`   SUBCATEGORY: ${item.subcategory}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkAndFixSubcategories();