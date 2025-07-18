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

interface GroupedItem {
  baseDescription: string;
  variations: string[];
  category: string;
  subcategory: string;
  unit: string;
  rate: number;
  count: number;
}

// Construction terms mapping
const constructionTerms: Record<string, string[]> = {
  'exc': ['excavation', 'excavate', 'dig', 'earthwork', 'earthworks', 'cut', 'fill'],
  'conc': ['concrete', 'cement', 'pour', 'casting', 'mix', 'grade'],
  'reinf': ['reinforcement', 'rebar', 'steel bars', 'reinforcing', 'mesh', 'fabric'],
  'drain': ['drainage', 'sewage', 'waste water', 'sewer', 'gully', 'manhole', 'pipe'],
  'pipe': ['piping', 'plumbing', 'conduit', 'pipes', 'duct', 'tube'],
  'cable': ['wire', 'electrical', 'conductor', 'wiring', 'conduit'],
  'underpin': ['underpinning', 'support', 'foundation', 'stabilization', 'needle', 'pit'],
  'form': ['formwork', 'shuttering', 'mould', 'framework', 'falsework'],
  'steel': ['structural steel', 'metal work', 'fabrication', 'steelwork', 'beam', 'column'],
  'brick': ['brickwork', 'masonry', 'blockwork', 'blocks', 'wall'],
  'fill': ['filling', 'backfill', 'imported fill', 'granular', 'hardcore'],
  'compact': ['compaction', 'consolidation', 'level'],
  'dispose': ['disposal', 'cart away', 'remove', 'excavation arisings'],
  'ews': ['earthwork support', 'shoring', 'temporary support']
};

