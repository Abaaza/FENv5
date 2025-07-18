import { ExcelService } from '../services/excel.service';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const excelService = new ExcelService();

async function testEmbeddedHeaders() {
  console.log('\n=== TESTING EMBEDDED HEADER EXTRACTION ===\n');
  
  const testFilesDir = path.join(__dirname, '../../test-files');
  
  // Test with Testground.xlsx
  console.log('Testing Testground.xlsx for embedded headers...');
  console.log('=' .repeat(60));
  
  try {
    const testgroundPath = path.join(testFilesDir, 'Testground.xlsx');
    const buffer = await fs.readFile(testgroundPath);
    const result = await excelService.parseExcelFile(buffer, 'Testground.xlsx');
    
    console.log(`\nTotal items found: ${result.totalItems}`);
    
    // Look for items with embedded headers
    for (const sheet of result.sheets) {
      console.log(`\nSheet: "${sheet.sheetName}"`);
      
      // Find items that have context headers
      const itemsWithContext = sheet.items.filter(item => 
        item.contextHeaders && item.contextHeaders.length > 0 && item.quantity
      );
      
      console.log(`Items with context headers: ${itemsWithContext.length}`);
      
      // Show first few examples
      itemsWithContext.slice(0, 3).forEach((item, idx) => {
        console.log(`\n${idx + 1}. Row ${item.rowNumber}:`);
        console.log(`   Context headers (${item.contextHeaders!.length}):`);
        item.contextHeaders!.forEach(header => {
          console.log(`     - "${header}"`);
        });
        console.log(`   Actual item: ${item.quantity} ${item.unit} - "${item.description}"`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmbeddedHeaders().catch(console.error);
