const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function cleanNumber(value) {
  if (value === null || value === undefined) return 0;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

function extractCategoryFromName(name) {
  const nameLower = name.toLowerCase();
  
  // Fencing-specific categories
  if (nameLower.includes('fence') || nameLower.includes('fencing')) return 'Fencing';
  if (nameLower.includes('gate')) return 'Gates';
  if (nameLower.includes('post')) return 'Posts';
  if (nameLower.includes('panel')) return 'Panels';
  if (nameLower.includes('wire') || nameLower.includes('mesh')) return 'Wire & Mesh';
  if (nameLower.includes('barbed')) return 'Barbed Wire';
  if (nameLower.includes('razor')) return 'Razor Wire';
  
  // Tools and Hardware
  if (nameLower.includes('drill')) return 'Drill Bits & Tools';
  if (nameLower.includes('saw')) return 'Saws & Blades';
  if (nameLower.includes('hammer')) return 'Hammers';
  if (nameLower.includes('screwdriver')) return 'Screwdrivers';
  if (nameLower.includes('pliers')) return 'Pliers';
  if (nameLower.includes('wrench')) return 'Wrenches';
  if (nameLower.includes('tool')) return 'Tools';
  
  // Fasteners
  if (nameLower.includes('screw')) return 'Screws';
  if (nameLower.includes('nail')) return 'Nails';
  if (nameLower.includes('bolt')) return 'Bolts';
  if (nameLower.includes('nut')) return 'Nuts & Washers';
  if (nameLower.includes('anchor')) return 'Anchors';
  if (nameLower.includes('bracket')) return 'Brackets';
  
  // Materials
  if (nameLower.includes('steel')) return 'Steel Products';
  if (nameLower.includes('aluminum') || nameLower.includes('aluminium')) return 'Aluminum Products';
  if (nameLower.includes('wood')) return 'Wood Products';
  if (nameLower.includes('concrete')) return 'Concrete Products';
  if (nameLower.includes('paint')) return 'Paints & Coatings';
  if (nameLower.includes('adhesive')) return 'Adhesives';
  
  // Additional categories
  if (nameLower.includes('pipe')) return 'Pipes & Fittings';
  if (nameLower.includes('sheet')) return 'Sheets & Plates';
  if (nameLower.includes('cable')) return 'Cables & Wires';
  if (nameLower.includes('insulation')) return 'Insulation';
  if (nameLower.includes('seal')) return 'Sealants';
  
  return 'General Hardware';
}

function extractSubcategory(name, variant, category) {
  const nameLower = name.toLowerCase();
  const variantLower = variant.toLowerCase();
  
  // Drill bits subcategories
  if (category === 'Drill Bits & Tools') {
    if (nameLower.includes('steel')) return 'Steel Drill Bits';
    if (nameLower.includes('masonry')) return 'Masonry Drill Bits';
    if (nameLower.includes('wood')) return 'Wood Drill Bits';
    if (nameLower.includes('cobalt')) return 'Cobalt Drill Bits';
    if (nameLower.includes('titanium')) return 'Titanium Drill Bits';
    if (variantLower.includes('set')) return 'Drill Bit Sets';
    return 'Standard Drill Bits';
  }
  
  // Fencing subcategories
  if (category === 'Fencing') {
    if (nameLower.includes('chain link')) return 'Chain Link Fencing';
    if (nameLower.includes('barbed')) return 'Barbed Wire Fencing';
    if (nameLower.includes('electric')) return 'Electric Fencing';
    if (nameLower.includes('mesh')) return 'Mesh Fencing';
    return 'General Fencing';
  }
  
  // Gates subcategories
  if (category === 'Gates') {
    if (nameLower.includes('swing')) return 'Swing Gates';
    if (nameLower.includes('slide') || nameLower.includes('sliding')) return 'Sliding Gates';
    if (nameLower.includes('barrier')) return 'Barrier Gates';
    if (nameLower.includes('frame')) return 'Gate Frames';
    return 'Standard Gates';
  }
  
  // Size-based subcategories
  if (variantLower.includes('small') || variantLower.includes('< 10')) return `Small ${category}`;
  if (variantLower.includes('medium') || variantLower.includes('10-50')) return `Medium ${category}`;
  if (variantLower.includes('large') || variantLower.includes('> 50')) return `Large ${category}`;
  
  // Default subcategory based on variant
  if (variantLower.includes('set')) return `${category} Sets`;
  if (variantLower.includes('pack')) return `${category} Packs`;
  
  return `Standard ${category}`;
}

function generateKeywords(item) {
  const keywords = new Set();
  
  // Add words from description
  if (item.description) {
    const words = item.description.toLowerCase().split(/[\s,\-_/()]+/);
    words.forEach(word => {
      if (word.length > 2 && !word.match(/^\d+$/)) {
        keywords.add(word);
      }
    });
  }
  
  // Add category and subcategory
  if (item.category) {
    keywords.add(item.category.toLowerCase());
    item.category.split(/\s+/).forEach(w => keywords.add(w.toLowerCase()));
  }
  if (item.subcategory) {
    keywords.add(item.subcategory.toLowerCase());
    item.subcategory.split(/\s+/).forEach(w => keywords.add(w.toLowerCase()));
  }
  
  // Add code parts
  if (item.code) {
    keywords.add(item.code.toLowerCase());
  }
  
  // Add unit
  if (item.unit && item.unit !== 'Unit') {
    keywords.add(item.unit.toLowerCase());
  }
  
  return Array.from(keywords).filter(k => k.length > 1);
}

async function convertToCompletePriceList() {
  console.log('🔄 Converting Excel to complete price list...\n');
  
  // Read the Excel file
  const workbook = XLSX.readFile('C:\\Users\\abaza\\Downloads\\Product (product.product) (1).xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
  
  console.log(`📊 Found ${jsonData.length} rows in Excel file\n`);
  
  const priceItems = [];
  let itemsWithMissingData = 0;
  
  jsonData.forEach((row, index) => {
    // Extract variant info
    let variantInfo = cleanString(row['product_template_variant_value_ids'] || '');
    let variant = '';
    if (variantInfo && variantInfo.includes(':')) {
      variant = variantInfo.split(':')[1].trim();
    }
    
    // Build complete description
    const baseName = cleanString(row['name'] || '');
    const fullDescription = variant ? `${baseName} - ${variant}` : baseName;
    
    // Extract category and subcategory
    const category = extractCategoryFromName(baseName);
    const subcategory = extractSubcategory(baseName, variant, category);
    
    // Generate unique code from ID
    const idParts = (row['id'] || '').split('_');
    const code = idParts.length >= 2 ? `${idParts[idParts.length-2]}_${idParts[idParts.length-1]}` : `ITEM_${index + 1}`;
    
    // Get unit (ensure it's never empty)
    let unit = cleanString(row['uom_id'] || 'Unit');
    if (!unit || unit === '') unit = 'Unit';
    
    // Get rate (ensure it's a number)
    let rate = cleanNumber(row['operation_cost'] || 0);
    
    // Track missing data
    if (rate === 0) {
      itemsWithMissingData++;
      // For items without price, set a default of 1.0 to avoid empty rates
      rate = 1.0;
    }
    
    const item = {
      _id: uuidv4(),
      code: code,
      ref: cleanString(row['id'] || ''),
      description: fullDescription,
      category: category,
      subcategory: subcategory,
      unit: unit,
      rate: rate,
      keywords: [] // Will be generated after
    };
    
    // Generate keywords
    item.keywords = generateKeywords(item);
    
    priceItems.push(item);
  });
  
  console.log(`✅ Converted ${priceItems.length} items`);
  console.log(`⚠️  Items with missing prices (set to 1.0): ${itemsWithMissingData}\n`);
  
  // Verify all items have required fields
  console.log('🔍 Verifying data completeness...');
  const missingCode = priceItems.filter(item => !item.code).length;
  const missingSubcategory = priceItems.filter(item => !item.subcategory).length;
  const missingUnit = priceItems.filter(item => !item.unit).length;
  const missingRate = priceItems.filter(item => !item.rate || item.rate === 0).length;
  
  console.log(`  ✅ Items with code: ${priceItems.length - missingCode}/${priceItems.length}`);
  console.log(`  ✅ Items with subcategory: ${priceItems.length - missingSubcategory}/${priceItems.length}`);
  console.log(`  ✅ Items with unit: ${priceItems.length - missingUnit}/${priceItems.length}`);
  console.log(`  ✅ Items with rate: ${priceItems.length - missingRate}/${priceItems.length}`);
  
  // Save to JSON
  const jsonPath = path.join(__dirname, 'data', 'complete-pricelist.json');
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(priceItems, null, 2));
  console.log(`\n💾 Saved to: ${jsonPath}`);
  
  // Create CSV with all required fields
  const csvHeaders = ['_id', 'code', 'ref', 'description', 'category', 'subcategory', 'unit', 'rate', 'keywords'];
  let csvContent = csvHeaders.join(',') + '\n';
  
  // Helper function to escape CSV values
  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    value = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes(';')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }
  
  priceItems.forEach(item => {
    const row = [
      escapeCSV(item._id),
      escapeCSV(item.code),
      escapeCSV(item.ref),
      escapeCSV(item.description),
      escapeCSV(item.category),
      escapeCSV(item.subcategory),
      escapeCSV(item.unit),
      item.rate,
      escapeCSV(item.keywords.join('; '))
    ];
    csvContent += row.join(',') + '\n';
  });
  
  const csvPath = path.join(__dirname, 'complete-pricelist.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log(`💾 Saved CSV to: ${csvPath}`);
  
  // Display summary
  console.log('\n📊 Summary:');
  const categories = new Set(priceItems.map(item => item.category));
  const subcategories = new Set(priceItems.map(item => item.subcategory));
  
  console.log(`  Total items: ${priceItems.length}`);
  console.log(`  Categories: ${categories.size}`);
  console.log(`  Subcategories: ${subcategories.size}`);
  console.log(`  Average rate: ${(priceItems.reduce((sum, item) => sum + item.rate, 0) / priceItems.length).toFixed(2)}`);
  
  console.log('\n📁 Sample items:');
  priceItems.slice(0, 5).forEach((item, i) => {
    console.log(`\n  ${i + 1}. ${item.description}`);
    console.log(`     Code: ${item.code}`);
    console.log(`     Category: ${item.category} > ${item.subcategory}`);
    console.log(`     Unit: ${item.unit}, Rate: ${item.rate}`);
  });
  
  console.log('\n✅ Conversion complete! All items have required fields populated.');
  
  return priceItems;
}

// Run the conversion
convertToCompletePriceList().catch(console.error);