function generateKeywords(description: string, category: string, subcategory: string = ""): string[] {
  const keywords: Set<string> = new Set();
  const descLower = description.toLowerCase();
  
  // Extract words from description
  const words = descLower.match(/\b\w+\b/g) || [];
  
  // Add significant words
  const excludeWords = ['the', 'and', 'for', 'with', 'including', 'all', 'per', 'any', 'item', 'supply', 'install', 'between', 'during'];
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
  const measurements = descLower.match(/\b\d+\s*(?:mm|cm|m|kg|kn|mpa|ton|tonnes?|liters?|litres?|m2|m3|sqm|cum|lm|rm|no|nr|thick|thk|dia|dp|lg|wide)\b/gi) || [];
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

// Normalize description for grouping similar items
function normalizeDescription(desc: string): string {
  // Remove common size variations and specifics
  return desc
    .toLowerCase()
    .replace(/\b(ne|n\.e\.|not exceeding)\s+\d+[\d\.\s]*(mm|cm|m|thk|thick|dp|deep|wide|lg|long)\b/gi, 'SIZE_VAR')
    .replace(/\b\d+\s*(x|by)\s*\d+\s*(x|by)?\s*\d*\b/gi, 'DIM_VAR')
    .replace(/\b(type|grade)\s*[a-z]?\d+\b/gi, 'GRADE_VAR')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractOptimizedPricelist(): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), '..', 'MJD-PRICELIST.xlsx');
    console.log('Reading Excel file from:', filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const categorySheets = ['Groundworks', 'RC works', 'Drainage', 'Services', 'External Works', 'Underpinning'];
    const allRawItems: any[] = [];
    
    for (const sheetName of categorySheets) {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        console.log(`Skipping ${sheetName} - worksheet not found`);
        continue;
      }
      
      console.log(`\nProcessing ${sheetName} sheet...`);
      const category = sheetName.replace(' works', ' Works');
      let currentSubcategory = '';
      
      // Find columns - improved detection
      let descCol = -1;
      let unitCol = -1;
      let rateCol = -1;
      let headerRow = -1;
      
      // Scan for headers
      for (let i = 1; i <= Math.min(30, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        
        for (let j = 1; j <= Math.min(15, worksheet.columnCount); j++) {
          const cellValue = extractCellValue(row.getCell(j)).toLowerCase();
          
          if (cellValue === 'description' && descCol === -1) {
            descCol = j;
            headerRow = i;
          }
          if (cellValue === 'unit' && unitCol === -1) {
            unitCol = j;
          }
          if ((cellValue === 'rate' || cellValue === 'price') && rateCol === -1) {
            rateCol = j;
          }
        }
        
        if (descCol > 0 && unitCol > 0 && rateCol > 0) break;
      }
      
      // Default columns if not found
      if (descCol === -1) descCol = 2;
      if (unitCol === -1) unitCol = 5;
      if (rateCol === -1) rateCol = 6;
      
      // Special handling for different sheets
      if (sheetName === 'Underpinning') {
        // Check if the unit column actually contains units
        const testRow = worksheet.getRow(headerRow + 10);
        const testUnit = extractCellValue(testRow.getCell(unitCol));
        if (testUnit && !isNaN(parseFloat(testUnit))) {
          // Unit column contains numbers, shift columns
          unitCol = 4; // Usually column D
          rateCol = 5; // Usually column E
        }
      }
      
      console.log(`Column mapping: desc=${descCol}, unit=${unitCol}, rate=${rateCol}`);
      
      const startRow = headerRow > 0 ? headerRow + 1 : 10;
      
      for (let i = startRow; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        
        // Get description
        const description = extractCellValue(row.getCell(descCol));
        if (!description || description === '[object]') continue;
        
        // Get unit - with fallback logic
        let unit = extractCellValue(row.getCell(unitCol));
        
        // If unit looks like a number, try adjacent columns
        if (unit && !isNaN(parseFloat(unit))) {
          // Try column before
          const unitBefore = extractCellValue(row.getCell(unitCol - 1));
          // Try column after  
          const unitAfter = extractCellValue(row.getCell(unitCol + 1));
          
          // Check if any of these look like valid units
          const validUnits = ['m', 'm2', 'm3', 'no', 'nr', 'item', 'sum', 'kg', 'tonne', 'lm', 'sqm', 'load'];
          if (unitBefore && validUnits.some(u => unitBefore.toLowerCase().includes(u))) {
            unit = unitBefore;
          } else if (unitAfter && validUnits.some(u => unitAfter.toLowerCase().includes(u))) {
            unit = unitAfter;
          } else {
            // Still no valid unit, check description for unit hints
            const descLower = description.toLowerCase();
            if (descLower.includes('per m3') || descLower.includes('/m3')) unit = 'M3';
            else if (descLower.includes('per m2') || descLower.includes('/m2')) unit = 'M2';
            else if (descLower.includes('per m') || descLower.includes('/m')) unit = 'M';
            else if (descLower.includes('per load')) unit = 'LOAD';
            else if (descLower.includes('per nr') || descLower.includes('per no')) unit = 'NR';
            else unit = 'ITEM'; // Default
          }
        }
        
        // Get rate
        let rate = extractNumericValue(row.getCell(rateCol));
        
        // If no rate in expected column, try adjacent columns
        if (!rate || rate === 0) {
          for (let offset of [1, -1, 2]) {
            const altRate = extractNumericValue(row.getCell(rateCol + offset));
            if (altRate && altRate > 0) {
              rate = altRate;
              break;
            }
          }
        }
        
        // Check if this is a subcategory
        const hasNoRate = !rate || rate === 0;
        if (hasNoRate && description.length > 5) {
          if (description.match(/^[A-Z\s,&-]+$/i) || 
              description.match(/^(preambles|excavat|filling|disposal|concrete|reinforcement|formwork|pipework)/i)) {
            currentSubcategory = description.trim();
            continue;
          }
        }
        
        // Store items with valid rates
        if (rate && rate > 0 && description.length > 5) {
          const unitClean = unit && unit !== '[object]' && !unit.match(/^\d+$/) 
            ? unit.trim().toUpperCase() 
            : 'ITEM';
          
          allRawItems.push({
            description: description.trim(),
            category: category,
            subcategory: currentSubcategory,
            unit: unitClean,
            rate: rate
          });
        }
      }
    }
    
    console.log(`\nTotal raw items extracted: ${allRawItems.length}`);
    
    // Group similar items
    const groupedItems: Map<string, GroupedItem> = new Map();
    
    allRawItems.forEach(item => {
      const normalized = normalizeDescription(item.description);
      const groupKey = `${item.category}|${item.subcategory}|${normalized}|${item.unit}|${item.rate}`;
      
      if (groupedItems.has(groupKey)) {
        const group = groupedItems.get(groupKey)!;
        if (!group.variations.includes(item.description)) {
          group.variations.push(item.description);
          group.count++;
        }
      } else {
        groupedItems.set(groupKey, {
          baseDescription: item.description,
          variations: [item.description],
          category: item.category,
          subcategory: item.subcategory,
          unit: item.unit,
          rate: item.rate,
          count: 1
        });
      }
    });
    
    console.log(`\nGrouped into ${groupedItems.size} unique items`);
    
    // Convert grouped items to final price items
    const finalItems: PriceItem[] = [];
    let counter = 1;
    
    groupedItems.forEach(group => {
      // Create a comprehensive description if there are variations
      let finalDescription = group.baseDescription;
      if (group.count > 1) {
        // Extract size ranges from variations
        const sizes = new Set<string>();
        group.variations.forEach(v => {
          const sizeMatches = v.match(/\b(ne|n\.e\.)?\s*\d+[\d\.\s]*(mm|cm|m|thk|thick|dp|deep|wide|lg|long)\b/gi);
          if (sizeMatches) {
            sizeMatches.forEach(s => sizes.add(s.trim()));
          }
        });
        
        if (sizes.size > 1) {
          finalDescription = group.baseDescription.replace(/\b(ne|n\.e\.)?\s*\d+[\d\.\s]*(mm|cm|m|thk|thick|dp|deep|wide|lg|long)\b/gi, 'various sizes');
        }
      }
      
      const code = `${group.category.substring(0, 3).toUpperCase()}${counter.toString().padStart(4, '0')}`;
      const keywords = generateKeywords(finalDescription, group.category, group.subcategory);
      
      finalItems.push({
        _id: uuidv4(),
        code: code,
        ref: code,
        description: finalDescription,
        category: group.category,
        subcategory: group.subcategory,
        unit: group.unit,
        rate: group.rate,
        keywords: keywords
      });
      
      counter++;
    });
    
    // Sort by category and rate
    finalItems.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.rate - b.rate;
    });
    
    console.log(`\nFinal optimized items: ${finalItems.length}`);
    
    // Save outputs
    await fs.writeFile('mjd_optimized_pricelist.json', JSON.stringify(finalItems, null, 2));
    console.log('Saved to mjd_optimized_pricelist.json');
    
    // CSV version
    const csvHeader = '_id,code,ref,description,category,subcategory,unit,rate,keywords\n';
    const csvRows = finalItems.map(item => {
      const desc = item.description.replace(/"/g, '""');
      const subcat = item.subcategory.replace(/"/g, '""');
      const keywords = item.keywords.join('; ');
      return `"${item._id}","${item.code}","${item.ref}","${desc}","${item.category}","${subcat}","${item.unit}",${item.rate},"${keywords}"`;
    });
    await fs.writeFile('mjd_optimized_pricelist.csv', csvHeader + csvRows.join('\n'));
    console.log('Saved to mjd_optimized_pricelist.csv');
    
    // Summary
    console.log('\nSummary by category:');
    const categoryCounts: Record<string, number> = {};
    finalItems.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} items`);
    });
    
    // Import-ready version
    const importData = finalItems.map(item => ({
      code: item.code,
      ref: item.ref,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      unit: item.unit,
      rate: item.rate,
      keywords: item.keywords
    }));
    
    await fs.writeFile('mjd_optimized_import.json', JSON.stringify(importData, null, 2));
    console.log('\nSaved import-ready version to mjd_optimized_import.json');
    
  } catch (error) {
    console.error('Error extracting pricelist:', error);
  }
}

// Run extraction
extractOptimizedPricelist();
