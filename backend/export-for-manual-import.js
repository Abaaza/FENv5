const fs = require('fs');
const path = require('path');

// Read the converted data
const dataPath = path.join(__dirname, 'data', 'tfp-pricelist.json');
const priceItems = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Format for Convex import - remove _id and timestamps as they'll be auto-generated
const convexItems = priceItems.map(item => {
  const { _id, createdAt, updatedAt, isActive, ...convexItem } = item;
  return convexItem;
});

// Create export file
const exportPath = path.join(__dirname, 'tfp-pricelist-for-import.json');
fs.writeFileSync(exportPath, JSON.stringify(convexItems, null, 2));

console.log(`✅ Exported ${convexItems.length} items to: tfp-pricelist-for-import.json`);
console.log('\nThis file contains all 3603 items formatted for Convex import.');
console.log('Each item has the following structure:');
console.log(JSON.stringify(convexItems[0], null, 2));