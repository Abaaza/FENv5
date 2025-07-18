import { ExcelService } from '../services/excel.service';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const excelService = new ExcelService();

async function testExcelParsing() {
  console.log('\n=== TESTING EXCEL PARSING IMPROVEMENTS ===\n');
  
  const testFilesDir = path.join(__dirname, '../../test-files');
  
  // Test 1: TESTFILE - Copy.xlsx (should continue working)
  console.log('TEST 1: Parsing TESTFILE - Copy.xlsx (WORKING FILE)');
  console.log('=' .repeat(60));
  try {
    const testFilePath = path.join(testFilesDir, 'TESTFILE - Copy.xlsx');
    const buffer = await fs.readFile(testFilePath);
    const result = await excelService.parseExcelFile(buffer, 'TESTFILE - Copy.xlsx');
    
    console.log('\nParsing Result:');
    console.log(`- Total items found: ${result.totalItems}`);
    console.log(`- Sheets parsed: ${result.sheets.length}`);
    
    for (const sheet of result.sheets) {
      console.log(`\n  Sheet: "${sheet.sheetName}"`);
      console.log(`  - Items: ${sheet.items.length}`);
      console.log(`  - Headers: ${sheet.headers.join(', ')}`);
      
      // Show first 3 items with quantities
      const itemsWithQty = sheet.items.filter(item => item.quantity && item.quantity > 0);
      console.log(`  - Items with quantities: ${itemsWithQty.length}`);
      console.log(`  - Context headers: ${sheet.items.length - itemsWithQty.length}`);
      
      if (itemsWithQty.length > 0) {
        console.log('\n  Sample items with quantities:');
        itemsWithQty.slice(0, 3).forEach((item, idx) => {
          console.log(`    ${idx + 1}. Row ${item.rowNumber}: ${item.quantity} ${item.unit} - ${item.description.substring(0, 50)}...`);
        });
      }
    }
    
    console.log('\nâœ… TESTFILE parsing: SUCCESS');
  } catch (error) {
    console.error('\nâŒ TESTFILE parsing: FAILED');
    console.error(error);
  }
  
  // Test 2: Testground.xlsx (previously failing)
  console.log('\n\nTEST 2: Parsing Testground.xlsx (PROBLEMATIC FILE)');
  console.log('=' .repeat(60));
  try {
    const testgroundPath = path.join(testFilesDir, 'Testground.xlsx');
    const buffer = await fs.readFile(testgroundPath);
    const result = await excelService.parseExcelFile(buffer, 'Testground.xlsx');
    
    console.log('\nParsing Result:');
    console.log(`- Total items found: ${result.totalItems}`);
    console.log(`- Sheets parsed: ${result.sheets.length}`);
    
    for (const sheet of result.sheets) {
      console.log(`\n  Sheet: "${sheet.sheetName}"`);
      console.log(`  - Items: ${sheet.items.length}`);
      console.log(`  - Headers: ${sheet.headers.join(', ')}`);
      
      // Show first 3 items with quantities
      const itemsWithQty = sheet.items.filter(item => item.quantity && item.quantity > 0);
      console.log(`  - Items with quantities: ${itemsWithQty.length}`);
      console.log(`  - Context headers: ${sheet.items.length - itemsWithQty.length}`);
      
      if (itemsWithQty.length > 0) {
        console.log('\n  Sample items with quantities:');
        itemsWithQty.slice(0, 3).forEach((item, idx) => {
          console.log(`    ${idx + 1}. Row ${item.rowNumber}: ${item.quantity} ${item.unit} - ${item.description.substring(0, 50)}...`);
        });
      }
    }
    
    console.log('\nâœ… Testground parsing: SUCCESS');
  } catch (error) {
    console.error('\nâŒ Testground parsing: FAILED');
    console.error(error);
  }
  
  console.log('\n\n=== TEST SUMMARY ===');
  console.log('Both Excel files should now parse correctly with the improved detection logic.');
}

testExcelParsing().catch(console.error);
