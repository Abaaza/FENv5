const fs = require('fs');
const path = require('path');

// Read the converted data
const dataPath = path.join(__dirname, 'data', 'tfp-pricelist.json');
const priceItems = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Function to escape CSV values
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  
  // Convert arrays to semicolon-separated strings
  if (Array.isArray(value)) {
    value = value.join('; ');
  }
  
  // Convert to string
  value = String(value);
  
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  
  return value;
}

// Define CSV headers - exactly as requested
const headers = [
  '_id',
  'code',
  'ref',
  'description',
  'category',
  'subcategory',
  'unit',
  'rate',
  'keywords'
];

// Create CSV content
let csvContent = headers.join(',') + '\n';

// Add data rows
priceItems.forEach(item => {
  const row = headers.map(header => {
    // Map _id to the item's _id field
    if (header === '_id') {
      return escapeCSV(item._id || item.id);
    }
    return escapeCSV(item[header] || '');
  });
  csvContent += row.join(',') + '\n';
});

// Write CSV file
const csvPath = path.join(__dirname, 'tfp-pricelist-final.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');

console.log(`✅ Exported ${priceItems.length} items to: tfp-pricelist-final.csv`);
console.log('\nCSV file created with the following columns:');
console.log(headers.join(', '));
console.log('\n📁 File location: ' + csvPath);
console.log('\nSample first row:');
console.log(headers.join(','));
const firstItem = priceItems[0];
const firstRow = headers.map(header => {
  if (header === '_id') {
    return escapeCSV(firstItem._id || firstItem.id);
  }
  return escapeCSV(firstItem[header] || '');
});
console.log(firstRow.join(','));