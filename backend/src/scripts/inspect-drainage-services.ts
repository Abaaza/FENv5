import ExcelJS from 'exceljs';
import path from 'path';

async function inspectProblematicSheets(): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), '..', 'MJD-PRICELIST.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const sheets = ['Drainage', 'Services', 'External Works'];
    
    for (const sheetName of sheets) {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) continue;
      
      console.log(`\n\n===== ${sheetName} Sheet Analysis =====`);
      console.log(`Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}`);
      
      // Find rows with data
      let rowsWithData = 0;
      let rowsWithRates = 0;
      
      console.log('\nRows with potential price data (showing first 50):');
      
      for (let i = 1; i <= Math.min(worksheet.rowCount, 200); i++) {
        const row = worksheet.getRow(i);
        const values = [];
        let hasData = false;
        let rateValue = null;
        
        for (let j = 1; j <= Math.min(worksheet.columnCount, 10); j++) {
          const cell = row.getCell(j);
          const value = cell.value;
          
          if (value) {
            hasData = true;
            let displayValue = '';
            
            if (typeof value === 'object' && 'result' in value) {
              displayValue = `${(value as any).result}`;
              // Check if this looks like a rate
              const numVal = parseFloat((value as any).result);
              if (!isNaN(numVal) && numVal > 0 && j >= 5 && j <= 8) {
                rateValue = numVal;
              }
            } else if (typeof value === 'object') {
              displayValue = '[object]';
            } else {
              displayValue = value.toString().substring(0, 30);
              // Check if this looks like a rate
              const numVal = parseFloat(value.toString());
              if (!isNaN(numVal) && numVal > 0 && j >= 5 && j <= 8) {
                rateValue = numVal;
              }
            }
            
            if (displayValue) {
              values.push(`[${j}]: ${displayValue}`);
            }
          }
        }
        
        if (hasData) {
          rowsWithData++;
          if (rateValue) {
            rowsWithRates++;
            if (rowsWithRates <= 50) {
              console.log(`Row ${i}: ${values.join(' | ')}`);
            }
          }
        }
      }
      
      console.log(`\nSummary: ${rowsWithData} rows with data, ${rowsWithRates} rows with rate values`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

inspectProblematicSheets();
