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

// Define CSV headers matching the schema
const headers = [
  'id',
  'code',
  'ref',
  'description',
  'category',
  'subcategory',
  'unit',
  'rate',
  'material_type',
  'material_grade',
  'material_size',
  'material_finish',
  'work_type',
  'brand',
  'labor_rate',
  'material_rate',
  'wastage_percentage',
  'supplier',
  'location',
  'availability',
  'remark',
  'keywords',
  'isActive'
];

// Create CSV content
let csvContent = headers.join(',') + '\n';

// Add data rows
priceItems.forEach(item => {
  const row = headers.map(header => {
    if (header === 'isActive') {
      return 'true'; // All items are active
    }
    return escapeCSV(item[header] || '');
  });
  csvContent += row.join(',') + '\n';
});

// Write CSV file
const csvPath = path.join(__dirname, 'tfp-pricelist.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');

console.log(`✅ Exported ${priceItems.length} items to: tfp-pricelist.csv`);
console.log('\nCSV file created with the following columns:');
console.log(headers.join(', '));
console.log('\n📁 File location: ' + csvPath);

// Also create a simplified version with essential columns only
const essentialHeaders = [
  'code',
  'description',
  'category',
  'subcategory',
  'unit',
  'rate',
  'brand',
  'keywords'
];

let simpleCsvContent = essentialHeaders.join(',') + '\n';

priceItems.forEach(item => {
  const row = essentialHeaders.map(header => {
    return escapeCSV(item[header] || '');
  });
  simpleCsvContent += row.join(',') + '\n';
});

const simpleCsvPath = path.join(__dirname, 'tfp-pricelist-simple.csv');
fs.writeFileSync(simpleCsvPath, simpleCsvContent, 'utf8');

console.log(`\n✅ Also created simplified version: tfp-pricelist-simple.csv`);
console.log('Simplified version includes only: ' + essentialHeaders.join(', '));