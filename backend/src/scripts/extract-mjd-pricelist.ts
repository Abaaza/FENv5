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

// Construction terms mapping for keyword generation
const constructionTerms: Record<string, string[]> = {
  'exc': ['excavation', 'excavate', 'dig', 'earthwork', 'earthworks', 'cut', 'fill'],
  'conc': ['concrete', 'cement', 'pour', 'casting', 'mix', 'grade'],
  'reinf': ['reinforcement', 'rebar', 'steel bars', 'reinforcing', 'mesh', 'fabric'],
  'form': ['formwork', 'shuttering', 'mould', 'framework', 'falsework'],
  'block': ['blockwork', 'masonry', 'brickwork', 'blocks', 'wall'],
  'plast': ['plaster', 'render', 'skim', 'plastering', 'finish'],
  'water': ['waterproof', 'damp proof', 'moisture barrier', 'waterproofing', 'dpm', 'tanking'],
  'insul': ['insulation', 'thermal', 'acoustic', 'insulating', 'board'],
  'paint': ['painting', 'decoration', 'coating', 'paint', 'primer'],
  'tile': ['tiling', 'ceramic', 'floor covering', 'tiles', 'mosaic'],
  'pipe': ['piping', 'plumbing', 'conduit', 'pipes', 'duct', 'tube'],
  'drain': ['drainage', 'sewage', 'waste water', 'sewer', 'gully', 'manhole'],
  'steel': ['structural steel', 'metal work', 'fabrication', 'steelwork', 'beam', 'column'],
  'found': ['foundation', 'footing', 'base', 'foundations', 'pile', 'pad'],
  'slab': ['floor slab', 'concrete slab', 'deck', 'slabs', 'soffit'],
  'wall': ['partition', 'barrier', 'divider', 'walls', 'skin'],
  'roof': ['roofing', 'covering', 'weatherproofing', 'roof', 'eaves', 'soffit'],
  'door': ['doorway', 'entrance', 'opening', 'doors', 'frame', 'ironmongery'],
  'window': ['glazing', 'fenestration', 'opening', 'windows', 'glass', 'frame'],
  'elec': ['electrical', 'wiring', 'power', 'electric', 'cable', 'conduit'],
  'mech': ['mechanical', 'hvac', 'ventilation', 'equipment', 'plant'],
  'struct': ['structural', 'load bearing', 'support', 'structure', 'frame'],
  'memb': ['membrane', 'sheet', 'layer', 'membranes', 'geotextile'],
  'galv': ['galvanized', 'zinc coated', 'rust proof', 'galvanised', 'coating'],
  'pvc': ['plastic', 'polymer', 'synthetic', 'upvc', 'hdpe', 'mdpe'],
  'ms': ['mild steel', 'metal', 'iron', 'metalwork', 'fabrication'],
  'rc': ['reinforced concrete', 'rcc', 'structural concrete', 'r.c.', 'reinforced'],
  'dpc': ['damp proof course', 'moisture barrier', 'waterproofing', 'd.p.c.', 'dpm'],
  'brc': ['welded mesh', 'wire mesh', 'reinforcement mesh', 'fabric', 'a142', 'a193', 'a252', 'a393'],
  'grout': ['grouting', 'filling', 'sealing', 'grout', 'pointing'],
  'screed': ['floor screed', 'leveling', 'topping', 'screeding', 'self-levelling'],
  'timber': ['wood', 'timber', 'lumber', 'joinery', 'carpentry'],
  'piling': ['pile', 'piling', 'bored pile', 'driven pile', 'sheet pile', 'cfa'],
  'scaffold': ['scaffolding', 'scaffold', 'access', 'platform', 'tower'],
  'clad': ['cladding', 'facade', 'external finish', 'rainscreen', 'panels']
};

