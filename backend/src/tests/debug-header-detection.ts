import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugHeaderDetection() {
  const testFilesDir = path.join(__dirname, '../../test-files');
  const testgroundPath = path.join(testFilesDir, 'Testground.xlsx');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(testgroundPath);
  
  const worksheet = workbook.getWorksheet('Comparisons');
  if (!worksheet) return;
  
  console.log('\nChecking each row for header detection...\n');
  
  // Check each row
  for (let i = 1; i <= 25; i++) {
    const row = worksheet.getRow(i);
    
    // Get row values properly handling sparse arrays
    const rowValues = [];
    for (let col = 1; col <= worksheet.columnCount; col++) {
      const cell = row.getCell(col);
      let value = cell.value;
      
      // Handle rich text
      if (value && typeof value === 'object' && 'richText' in value) {
        value = (value as any).richText?.map((rt: any) => rt.text).join('') || '';
      } else if (value && typeof value === 'object' && 'text' in value) {
        value = (value as any).text || '';
      }
      
      rowValues.push(value);
    }
    
    const filledCells = rowValues.filter(v => v !== null && v !== undefined && v !== '').length;
    
    console.log(`Row ${i}: ${filledCells} filled cells`);
    
    if (i === 20) {
      console.log('  Row 20 analysis:');
      const cellStrings = rowValues.map(v => v?.toString() || '');
      const firstFewCells = cellStrings.slice(0, 7);
      const singleCharCount = firstFewCells.filter(s => s.length === 1).length;
      
      console.log(`  First 7 cells: ${JSON.stringify(firstFewCells)}`);
      console.log(`  Single char count: ${singleCharCount}`);
      console.log(`  Has Description: ${cellStrings.some(s => s.toLowerCase() === 'description')}`);
      console.log(`  Has Quantity: ${cellStrings.some(s => s.toLowerCase() === 'quantity')}`);
      console.log(`  Has Unit: ${cellStrings.some(s => s.toLowerCase() === 'unit')}`);
      console.log(`  All values: ${JSON.stringify(cellStrings)}`);
    }
  }
}

debugHeaderDetection().catch(console.error);
