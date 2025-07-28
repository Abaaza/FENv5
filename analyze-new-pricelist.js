const ExcelJS = require('exceljs');
const path = require('path');

async function analyzePricelistSchema() {
    const workbook = new ExcelJS.Workbook();
    const filePath = 'C:\\Users\\abaza\\Downloads\\asdasdasdasfddfdfd.xlsx';
    
    try {
        await workbook.xlsx.readFile(filePath);
        
        console.log('=== Excel File Analysis ===');
        console.log(`Number of worksheets: ${workbook.worksheets.length}`);
        console.log('');
        
        workbook.worksheets.forEach((worksheet, index) => {
            console.log(`\n=== Worksheet ${index + 1}: ${worksheet.name} ===`);
            console.log(`Total rows: ${worksheet.rowCount}`);
            console.log(`Total columns: ${worksheet.columnCount}`);
            
            // Get headers (assuming first row)
            const headers = [];
            const firstRow = worksheet.getRow(1);
            firstRow.eachCell((cell, colNumber) => {
                headers.push({
                    column: colNumber,
                    value: cell.value,
                    type: cell.type
                });
            });
            
            console.log('\nHeaders:');
            headers.forEach(header => {
                console.log(`  Column ${header.column}: ${header.value}`);
            });
            
            // Sample first 5 data rows
            console.log('\nSample data (first 5 rows):');
            for (let i = 2; i <= Math.min(6, worksheet.rowCount); i++) {
                const row = worksheet.getRow(i);
                const rowData = {};
                
                headers.forEach(header => {
                    const cell = row.getCell(header.column);
                    rowData[header.value] = cell.value;
                });
                
                console.log(`Row ${i}:`, JSON.stringify(rowData, null, 2));
            }
        });
        
    } catch (error) {
        console.error('Error reading Excel file:', error);
    }
}

analyzePricelistSchema();