const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const workbook = XLSX.readFile('C:\\Users\\abaza\\Downloads\\Product (product.product) (1).xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

console.log('=== EXCEL FILE ANALYSIS ===');
console.log(`Total rows: ${data.length}`);
console.log(`\nColumns available:`);
console.log(Object.keys(data[0]));

console.log('\n=== First 10 rows ===');
data.slice(0, 10).forEach((row, index) => {
  console.log(`\n--- Row ${index + 1} ---`);
  Object.entries(row).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
});

// Analyze what data we have
const hasPrice = data.filter(row => parseFloat(row.operation_cost) > 0).length;
const hasUnit = data.filter(row => row.uom_id && row.uom_id !== '').length;
const uniqueUnits = new Set(data.map(row => row.uom_id).filter(Boolean));

console.log('\n=== DATA SUMMARY ===');
console.log(`Items with price > 0: ${hasPrice}`);
console.log(`Items with unit: ${hasUnit}`);
console.log(`Unique units: ${Array.from(uniqueUnits).join(', ')}`);

// Check for missing data
const missingData = data.filter(row => {
  const price = parseFloat(row.operation_cost) || 0;
  const unit = row.uom_id || '';
  return price === 0 || unit === '';
});

console.log(`\nItems with missing price or unit: ${missingData.length}`);
if (missingData.length > 0) {
  console.log('Sample items with missing data:');
  missingData.slice(0, 5).forEach((row, index) => {
    console.log(`  ${row.name} - Price: ${row.operation_cost || 'MISSING'}, Unit: ${row.uom_id || 'MISSING'}`);
  });
}