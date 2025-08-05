const { ConvexClient } = require('convex/browser');
require('dotenv').config();

const client = new ConvexClient(process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud');

async function checkFields() {
  const items = await client.query('priceItems:getAll');
  
  console.log('Total items:', items.length);
  
  if (items.length > 0) {
    console.log('\nChecking field availability across all items:');
    
    let hasCode = 0;
    let hasSubcategory = 0;
    let hasUnit = 0;
    let hasRate = 0;
    let hasId = 0;
    let hasProductTemplate = 0;
    let hasUomId = 0;
    let hasOperationCost = 0;
    
    items.forEach(item => {
      if (item.code) hasCode++;
      if (item.subcategory) hasSubcategory++;
      if (item.unit) hasUnit++;
      if (item.rate !== undefined) hasRate++;
      if (item.id) hasId++;
      if (item.product_template_variant_value_ids) hasProductTemplate++;
      if (item.uom_id) hasUomId++;
      if (item.operation_cost !== undefined) hasOperationCost++;
    });
    
    console.log('\nExpected fields (what frontend needs):');
    console.log(`  code: ${hasCode}/${items.length}`);
    console.log(`  subcategory: ${hasSubcategory}/${items.length}`);
    console.log(`  unit: ${hasUnit}/${items.length}`);
    console.log(`  rate: ${hasRate}/${items.length}`);
    
    console.log('\nActual fields (what database has):');
    console.log(`  id: ${hasId}/${items.length}`);
    console.log(`  product_template_variant_value_ids: ${hasProductTemplate}/${items.length}`);
    console.log(`  uom_id: ${hasUomId}/${items.length}`);
    console.log(`  operation_cost: ${hasOperationCost}/${items.length}`);
    
    console.log('\nSample item:');
    console.log(JSON.stringify(items[0], null, 2));
  }
  
  await client.close();
}

checkFields();