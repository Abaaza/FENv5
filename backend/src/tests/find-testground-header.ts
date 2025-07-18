import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findTestgroundHeader() {
  const testFilesDir = path.join(__dirname, '../../test-files');
  const testgroundPath = path.join(testFilesDir, 'Testground.xlsx');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(testgroundPath);
  
  // Focus on the Comparisons sheet which has the data
  const worksheet = workbook.getWorksheet('Comparisons');
  if (!worksheet) return;
  
  console.log('\nAnalyzing Comparisons sheet for header row...\n');
  
  // Check rows 15-25 which likely contain the header
  for (let rowNum = 15; rowNum <= 25; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values = [];
    
    // Get all values in the row
    for (let col = 1; col <= worksheet.columnCount; col++) {
      const cell = row.getCell(col);
      let value = cell.value;
      
      // Handle rich text objects
      if (value && typeof value === 'object' && 'richText' in value) {
        value = (value as any).richText?.map((rt: any) => rt.text).join('') || '';
      } else if (value && typeof value === 'object' && 'text' in value) {
        value = (value as any).text || '';
      }
      
      values.push(value?.toString() || '');
    }
    
    // Check if this row has the pattern we're looking for
    const hasDescription = values.some(v => v.toLowerCase() === 'description');
    const hasQuantity = values.some(v => v.toLowerCase() === 'quantity');
    const hasUnit = values.some(v => v.toLowerCase() === 'unit');
    const hasRef = values.some(v => v.toLowerCase() === 'ref');
    const singleChars = values.filter(v => v.length === 1).length;
    
    console.log(`Row ${rowNum}:`);
    console.log(`  Single chars: ${singleChars}`);
    console.log(`  Has Description: ${hasDescription}`);
    console.log(`  Has Quantity: ${hasQuantity}`);
    console.log(`  Has Unit: ${hasUnit}`);
    console.log(`  Has Ref: ${hasRef}`);
    
    if (singleChars > 0 || hasDescription || hasQuantity) {
      console.log(`  Values: ${JSON.stringify(values)}`);
    }
    
    console.log('');
    
    // Check the next row for actual data
    if (hasDescription || hasQuantity) {
      const nextRow = worksheet.getRow(rowNum + 1);
      console.log(`\n  Next row (${rowNum + 1}) sample:`);
      
      // Find which columns have Description, Quantity, Unit
      const descCol = values.findIndex(v => v.toLowerCase() === 'description');
      const qtyCol = values.findIndex(v => v.toLowerCase() === 'quantity');
      const unitCol = values.findIndex(v => v.toLowerCase() === 'unit');
      
      if (descCol >= 0) {
        let descValue = nextRow.getCell(descCol + 1).value;
        if (descValue && typeof descValue === 'object' && 'richText' in descValue) {
          descValue = (descValue as any).richText?.map((rt: any) => rt.text).join('') || '';
        }
        console.log(`    Description (col ${descCol + 1}): ${descValue}`);
      }
      
      if (qtyCol >= 0) {
        const qtyValue = nextRow.getCell(qtyCol + 1).value;
        console.log(`    Quantity (col ${qtyCol + 1}): ${qtyValue} (type: ${typeof qtyValue})`);
      }
      
      if (unitCol >= 0) {
        const unitValue = nextRow.getCell(unitCol + 1).value;
        console.log(`    Unit (col ${unitCol + 1}): ${unitValue}`);
      }
    }
  }
}

findTestgroundHeader().catch(console.error);
