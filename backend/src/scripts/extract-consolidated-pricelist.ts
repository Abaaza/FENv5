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

// Construction terms mapping
const constructionTerms: Record<string, string[]> = {
  'exc': ['excavation', 'excavate', 'dig', 'earthwork', 'earthworks', 'cut', 'fill'],
  'conc': ['concrete', 'cement', 'pour', 'casting', 'mix', 'grade'],
  'reinf': ['reinforcement', 'rebar', 'steel bars', 'reinforcing', 'mesh', 'fabric'],
  'drain': ['drainage', 'sewage', 'waste water', 'sewer', 'gully', 'manhole', 'pipe'],
  'pipe': ['piping', 'plumbing', 'conduit', 'pipes', 'duct', 'tube'],
  'underpin': ['underpinning', 'support', 'foundation', 'stabilization'],
  'form': ['formwork', 'shuttering', 'mould', 'framework'],
  'fill': ['filling', 'backfill', 'imported fill', 'granular'],
  'dispose': ['disposal', 'cart away', 'remove', 'arisings']
};

function generateKeywords(description: string, category: string, subcategory: string = ""): string[] {
  const keywords: Set<string> = new Set();
  const descLower = description.toLowerCase();
  
  // Extract words
  const words = descLower.match(/\b\w+\b/g) || [];
  const excludeWords = ['the', 'and', 'for', 'with', 'including', 'all', 'per', 'any'];
  words.forEach(word => {
    if (word.length > 3 && !excludeWords.includes(word)) {
      keywords.add(word);
    }
  });
  
  // Add category
  if (category) {
    keywords.add(category.toLowerCase().replace(/\s*works?\s*/gi, ''));
  }
  if (subcategory && subcategory.length > 3) {
    keywords.add(subcategory.toLowerCase());
  }
  
  // Add construction terms
  Object.entries(constructionTerms).forEach(([abbr, terms]) => {
    if (descLower.includes(abbr)) {
      terms.forEach(term => keywords.add(term));
    }
  });
  
  // Extract measurements
  const measurements = descLower.match(/\b\d+\s*(?:mm|m2|m3|m|kg|nr|no)\b/gi) || [];
  measurements.forEach(m => keywords.add(m.trim().toLowerCase()));
  
  return Array.from(keywords);
}

function extractCellValue(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (!value) return '';
  
  if (typeof value === 'object' && 'richText' in value) {
    return (value as any).richText?.map((rt: any) => rt.text).join('') || '';
  } else if (typeof value === 'object' && 'result' in value) {
    return (value as any).result?.toString() || '';
  } else if (typeof value === 'object') {
    return '';
  }
  
  return value.toString();
}

function extractNumericValue(cell: ExcelJS.Cell): number | null {
  const value = cell.value;
  if (!value) return null;
  
  if (typeof value === 'object' && 'result' in value) {
    const num = parseFloat((value as any).result?.toString() || '');
    return isNaN(num) ? null : num;
  } else if (typeof value === 'number') {
    return value;
  }
  
  const num = parseFloat(value.toString());
  return isNaN(num) ? null : num;
}

