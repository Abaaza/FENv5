import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeExcelFile(filePath: string, fileName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`ANALYZING: ${fileName}`);
  console.log('='.repeat(80));
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log(`\nWorksheets: ${workbook.worksheets.length}`);
  
  for (const worksheet of workbook.worksheets) {
    console.log(`\n\nWORKSHEET: "${worksheet.name}"`);
    console.log(`Dimensions: ${worksheet.rowCount} rows x ${worksheet.columnCount} columns`);
    console.log('\nFirst 10 rows structure:');
    console.log('-'.repeat(80));
    
    for (let rowNum = 1; rowNum <= Math.min(10, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      const values = [];
      
      // Get all cell values in the row
      for (let col = 1; col <= worksheet.columnCount; col++) {
        const cell = row.getCell(col);
        const value = cell.value?.toString() || '';
        if (value) {
          values.push(`Col${col}: "${value.substring(0, 30)}${value.length > 30 ? '...' : ''}"`);
        }
      }
      
      if (values.length > 0) {
        console.log(`\nRow ${rowNum}: ${values.length} filled cells`);
        console.log(values.join(' | '));
      }
    }
    
    // Look for potential header rows
    console.log('\n\nPotential Header Rows:');
    console.log('-'.repeat(40));
    
    for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      const values = [];
      
      for (let col = 1; col <= worksheet.columnCount; col++) {
        const value = row.getCell(col).value?.toString() || '';
        if (value) values.push(value);
      }
      
      // Check if it might be a header row
      const lowerValues = values.join(' ').toLowerCase();
      if (values.length >= 3 || 
          lowerValues.includes('description') || 
          lowerValues.includes('item') ||
          lowerValues.includes('quantity') ||
          lowerValues.includes('qty') ||
          lowerValues.includes('unit') ||
          lowerValues.includes('rate') ||
          lowerValues.includes('amount')) {
        console.log(`\nRow ${rowNum}: [POTENTIAL HEADER]`);
        values.forEach((val, idx) => {
          console.log(`  Col ${idx + 1}: "${val}"`);
        });
      }
    }
    
    // Sample data rows with quantities
    console.log('\n\nSample Data Rows (with numeric values):');
    console.log('-'.repeat(40));
    
    let sampleCount = 0;
    for (let rowNum = 1; rowNum <= worksheet.rowCount && sampleCount < 5; rowNum++) {
      const row = worksheet.getRow(rowNum);
      let hasNumeric = false;
      const rowData = [];
      
      for (let col = 1; col <= worksheet.columnCount; col++) {
        const cell = row.getCell(col);
        const value = cell.value;
        
        if (typeof value === 'number' && value > 0) {
          hasNumeric = true;
        }
        
        if (value !== null && value !== undefined && value !== '') {
          rowData.push({
            col: col,
            value: value,
            type: typeof value
          });
        }
      }
      
      if (hasNumeric && rowData.length > 0) {
        console.log(`\nRow ${rowNum}:`);
        rowData.forEach(data => {
          console.log(`  Col ${data.col}: ${data.value} (${data.type})`);
        });
        sampleCount++;
      }
    }
  }
}

async function main() {
  try {
    const testFilesDir = path.join(__dirname, '../../test-files');
    
    // Analyze TESTFILE - Copy.xlsx (working file)
    const testFilePath = path.join(testFilesDir, 'TESTFILE - Copy.xlsx');
    await analyzeExcelFile(testFilePath, 'TESTFILE - Copy.xlsx (WORKING)');
    
    // Analyze Testground.xlsx (problematic file)
    const testgroundPath = path.join(testFilesDir, 'Testground.xlsx');
    await analyzeExcelFile(testgroundPath, 'Testground.xlsx (PROBLEMATIC)');
    
  } catch (error) {
    console.error('Error analyzing files:', error);
  }
}

main();
