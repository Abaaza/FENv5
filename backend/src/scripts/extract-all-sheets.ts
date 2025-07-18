import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

interface PriceItem {
  _id: string;
  code: string;
  ref: string;
  description: string;
  category: string;
  subcategory: string;
  unit: string;
  rate: number;
  keywords: string[];
}

// Construction terms mapping (same as before)
const constructionTerms: Record<string, string[]> = {
  'exc': ['excavation', 'excavate', 'dig', 'earthwork', 'earthworks', 'cut', 'fill'],
  'conc': ['concrete', 'cement', 'pour', 'casting', 'mix', 'grade'],
  'reinf': ['reinforcement', 'rebar', 'steel bars', 'reinforcing', 'mesh', 'fabric'],
  'drain': ['drainage', 'sewage', 'waste water', 'sewer', 'gully', 'manhole', 'pipe'],
  'pipe': ['piping', 'plumbing', 'conduit', 'pipes', 'duct', 'tube'],
  'cable': ['wire', 'electrical', 'conductor', 'wiring', 'conduit'],
  'channel': ['drain', 'gutter', 'flow', 'runoff'],
  'chamber': ['manhole', 'inspection', 'access', 'pit'],
  'hydrant': ['fire', 'water', 'supply', 'emergency'],
  'street': ['furniture', 'lighting', 'bollard', 'post', 'sign'],
  'paving': ['pavement', 'surface', 'tarmac', 'asphalt', 'concrete'],
  'kerb': ['curb', 'edge', 'channel', 'boundary'],
  'underpin': ['underpinning', 'support', 'foundation', 'stabilization', 'needle', 'pit']
};

function generateKeywords(description: string, category: string, subcategory: string = ""): string[] {
  const keywords: Set<string> = new Set();
  const descLower = description.toLowerCase();
  
  // Extract words from description
  const words = descLower.match(/\b\w+\b/g) || [];
  
  // Add significant words
  const excludeWords = ['the', 'and', 'for', 'with', 'including', 'all', 'per', 'any', 'item', 'supply', 'install'];
  words.forEach(word => {
    if (word.length > 3 && !excludeWords.includes(word)) {
      keywords.add(word);
    }
  });
  
  // Add category and subcategory
  if (category) {
    keywords.add(category.toLowerCase());
    keywords.add(category.toLowerCase().replace(/\s*works?\s*/gi, ''));
  }
  if (subcategory) {
    keywords.add(subcategory.toLowerCase());
  }
  
  // Find and add related construction terms
  Object.entries(constructionTerms).forEach(([abbr, terms]) => {
    if (descLower.includes(abbr)) {
      terms.forEach(term => keywords.add(term));
    }
  });
  
  // Extract measurements
  const measurements = descLower.match(/\b\d+\s*(?:mm|cm|m|kg|kn|mpa|ton|tonnes?|liters?|litres?|m2|m3|sqm|cum|lm|rm|no|nr|thick|thk|dia|dp)\b/gi) || [];
  measurements.forEach(m => keywords.add(m.trim().toLowerCase()));
  
  return Array.from(keywords);
}

function extractCellValue(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (!value) return '';
  
  if (typeof value === 'object' && 'richText' in value) {
    return (value as any).richText?.map((rt: any) => rt.text).join('') || '';
  } else if (typeof value === 'object' && 'text' in value) {
    return (value as any).text || '';
  } else if (typeof value === 'object' && 'result' in value) {
    return (value as any).result?.toString() || '';
  } else if (typeof value === 'object') {
    return '[object]';
  }
  
  return value.toString();
}

function extractNumericValue(cell: ExcelJS.Cell): number | null {
  const value = cell.value;
  if (!value) return null;
  
  let numStr = '';
  if (typeof value === 'object' && 'result' in value) {
    numStr = (value as any).result?.toString() || '';
  } else if (typeof value === 'number') {
    return value;
  } else {
    numStr = value.toString();
  }
  
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}

