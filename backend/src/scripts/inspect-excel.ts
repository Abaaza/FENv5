import ExcelJS from 'exceljs';
import path from 'path';

async function inspectExcel(): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), '..', 'MJD-PRICELIST.xlsx');
    console.log('Reading Excel file from:', filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    // First, let's check Set factors & prices sheet
    const worksheet = workbook.getWorksheet('Set factors & prices');
    if (!worksheet) {
      console.log('Could not find Set factors & prices worksheet');
      return;
    }
    
    console.log(`\nInspecting "Set factors & prices" sheet:`);
    console.log(`Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}`);
    
    // Print first 15 rows to understand structure
    console.log('\nFirst 15 rows:');
    for (let i = 1; i <= Math.min(15, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      const values = [];
      
      for (let j = 1; j <= Math.min(10, worksheet.columnCount); j++) {
        const cell = row.getCell(j);
        const value = cell.value?.toString() || '';
        if (value) {
          values.push(`[${j}]: ${value.substring(0, 30)}`);
        }
      }
      
      if (values.length > 0) {
        console.log(`Row ${i}: ${values.join(' | ')}`);
      }
    }
    
    // Now let's check the category sheets
    const categorySheets = ['Groundworks', 'RC works', 'Drainage', 'Services', 'External Works', 'Underpinning'];
    
    for (const sheetName of categorySheets) {
      const catSheet = workbook.getWorksheet(sheetName);
      if (catSheet) {
        console.log(`\n\nInspecting "${sheetName}" sheet:`);
        console.log(`Rows: ${catSheet.rowCount}, Columns: ${catSheet.columnCount}`);
        
        // Print first 30 rows to see more data
        console.log('\nFirst 30 rows:');
        for (let i = 1; i <= Math.min(30, catSheet.rowCount); i++) {
          const row = catSheet.getRow(i);
          const values = [];
          
          for (let j = 1; j <= Math.min(8, catSheet.columnCount); j++) {
            const cell = row.getCell(j);
            const value = cell.value?.toString() || '';
            if (value) {
              values.push(`[${j}]: ${value.substring(0, 25)}`);
            }
          }
          
          if (values.length > 0) {
            console.log(`Row ${i}: ${values.join(' | ')}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error inspecting Excel:', error);
  }
}

inspectExcel();