function generateKeywords(description: string, category: string, subcategory: string = ""): string[] {
  const keywords: Set<string> = new Set();
  const descLower = description.toLowerCase();
  
  // Extract words from description
  const words = descLower.match(/\b\w+\b/g) || [];
  
  // Add significant words (>3 chars, excluding common words)
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
  
  // Extract measurements and specifications
  const measurements = descLower.match(/\b\d+\s*(?:mm|cm|m|kg|kn|mpa|ton|tonnes?|liters?|litres?|m2|m3|sqm|cum|lm|rm|no|nr|thick|thk|dia)\b/gi) || [];
  measurements.forEach(m => keywords.add(m.trim().toLowerCase()));
  
  // Extract material grades/types (like C25, B500, etc)
  const grades = descLower.match(/\b[a-z]?\d+(?:\/\d+)?(?:\s*[a-z]+)?\b/gi) || [];
  grades.forEach(g => {
    if (g.match(/[a-z]\d+/i)) { // Only add if it looks like a grade
      keywords.add(g.toLowerCase());
    }
  });
  
  // Extract thickness/dimensions
  const dimensions = descLower.match(/\b\d+\s*x\s*\d+(?:\s*x\s*\d+)?\b/gi) || [];
  dimensions.forEach(d => keywords.add(d));
  
  // Add specific keywords based on content
  if (descLower.includes('concrete') || descLower.includes('conc')) {
    ['cement', 'aggregate', 'mix', 'pour', 'casting', 'curing', 'vibration'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('steel') || descLower.includes(' ms ')) {
    ['metal', 'iron', 'fabrication', 'structural', 'bars', 'sections', 'welding'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('excavat')) {
    ['earthwork', 'dig', 'soil', 'disposal', 'cut', 'fill', 'spoil'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('brick') || descLower.includes('block')) {
    ['masonry', 'mortar', 'wall', 'partition', 'laying', 'course'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('drain')) {
    ['sewer', 'pipe', 'manhole', 'gulley', 'channel', 'flow'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('underpinn')) {
    ['foundation', 'support', 'needle', 'pit', 'sequential', 'mini-pile'].forEach(k => keywords.add(k));
  }
  
  return Array.from(keywords);
}

async function extractFromCategorySheets(): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), '..', 'MJD-PRICELIST.xlsx');
    console.log('Reading Excel file from:', filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    // Category sheets to process
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
      
      // Find where the actual data starts (looking for Description header)
      let dataStartRow = 0;
      let descCol = 2; // Usually column B
      let quantCol = 4; // Usually column D or E
      let unitCol = 5; // Usually column E or F
      let rateCol = 6; // Usually column F or G
      
      // Find the row with "Description" header
      for (let i = 1; i <= Math.min(20, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        for (let j = 1; j <= Math.min(10, worksheet.columnCount); j++) {
          const cellValue = row.getCell(j).value?.toString()?.toLowerCase() || '';
          if (cellValue === 'description') {
            dataStartRow = i + 1;
            descCol = j;
            
            // Find other columns relative to description
            for (let k = j + 1; k <= Math.min(j + 10, worksheet.columnCount); k++) {
              const headerValue = row.getCell(k).value?.toString()?.toLowerCase() || '';
              if (headerValue.includes('quant')) quantCol = k;
              else if (headerValue.includes('unit')) unitCol = k;
              else if (headerValue.includes('rate')) rateCol = k;
            }
            break;
          }
        }
        if (dataStartRow > 0) break;
      }
      
      if (dataStartRow === 0) {
        console.log(`Could not find data start in ${sheetName}`);
        continue;
      }
      
      console.log(`Found data starting at row ${dataStartRow}, columns: desc=${descCol}, quant=${quantCol}, unit=${unitCol}, rate=${rateCol}`);
      
      // Process rows
      for (let i = dataStartRow; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        
        // Get cell values - handle complex cell objects
        let description = '';
        const descCell = row.getCell(descCol).value;
        if (descCell) {
          if (typeof descCell === 'object' && 'richText' in descCell) {
            description = (descCell as any).richText?.map((rt: any) => rt.text).join('') || '';
          } else if (typeof descCell === 'object' && 'text' in descCell) {
            description = (descCell as any).text || '';
          } else if (typeof descCell === 'object' && 'result' in descCell) {
            description = (descCell as any).result?.toString() || '';
          } else {
            description = descCell.toString();
          }
        }
        
        const quantValue = row.getCell(quantCol).value;
        
        let unit = '';
        const unitCell = row.getCell(unitCol).value;
        if (unitCell) {
          if (typeof unitCell === 'object' && 'result' in unitCell) {
            unit = (unitCell as any).result?.toString() || '';
          } else if (typeof unitCell === 'object') {
            unit = JSON.stringify(unitCell);
          } else {
            unit = unitCell.toString();
          }
        }
        
        let rateValue: any = row.getCell(rateCol).value;
        if (rateValue && typeof rateValue === 'object' && 'result' in rateValue) {
          rateValue = (rateValue as any).result;
        }
        
        // Skip empty rows
        if (!description || description === 'null') continue;
        
        // Check if this is a subcategory header (no rate, bold or specific patterns)
        const hasRate = rateValue && rateValue !== 0 && rateValue !== null;
        const isHeader = !hasRate && description.length > 5 && 
                        (description.match(/^[A-Z\s]+$/i) || // All caps
                         description.match(/^(preambles|in-situ|precast|formwork|reinforcement|excavation|filling|disposal|pipework|chambers|channels|electrical|mechanical|plumbing|hvac|fire|landscaping|paving|fencing|drainage)/i));
        
        if (isHeader) {
          currentSubcategory = description.trim();
          console.log(`  Found subcategory: ${currentSubcategory}`);
          continue;
        }
        
        // Process actual items with rates
        let rate = 0;
        try {
          rate = rateValue ? parseFloat(rateValue.toString()) : 0;
        } catch {
          rate = 0;
        }
        
        if (rate > 0 && description.length > 5) {
          const code = `${category.substring(0, 3).toUpperCase()}${globalCounter.toString().padStart(4, '0')}`;
          const ref = code;
          const unitClean = unit && unit !== 'null' && !unit.includes('[object') ? unit.trim().toUpperCase() : 'NO';
          
          const keywords = generateKeywords(description, category, currentSubcategory);
          
          const item: PriceItem = {
            _id: uuidv4(),
            code: code,
            ref: ref,
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
          
          if (itemsInCategory <= 5) {
            console.log(`  ${code}: ${description.substring(0, 60)}... [${unitClean}] Â£${rate}`);
          }
        } else if (rate === 0 && i < dataStartRow + 20) {
          // Debug: show why items are being skipped
          console.log(`  Skipped row ${i}: rate=${rate}, desc="${description.substring(0, 40)}..."`);
        }
      }
      
      console.log(`  Total items in ${category}: ${itemsInCategory}`);
    }
    
    console.log(`\n\nTotal items extracted: ${allItems.length}`);
    
    // Save as JSON
    await fs.writeFile('mjd_pricelist_extracted.json', JSON.stringify(allItems, null, 2));
    console.log('Saved to mjd_pricelist_extracted.json');
    
    // Save as CSV
    const csvHeader = '_id,code,ref,description,category,subcategory,unit,rate,keywords\n';
    const csvRows = allItems.map(item => {
      const desc = item.description.replace(/"/g, '""');
      const subcat = item.subcategory.replace(/"/g, '""');
      const keywords = item.keywords.join('; ');
      return `"${item._id}","${item.code}","${item.ref}","${desc}","${item.category}","${subcat}","${item.unit}",${item.rate},"${keywords}"`;
    });
    await fs.writeFile('mjd_pricelist_extracted.csv', csvHeader + csvRows.join('\n'));
    console.log('Saved to mjd_pricelist_extracted.csv');
    
    // Print summary
    console.log('\nSummary by category:');
    const categoryCounts: Record<string, number> = {};
    allItems.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} items`);
    });
    
    // Also save a formatted version for easy import
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
    
    await fs.writeFile('mjd_pricelist_for_import.json', JSON.stringify(importData, null, 2));
    console.log('\nAlso saved formatted version to mjd_pricelist_for_import.json');
    
  } catch (error) {
    console.error('Error extracting pricelist:', error);
  }
}

// Run extraction
extractFromCategorySheets();
