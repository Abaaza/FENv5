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

function extractCategory(name) {
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
  
  return 'General';
}

function extractSubcategory(name, variant) {
  const nameLower = name.toLowerCase();
  const variantLower = variant.toLowerCase();
  
  // Drill bits subcategories
  if (nameLower.includes('drill bit')) {
    if (nameLower.includes('steel')) return 'Steel Drill Bits';
    if (nameLower.includes('masonry')) return 'Masonry Drill Bits';
    if (nameLower.includes('wood')) return 'Wood Drill Bits';
    if (nameLower.includes('cobalt')) return 'Cobalt Drill Bits';
    if (nameLower.includes('titanium')) return 'Titanium Drill Bits';
    return 'Standard Drill Bits';
  }
  
  // Size-based subcategories
  if (variantLower.includes('set')) return 'Sets & Kits';
  if (variantLower.includes('mm') || variantLower.includes('inch')) return 'Individual Pieces';
  
  return '';
}

function extractMaterialType(name) {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('steel')) return 'Steel';
  if (nameLower.includes('stainless')) return 'Stainless Steel';
  if (nameLower.includes('galvanized')) return 'Galvanized Steel';
  if (nameLower.includes('aluminum') || nameLower.includes('aluminium')) return 'Aluminum';
  if (nameLower.includes('brass')) return 'Brass';
  if (nameLower.includes('copper')) return 'Copper';
  if (nameLower.includes('plastic') || nameLower.includes('pvc')) return 'Plastic';
  if (nameLower.includes('wood')) return 'Wood';
  if (nameLower.includes('concrete')) return 'Concrete';
  
  return '';
}

function extractBrand(variant) {
  const variantLower = variant.toLowerCase();
  
  // Common tool brands
  if (variantLower.includes('wurth')) return 'Wurth';
  if (variantLower.includes('bosch')) return 'Bosch';
  if (variantLower.includes('dewalt')) return 'DeWalt';
  if (variantLower.includes('makita')) return 'Makita';
  if (variantLower.includes('milwaukee')) return 'Milwaukee';
  if (variantLower.includes('stanley')) return 'Stanley';
  if (variantLower.includes('black') && variantLower.includes('decker')) return 'Black & Decker';
  
  return '';
}

function generateKeywords(item) {
  const keywords = new Set();
  
  // Add words from description
  if (item.description) {
    const words = item.description.toLowerCase().split(/[\s,\-_/]+/);
    words.forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
  }
  
  // Add category and subcategory
  if (item.category) keywords.add(item.category.toLowerCase());
  if (item.subcategory) keywords.add(item.subcategory.toLowerCase());
  if (item.material_type) keywords.add(item.material_type.toLowerCase());
  if (item.brand) keywords.add(item.brand.toLowerCase());
  if (item.code) keywords.add(item.code.toLowerCase());
  
  return Array.from(keywords);
}

async function convertExcelToPriceList(inputPath, outputPath) {
  console.log('Reading Excel file:', inputPath);
  
  // Read the Excel file
  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
  
  console.log(`Found ${jsonData.length} rows in sheet: ${sheetName}`);
  
  // Display all column headers
  if (jsonData.length > 0) {
    console.log('\n=== Excel Column Headers ===');
    Object.keys(jsonData[0]).forEach(header => {
      console.log(`  - ${header}: "${jsonData[0][header]}"`);
    });
  }
  
  // Sample the first few rows to understand the structure
  console.log('\n=== First 3 rows of data ===');
  jsonData.slice(0, 3).forEach((row, index) => {
    console.log(`\nRow ${index + 1}:`);
    Object.entries(row).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });
  
  // Map the Excel data to PriceItem schema
  const priceItems = [];
  
  for (const row of jsonData) {
    // Extract size/variant from product_template_variant_value_ids
    let variantInfo = cleanString(row['product_template_variant_value_ids'] || '');
    let size = '';
    let variant = '';
    
    // Parse variant info (format: "size: Wurth 155 piece set")
    if (variantInfo) {
      const parts = variantInfo.split(':');
      if (parts.length > 1) {
        variant = parts[1].trim();
        size = variant; // Use the full variant as size for now
      }
    }
    
    // Build complete description
    const baseName = cleanString(row['name'] || '');
    const fullDescription = variant ? `${baseName} - ${variant}` : baseName;
    
    // Map columns based on actual Excel structure
    const item = {
      _id: uuidv4(),
      id: uuidv4(),
      // Use the export ID as code
      code: cleanString(row['id'] || '').replace('__export__.product_product_', ''),
      ref: cleanString(row['id'] || ''),
      // Combine name with variant for full description
      description: fullDescription,
      // Extract category from name (e.g., "Steel drill bit" -> category: "Drill Bits")
      category: extractCategory(baseName),
      subcategory: extractSubcategory(baseName, variant),
      // Unit of measure
      unit: cleanString(row['uom_id'] || 'Unit'),
      // Price/Rate - using operation_cost as the rate
      rate: cleanNumber(row['operation_cost'] || 0),
      // Material specific fields
      material_type: extractMaterialType(baseName),
      material_size: size,
      material_finish: '',
      brand: extractBrand(variant),
      // Supplier info
      supplier: '',
      location: '',
      availability: '',
      remark: variant,
      // Metadata
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // Generate keywords based on the item data
    item.keywords = generateKeywords(item);
    
    // Add all items (even with 0 rate) for complete export
    if (item.description) {
      priceItems.push(item);
    }
  }
  
  console.log(`\nConverted ${priceItems.length} valid price items`);
  
  // Write to JSON file
  fs.writeFileSync(outputPath, JSON.stringify(priceItems, null, 2));
  console.log(`\nPrice list saved to: ${outputPath}`);
  
  // Display summary statistics
  const categories = new Set(priceItems.map(item => item.category).filter(Boolean));
  const subcategories = new Set(priceItems.map(item => item.subcategory).filter(Boolean));
  
  console.log('\n=== Summary ===');
  console.log(`Total items: ${priceItems.length}`);
  console.log(`Unique categories: ${categories.size}`);
  console.log(`Unique subcategories: ${subcategories.size}`);
  console.log(`Items with codes: ${priceItems.filter(item => item.code).length}`);
  console.log(`Average rate: ${(priceItems.reduce((sum, item) => sum + item.rate, 0) / priceItems.length).toFixed(2)}`);
  
  // Sample output
  console.log('\n=== Sample converted items (first 3) ===');
  priceItems.slice(0, 3).forEach((item, index) => {
    console.log(`\nItem ${index + 1}:`);
    console.log(`  ID: ${item.id}`);
    console.log(`  Code: ${item.code || 'N/A'}`);
    console.log(`  Description: ${item.description}`);
    console.log(`  Category: ${item.category || 'N/A'}`);
    console.log(`  Unit: ${item.unit}`);
    console.log(`  Rate: ${item.rate}`);
    console.log(`  Keywords: ${item.keywords?.join(', ') || 'N/A'}`);
  });
  
  return priceItems;
}

// Main execution
async function main() {
  const inputFile = 'C:\\Users\\abaza\\Downloads\\Product (product.product) (1).xlsx';
  const outputFile = path.join(__dirname, 'data', 'tfp-pricelist.json');
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    await convertExcelToPriceList(inputFile, outputFile);
    console.log('\n✅ Conversion completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the generated tfp-pricelist.json file');
    console.log('2. Adjust column mappings if needed based on the actual Excel headers shown above');
    console.log('3. Run the import script to load data into Convex');
  } catch (error) {
    console.error('❌ Error during conversion:', error);
    process.exit(1);
  }
}

// Run
main();