async function extractAllSheets(): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), '..', 'MJD-PRICELIST.xlsx');
    console.log('Reading Excel file from:', filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    // All category sheets to process
    const categorySheets = ['Groundworks', 'RC works', 'Drainage', 'Services', 'External Works', 'Underpinning'];
    const allItems: PriceItem[] = [];
    let globalCounter = 1;
    
    for (const sheetName of categorySheets) {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        console.log(`Skipping ${sheetName} - worksheet not found`);
        continue;
      }
      
      console.log(`\nProcessing ${sheetName} sheet...`);
      const category = sheetName.replace(' works', ' Works');
      let currentSubcategory = '';
      let itemsInCategory = 0;
      
      // Try to find description column and rate columns
      let descCol = -1;
      let rateColumns: number[] = [];
      let unitCol = -1;
      let headerRow = -1;
      
      // Scan first 30 rows to understand structure
      for (let i = 1; i <= Math.min(30, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        let foundDesc = false;
        let foundRate = false;
        
        for (let j = 1; j <= Math.min(15, worksheet.columnCount); j++) {
          const cellValue = extractCellValue(row.getCell(j)).toLowerCase();
          
          // Look for exact "description" header
          if (cellValue === 'description' && descCol === -1) {
            descCol = j;
            foundDesc = true;
            headerRow = i;
          }
          // Look for rate/price headers
          if ((cellValue === 'rate' || cellValue === 'price' || cellValue.includes('rate')) && !cellValue.includes('total')) {
            if (!rateColumns.includes(j)) {
              rateColumns.push(j);
              foundRate = true;
            }
          }
          // Look for unit header
          if (cellValue === 'unit' && unitCol === -1) {
            unitCol = j;
          }
        }
        
        if (foundDesc && foundRate) break;
      }
      
      // Default columns if not found
      if (descCol === -1) descCol = 2; // Usually column B
      if (rateColumns.length === 0) {
        // For different sheets, rates might be in different columns
        if (sheetName === 'Drainage' || sheetName === 'Services') {
          rateColumns = [9, 10]; // Based on inspection
        } else if (sheetName === 'External Works') {
          rateColumns = [5, 9]; // Based on inspection
        } else {
          rateColumns = [6, 7]; // Default
        }
      }
      if (unitCol === -1) {
        unitCol = sheetName === 'Services' ? 8 : 5; // Different for Services
      }
      
      console.log(`Column mapping: desc=${descCol}, unit=${unitCol}, rates=${rateColumns.join(',')}, headerRow=${headerRow}`);
      
      // Process rows starting after header
      const startRow = headerRow > 0 ? headerRow + 1 : 10; // Start after header or from row 10
      for (let i = startRow; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        
        // Get description
        const description = extractCellValue(row.getCell(descCol));
        if (!description || description === '[object]') continue;
        
        // Check if this is a subcategory
        const hasNoRate = rateColumns.every(col => {
          const val = extractNumericValue(row.getCell(col));
          return val === null || val === 0;
        });
        
        if (hasNoRate && description.length > 5) {
          // Check if it looks like a subcategory
          if (description.match(/^[A-Z\s,&-]+$/i) || 
              description.match(/^(preambles|pipework|excavat|filling|disposal|chambers|electrical|mechanical)/i)) {
            currentSubcategory = description.trim();
            console.log(`  Found subcategory: ${currentSubcategory}`);
            continue;
          }
        }
        
        // Try to get rate from any of the rate columns
        let rate = 0;
        for (const rateCol of rateColumns) {
          const rateVal = extractNumericValue(row.getCell(rateCol));
          if (rateVal && rateVal > 0) {
            rate = rateVal;
            break;
          }
        }
        
        // Get unit
        let unit = extractCellValue(row.getCell(unitCol));
        if (!unit || unit === '[object]') {
          // Try other common unit positions
          for (let j = 3; j <= 8; j++) {
            const cellVal = extractCellValue(row.getCell(j)).toLowerCase();
            if (cellVal && ['m', 'm2', 'm3', 'no', 'nr', 'item', 'sum', 'kg', 'tonne', 'lm', 'sqm'].includes(cellVal)) {
              unit = cellVal;
              break;
            }
          }
        }
        
        // Process items with valid rates
        if (rate > 0 && description.length > 5 && !description.includes('OH&P')) {
          const code = `${category.substring(0, 3).toUpperCase()}${globalCounter.toString().padStart(4, '0')}`;
          const unitClean = unit && unit !== '[object]' ? unit.trim().toUpperCase() : 'NO';
          
          const keywords = generateKeywords(description, category, currentSubcategory);
          
          const item: PriceItem = {
            _id: uuidv4(),
            code: code,
            ref: code,
            description: description.trim(),
            category: category,
            subcategory: currentSubcategory,
            unit: unitClean,
            rate: rate,
            keywords: keywords
          };
          
          allItems.push(item);
          globalCounter++;
          itemsInCategory++;
          
          if (itemsInCategory <= 3) {
            console.log(`  ${code}: ${description.substring(0, 50)}... [${unitClean}] Â£${rate.toFixed(2)}`);
          }
        }
      }
      
      console.log(`  Total items in ${category}: ${itemsInCategory}`);
    }
    
    console.log(`\n\nTotal items extracted: ${allItems.length}`);
    
    // Save outputs
    await fs.writeFile('mjd_complete_pricelist.json', JSON.stringify(allItems, null, 2));
    console.log('Saved to mjd_complete_pricelist.json');
    
    // CSV version
    const csvHeader = '_id,code,ref,description,category,subcategory,unit,rate,keywords\n';
    const csvRows = allItems.map(item => {
      const desc = item.description.replace(/"/g, '""');
      const subcat = item.subcategory.replace(/"/g, '""');
      const keywords = item.keywords.join('; ');
      return `"${item._id}","${item.code}","${item.ref}","${desc}","${item.category}","${subcat}","${item.unit}",${item.rate},"${keywords}"`;
    });
    await fs.writeFile('mjd_complete_pricelist.csv', csvHeader + csvRows.join('\n'));
    console.log('Saved to mjd_complete_pricelist.csv');
    
    // Summary
    console.log('\nSummary by category:');
    const categoryCounts: Record<string, number> = {};
    allItems.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} items`);
    });
    
    // Import-ready version
    const importData = allItems.map(item => ({
      code: item.code,
      ref: item.ref,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      unit: item.unit,
      rate: item.rate,
      keywords: item.keywords
    }));
    
    await fs.writeFile('mjd_pricelist_import_ready.json', JSON.stringify(importData, null, 2));
    console.log('\nSaved import-ready version to mjd_pricelist_import_ready.json');
    
  } catch (error) {
    console.error('Error extracting pricelist:', error);
  }
}

// Run extraction
extractAllSheets();
