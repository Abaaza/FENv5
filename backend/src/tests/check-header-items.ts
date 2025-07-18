import { ExcelService } from '../services/excel.service';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkHeaderItems() {
  const excelService = new ExcelService();
  const testFilesDir = path.join(__dirname, '../../test-files');
  const testgroundPath = path.join(testFilesDir, 'Testground.xlsx');
  const buffer = await fs.readFile(testgroundPath);
  const result = await excelService.parseExcelFile(buffer, 'Testground.xlsx');

  // Count header items (items without quantity)
  const sheet = result.sheets[0];
  const headerItems = sheet.items.filter(item => item.quantity === undefined || item.quantity === null);
  const dataItems = sheet.items.filter(item => item.quantity !== undefined && item.quantity !== null);

  console.log('\nHeader Items (without quantity):', headerItems.length);
  console.log('Data Items (with quantity):', dataItems.length);
  console.log('Total Items:', sheet.items.length);

  // Show first few header items
  console.log('\nFirst 5 Header Items:');
  headerItems.slice(0, 5).forEach((item, idx) => {
    console.log(`${idx + 1}. Row ${item.rowNumber}: "${item.description}"`);
  });

  // Check if items are properly ordered by row number
  const sortedItems = [...sheet.items].sort((a, b) => a.rowNumber - b.rowNumber);
  console.log('\nFirst 10 items ordered by row number:');
  sortedItems.slice(0, 10).forEach((item, idx) => {
    const type = item.quantity ? 'DATA' : 'HEADER';
    console.log(`${idx + 1}. Row ${item.rowNumber} [${type}]: "${item.description.substring(0, 60)}..."`);
  });
}

checkHeaderItems().catch(console.error);
