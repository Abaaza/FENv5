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
  'exc': ['excavation', 'excavate', 'dig', 'earthwork', 'earthworks'],
  'conc': ['concrete', 'cement', 'pour', 'casting', 'mix'],
  'reinf': ['reinforcement', 'rebar', 'steel bars', 'reinforcing'],
  'form': ['formwork', 'shuttering', 'mould', 'framework'],
  'block': ['blockwork', 'masonry', 'brickwork', 'blocks'],
  'plast': ['plaster', 'render', 'skim', 'plastering'],
  'water': ['waterproof', 'damp proof', 'moisture barrier', 'waterproofing'],
  'insul': ['insulation', 'thermal', 'acoustic', 'insulating'],
  'paint': ['painting', 'decoration', 'coating', 'paint'],
  'tile': ['tiling', 'ceramic', 'floor covering', 'tiles'],
  'pipe': ['piping', 'plumbing', 'conduit', 'pipes'],
  'drain': ['drainage', 'sewage', 'waste water', 'sewer'],
  'steel': ['structural steel', 'metal work', 'fabrication', 'steelwork'],
  'found': ['foundation', 'footing', 'base', 'foundations'],
  'slab': ['floor slab', 'concrete slab', 'deck', 'slabs'],
  'wall': ['partition', 'barrier', 'divider', 'walls'],
  'roof': ['roofing', 'covering', 'weatherproofing', 'roof'],
  'door': ['doorway', 'entrance', 'opening', 'doors'],
  'window': ['glazing', 'fenestration', 'opening', 'windows'],
  'elec': ['electrical', 'wiring', 'power', 'electric'],
  'mech': ['mechanical', 'hvac', 'ventilation', 'equipment'],
  'fin': ['finishing', 'final coat', 'completion', 'finishes'],
  'struct': ['structural', 'load bearing', 'support', 'structure'],
  'memb': ['membrane', 'sheet', 'layer', 'membranes'],
  'galv': ['galvanized', 'zinc coated', 'rust proof', 'galvanised'],
  'pvc': ['plastic', 'polymer', 'synthetic', 'upvc'],
  'ms': ['mild steel', 'metal', 'iron', 'metalwork'],
  'rc': ['reinforced concrete', 'rcc', 'structural concrete', 'r.c.'],
  'dpc': ['damp proof course', 'moisture barrier', 'waterproofing', 'd.p.c.'],
  'brc': ['welded mesh', 'wire mesh', 'reinforcement mesh', 'fabric'],
  'grout': ['grouting', 'filling', 'sealing', 'grout'],
  'screed': ['floor screed', 'leveling', 'topping', 'screeding'],
  'plumb': ['plumbing', 'sanitary', 'water supply', 'pipework'],
  'elect': ['electrical', 'power', 'lighting', 'electricals'],
  'hvac': ['air conditioning', 'ventilation', 'heating', 'cooling'],
  'fire': ['fire fighting', 'fire protection', 'safety', 'firefighting'],
  'land': ['landscaping', 'external works', 'site works', 'landscape']
};