// Aggressive description consolidation
function consolidateDescription(desc: string): string {
  return desc
    .toLowerCase()
    // Remove all size variations
    .replace(/\b(ne|not exceeding|up to|over|under|below|above)?\s*\d+[\d\.\s\-]*(to|thru)?\s*\d*[\d\.\s]*(mm|cm|m|thk|thick|dp|deep|wide|lg|long|high|dia)\b/gi, '')
    // Remove dimensions
    .replace(/\b\d+\s*(x|by)\s*\d+\s*(x|by)?\s*\d*\b/gi, '')
    // Remove grades/types
    .replace(/\b(type|grade|class)\s*[a-z]?\d+[a-z]?\b/gi, '')
    // Remove quantities in descriptions
    .replace(/\b\d+\s*(no|nr|nos)\b/gi, '')
    // Normalize common variations
    .replace(/\bexcavat(e|ion|ing)\b/gi, 'excavate')
    .replace(/\bdispos(e|al|ing)\b/gi, 'disposal')
    .replace(/\bfill(ing)?\b/gi, 'fill')
    .replace(/\bcompact(ion|ing)?\b/gi, 'compact')
    .replace(/\bunderpin(ning)?\b/gi, 'underpin')
    .replace(/\bformwork|shuttering\b/gi, 'formwork')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractConsolidatedPricelist(): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), '..', 'MJD-PRICELIST.xlsx');
    console.log('Reading Excel file from:', filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const categorySheets = ['Groundworks', 'RC works', 'Drainage', 'Services', 'External Works', 'Underpinning'];
    const consolidatedItems: Map<string, any> = new Map();
    
    for (const sheetName of categorySheets) {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) continue;
      
      console.log(`\nProcessing ${sheetName}...`);
      const category = sheetName.replace(' works', ' Works');
      let currentSubcategory = '';
      
      // Column detection
      let descCol = -1, unitCol = -1, rateCol = -1, headerRow = -1;
      
      for (let i = 1; i <= Math.min(30, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        for (let j = 1; j <= Math.min(15, worksheet.columnCount); j++) {
          const cellValue = extractCellValue(row.getCell(j)).toLowerCase();
          if (cellValue === 'description') { descCol = j; headerRow = i; }
          if (cellValue === 'unit') unitCol = j;
          if (cellValue === 'rate' || cellValue === 'price') rateCol = j;
        }
        if (descCol > 0 && unitCol > 0 && rateCol > 0) break;
      }
      
      // Defaults
      if (descCol === -1) descCol = 2;
      if (unitCol === -1) unitCol = 5;
      if (rateCol === -1) rateCol = 6;
      
      const startRow = headerRow > 0 ? headerRow + 1 : 10;
      
      for (let i = startRow; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const description = extractCellValue(row.getCell(descCol));
        if (!description || description.length < 5) continue;
        
        // Get unit and rate
        let unit = extractCellValue(row.getCell(unitCol));
        let rate = extractNumericValue(row.getCell(rateCol));
        
        // Fix unit if it's a number
        if (unit && !isNaN(parseFloat(unit))) {
          // Look in adjacent columns or use default
          const validUnits = ['M', 'M2', 'M3', 'NO', 'NR', 'ITEM', 'SUM', 'KG', 'TONNE', 'LOAD', 'LM', 'SQM'];
          unit = validUnits.find(u => description.toUpperCase().includes(`PER ${u}`) || description.toUpperCase().includes(`/${u}`)) || 'ITEM';
        }
        
        // Skip if no rate
        if (!rate || rate <= 0) {
          // Check if it's a subcategory
          if (description.match(/^[A-Z\s,&-]+$/i)) {
            currentSubcategory = description.trim();
          }
          continue;
        }
        
        const unitClean = unit?.trim().toUpperCase() || 'ITEM';
        
        // Create consolidated key
        const consolidated = consolidateDescription(description);
        const key = `${category}|${currentSubcategory}|${consolidated}|${unitClean}`;
        
        if (consolidatedItems.has(key)) {
          const existing = consolidatedItems.get(key);
          // Keep the one with lower rate or update if same rate
          if (rate <= existing.rate) {
            existing.rate = rate;
            existing.originalDescriptions.push(description);
          }
        } else {
          consolidatedItems.set(key, {
            description: description,
            category: category,
            subcategory: currentSubcategory,
            unit: unitClean,
            rate: rate,
            consolidated: consolidated,
            originalDescriptions: [description]
          });
        }
      }
    }
    
    console.log(`\nTotal consolidated groups: ${consolidatedItems.size}`);
    
    // Create final items, prioritizing most common work types
    const priorityItems: PriceItem[] = [];
    const regularItems: PriceItem[] = [];
    let counter = 1;
    
    // Priority keywords for common BOQ items
    const priorityKeywords = [
      'excavat', 'concrete', 'reinforcement', 'formwork', 'fill', 'compact',
      'disposal', 'pipe', 'drain', 'manhole', 'cable', 'duct', 'brick', 'block',
      'plaster', 'paint', 'tile', 'steel', 'foundation', 'slab', 'column', 'beam',
      'wall', 'roof', 'waterproof', 'insulation', 'underpin'
    ];
    
    consolidatedItems.forEach(item => {
      const code = `${item.category.substring(0, 3).toUpperCase()}${counter.toString().padStart(4, '0')}`;
      const keywords = generateKeywords(item.description, item.category, item.subcategory);
      
      const priceItem: PriceItem = {
        _id: uuidv4(),
        code: code,
        ref: code,
        description: item.description,
        category: item.category,
        subcategory: item.subcategory,
        unit: item.unit,
        rate: item.rate,
        keywords: keywords
      };
      
      // Check if it's a priority item
      const isPriority = priorityKeywords.some(kw => 
        item.description.toLowerCase().includes(kw) || 
        item.consolidated.includes(kw)
      );
      
      if (isPriority) {
        priorityItems.push(priceItem);
      } else {
        regularItems.push(priceItem);
      }
      
      counter++;
    });
    
    // Combine priority items first, then regular items
    let finalItems = [...priorityItems, ...regularItems];
    
    // If still over 2000, take the most essential items
    if (finalItems.length > 2000) {
      console.log(`Reducing from ${finalItems.length} to 2000 items...`);
      
      // Sort by category and take proportional amounts from each
      const byCategory: Record<string, PriceItem[]> = {};
      finalItems.forEach(item => {
        if (!byCategory[item.category]) byCategory[item.category] = [];
        byCategory[item.category].push(item);
      });
      
      finalItems = [];
      const targetPerCategory = Math.floor(2000 / Object.keys(byCategory).length);
      
      Object.entries(byCategory).forEach(([cat, items]) => {
        // Sort by rate to get a good range
        items.sort((a, b) => a.rate - b.rate);
        
        if (items.length <= targetPerCategory) {
          finalItems.push(...items);
        } else {
          // Take evenly distributed items
          const step = Math.floor(items.length / targetPerCategory);
          for (let i = 0; i < items.length && finalItems.length < 2000; i += step) {
            finalItems.push(items[i]);
          }
        }
      });
    }
    
    // Renumber codes
    finalItems.forEach((item, idx) => {
      const code = `${item.category.substring(0, 3).toUpperCase()}${(idx + 1).toString().padStart(4, '0')}`;
      item.code = code;
      item.ref = code;
    });
    
    console.log(`\nFinal consolidated items: ${finalItems.length}`);
    
    // Save outputs
    await fs.writeFile('mjd_consolidated_pricelist.json', JSON.stringify(finalItems, null, 2));
    await fs.writeFile('mjd_consolidated_import.json', JSON.stringify(
      finalItems.map(item => ({
        code: item.code,
        ref: item.ref,
        description: item.description,
        category: item.category,
        subcategory: item.subcategory,
        unit: item.unit,
        rate: item.rate,
        keywords: item.keywords
      })), null, 2
    ));
    
    // CSV
    const csvHeader = '_id,code,ref,description,category,subcategory,unit,rate,keywords\n';
    const csvRows = finalItems.map(item => {
      const desc = item.description.replace(/"/g, '""');
      const subcat = item.subcategory.replace(/"/g, '""');
      const keywords = item.keywords.join('; ');
      return `"${item._id}","${item.code}","${item.ref}","${desc}","${item.category}","${subcat}","${item.unit}",${item.rate},"${keywords}"`;
    });
    await fs.writeFile('mjd_consolidated_pricelist.csv', csvHeader + csvRows.join('\n'));
    
    // Summary
    console.log('\nSummary by category:');
    const categoryCounts: Record<string, number> = {};
    finalItems.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} items`);
    });
    
    console.log('\nFiles saved:');
    console.log('- mjd_consolidated_pricelist.json');
    console.log('- mjd_consolidated_pricelist.csv');
    console.log('- mjd_consolidated_import.json');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

extractConsolidatedPricelist();