function generateKeywords(description: string, category: string, subcategory: string = ""): string[] {
  const keywords: Set<string> = new Set();
  const descLower = description.toLowerCase();
  
  // Extract words from description
  const words = descLower.match(/\b\w+\b/g) || [];
  
  // Add significant words (>3 chars, excluding common words)
  const excludeWords = ['the', 'and', 'for', 'with', 'including', 'all', 'per', 'any'];
  words.forEach(word => {
    if (word.length > 3 && !excludeWords.includes(word)) {
      keywords.add(word);
    }
  });
  
  // Add category and subcategory
  if (category) {
    keywords.add(category.toLowerCase());
    keywords.add(category.toLowerCase().replace(/works?$/, ''));
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
  const measurements = descLower.match(/\b\d+\s*(?:mm|cm|m|kg|kn|mpa|ton|tonnes?|liters?|litres?|m2|m3|sqm|cum|lm|rm|no|nr)\b/g) || [];
  measurements.forEach(m => keywords.add(m.trim()));
  
  // Extract material grades/types
  const grades = descLower.match(/\b[a-z]?\d+(?:\/\d+)?\b/g) || [];
  grades.forEach(g => keywords.add(g));
  
  // Extract thickness/dimensions
  const dimensions = descLower.match(/\b\d+\s*x\s*\d+(?:\s*x\s*\d+)?\b/g) || [];
  dimensions.forEach(d => keywords.add(d));
  
  // Material specific keywords
  if (descLower.includes('concrete') || descLower.includes('conc')) {
    ['cement', 'aggregate', 'mix', 'pour', 'casting', 'curing'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('steel')) {
    ['metal', 'iron', 'fabrication', 'structural', 'bars', 'sections'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('excavat')) {
    ['earthwork', 'dig', 'soil', 'disposal', 'cut', 'fill'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('brick') || descLower.includes('block')) {
    ['masonry', 'mortar', 'wall', 'partition', 'laying'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('pipe')) {
    ['plumbing', 'conduit', 'duct', 'tubing', 'fittings'].forEach(k => keywords.add(k));
  }
  if (descLower.includes('cable')) {
    ['wire', 'electrical', 'conductor', 'wiring', 'conduit'].forEach(k => keywords.add(k));
  }
  
  // Specific construction activities
  if (descLower.includes('supply')) keywords.add('provide');
  if (descLower.includes('install')) keywords.add('fix');
  if (descLower.includes('laying')) keywords.add('lay');
  if (descLower.includes('casting')) keywords.add('cast');
  if (descLower.includes('excavation')) keywords.add('excavate');
  
  return Array.from(keywords);
}

async function extractPricelist(): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), '..', 'MJD-PRICELIST.xlsx');
    console.log('Reading Excel file from:', filePath);
    
    // Read the Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    // List all worksheets
    console.log('Available worksheets:');
    workbook.worksheets.forEach(ws => {
      console.log(`  - "${ws.name}"`);
    });
    
    // Get the Set factors & prices sheet
    const worksheet = workbook.getWorksheet('Set factors & prices');
    if (!worksheet) {
      throw new Error('Could not find "Set factors & prices" worksheet');
    }
    
    console.log(`Using worksheet: "${worksheet.name}"`)
    
    console.log(`Worksheet has ${worksheet.rowCount} rows and ${worksheet.columnCount} columns`);
    
    // Find header row
    let headerRow = 0;
    for (let i = 1; i <= Math.min(worksheet.rowCount, 30); i++) {
      const row = worksheet.getRow(i);
      const rowValues = [];
      for (let j = 1; j <= worksheet.columnCount; j++) {
        const cell = row.getCell(j);
        rowValues.push(cell.value?.toString()?.toLowerCase() || '');
      }
      const rowText = rowValues.join(' ');
      
      // Look for various header patterns
      if ((rowText.includes('item') || rowText.includes('no') || rowText.includes('ref')) && 
          (rowText.includes('description') || rowText.includes('particular') || rowText.includes('work')) &&
          (rowText.includes('unit') || rowText.includes('rate'))) {
        headerRow = i;
        console.log(`Found header row at row ${i}`);
        console.log(`Header content: ${rowValues.filter(v => v).join(' | ')}`);
        break;
      }
    }
    
    if (headerRow === 0) {
      throw new Error('Could not find header row');
    }
    
    // Identify columns
    const headers = worksheet.getRow(headerRow);
    let itemCol = 0, descCol = 0, unitCol = 0, rateCol = 0;
    
    for (let j = 1; j <= worksheet.columnCount; j++) {
      const cellValue = headers.getCell(j).value?.toString()?.toLowerCase() || '';
      if (cellValue.includes('item') && itemCol === 0) itemCol = j;
      else if ((cellValue.includes('description') || cellValue.includes('particular')) && descCol === 0) descCol = j;
      else if (cellValue.includes('unit') && unitCol === 0) unitCol = j;
      else if ((cellValue.includes('rate') || cellValue.includes('price')) && rateCol === 0) rateCol = j;
    }
    
    console.log(`Columns found: Item=${itemCol}, Description=${descCol}, Unit=${unitCol}, Rate=${rateCol}`);
    
    if (!itemCol || !descCol || !unitCol || !rateCol) {
      throw new Error('Could not identify all required columns');
    }
    
    // Target categories
    const targetCategories = ['groundworks', 'rcworks', 'drainage', 'services', 'external works', 'underpinning'];
    
    // Extract items
    const items: PriceItem[] = [];
    let currentCategory = '';
    let currentSubcategory = '';
    let itemCounter = 1;
    
    // Process rows
    for (let i = headerRow + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      const itemCode = row.getCell(itemCol).value?.toString() || '';
      const description = row.getCell(descCol).value?.toString() || '';
      const unit = row.getCell(unitCol).value?.toString() || '';
      const rateValue = row.getCell(rateCol).value;
      
      // Skip empty rows
      if (!description || description === 'null') continue;
      
      const descLower = description.toLowerCase();
      let isCategory = false;
      
      // Check if this is a category header
      for (const cat of targetCategories) {
        if (descLower.includes(cat)) {
          currentCategory = cat;
          currentSubcategory = '';
          isCategory = true;
          console.log(`Found category: ${cat}`);
          break;
        }
      }
      
      // Check if this is a subcategory (has description but no rate)
      if (!isCategory && (!rateValue || rateValue === 0 || rateValue === null) && description.length > 5) {
        if (currentCategory) {
          currentSubcategory = description.trim();
          isCategory = true;
          console.log(`  Found subcategory: ${currentSubcategory}`);
        }
      }
      
      // Skip if not in target categories
      if (!currentCategory) continue;
      
      // Skip category/subcategory headers
      if (isCategory) continue;
      
      // Process actual items
      let rate = 0;
      try {
        rate = rateValue ? parseFloat(rateValue.toString()) : 0;
      } catch {
        rate = 0;
      }
      
      if (rate > 0) {
        const id = uuidv4();
        const ref = itemCode || `${currentCategory.substring(0, 3).toUpperCase()}${itemCounter.toString().padStart(4, '0')}`;
        const code = ref.includes('.') ? ref.split('.')[0] : ref;
        const unitClean = unit && unit !== 'null' ? unit.trim().toUpperCase() : 'NO';
        
        const keywords = generateKeywords(description, currentCategory, currentSubcategory);
        
        const item: PriceItem = {
          _id: id,
          code: code,
          ref: ref,
          description: description.trim(),
          category: currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1).replace('works', ' Works'),
          subcategory: currentSubcategory,
          unit: unitClean,
          rate: rate,
          keywords: keywords
        };
        
        items.push(item);
        itemCounter++;
        
        console.log(`Extracted: ${code} - ${description.substring(0, 50)}... (${currentCategory})`);
      }
    }
    
    console.log(`\nTotal items extracted: ${items.length}`);
    
    // Save as JSON
    await fs.writeFile('extracted_pricelist.json', JSON.stringify(items, null, 2));
    console.log('Saved to extracted_pricelist.json');
    
    // Save as CSV
    const csvHeader = '_id,code,ref,description,category,subcategory,unit,rate,keywords\n';
    const csvRows = items.map(item => {
      const desc = item.description.replace(/"/g, '""');
      const keywords = item.keywords.join(', ');
      return `"${item._id}","${item.code}","${item.ref}","${desc}","${item.category}","${item.subcategory}","${item.unit}",${item.rate},"${keywords}"`;
    });
    await fs.writeFile('extracted_pricelist.csv', csvHeader + csvRows.join('\n'));
    console.log('Saved to extracted_pricelist.csv');
    
    // Print summary
    console.log('\nSummary by category:');
    const categoryCounts: Record<string, number> = {};
    items.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} items`);
    });
    
  } catch (error) {
    console.error('Error extracting pricelist:', error);
  }
}

// Run the extraction
extractPricelist();
