import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface PriceItem {
  _id: string;
  id: string;
  code?: string;
  ref?: string;
  description: string;
  keywords?: string[];
  // Construction-specific fields
  material_type?: string;
  material_grade?: string;
  material_size?: string;
  material_finish?: string;
  category?: string;
  subcategory?: string;
  work_type?: string;
  brand?: string;
  unit?: string;
  rate: number;
  labor_rate?: number;
  material_rate?: number;
  wastage_percentage?: number;
  // Supplier info
  supplier?: string;
  location?: string;
  availability?: string;
  remark?: string;
  // Metadata (will be added during import)
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

function cleanString(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function cleanNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

function generateKeywords(item: Partial<PriceItem>): string[] {
  const keywords: Set<string> = new Set();
  
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

async function convertExcelToPriceList(inputPath: string, outputPath: string) {
  console.log('Reading Excel file:', inputPath);
  
  // Read the Excel file
  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
  
  console.log(`Found ${jsonData.length} rows in sheet: ${sheetName}`);
  
  // Sample the first few rows to understand the structure
  console.log('\nFirst 3 rows of data:');
  jsonData.slice(0, 3).forEach((row, index) => {
    console.log(`\nRow ${index + 1}:`, row);
  });
  
  // Map the Excel data to PriceItem schema
  const priceItems: PriceItem[] = [];
  
  for (const row of jsonData) {
    // Map columns based on common naming patterns
    // You may need to adjust these mappings based on your actual Excel column headers
    const item: PriceItem = {
      _id: uuidv4(),
      id: uuidv4(),
      // Try different possible column names for code
      code: cleanString(row['Internal Reference'] || row['Code'] || row['SKU'] || row['Item Code'] || ''),
      ref: cleanString(row['Barcode'] || row['Reference'] || row['Ref'] || ''),
      // Try different possible column names for description
      description: cleanString(row['Name'] || row['Description'] || row['Product Name'] || row['Item Description'] || ''),
      // Category fields
      category: cleanString(row['Product Category'] || row['Category'] || row['Type'] || ''),
      subcategory: cleanString(row['Product Type'] || row['Subcategory'] || row['Sub Category'] || ''),
      // Unit of measure
      unit: cleanString(row['Unit of Measure'] || row['UoM'] || row['Unit'] || row['Units'] || 'Each'),
      // Price/Rate
      rate: cleanNumber(row['Sales Price'] || row['Price'] || row['Rate'] || row['Cost'] || 0),
      // Material specific fields
      material_type: cleanString(row['Material Type'] || row['Material'] || ''),
      material_size: cleanString(row['Size'] || row['Dimensions'] || ''),
      material_finish: cleanString(row['Finish'] || row['Surface'] || ''),
      brand: cleanString(row['Brand'] || row['Manufacturer'] || ''),
      // Supplier info
      supplier: cleanString(row['Vendor'] || row['Supplier'] || row['Responsible'] || ''),
      location: cleanString(row['Location'] || row['Warehouse'] || ''),
      availability: cleanString(row['On Hand'] || row['Stock'] || row['Quantity On Hand'] || ''),
      remark: cleanString(row['Notes'] || row['Remarks'] || row['Comments'] || ''),
      // Metadata
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // Generate keywords based on the item data
    item.keywords = generateKeywords(item);
    
    // Only add items that have a description and rate
    if (item.description && item.rate > 0) {
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
  const outputFile = path.join(__dirname, '..', 'data', 'tfp-pricelist.json');
  
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
    console.log('2. Adjust column mappings in the script if needed');
    console.log('3. Run the import script to load data into Convex');
  } catch (error) {
    console.error('❌ Error during conversion:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { convertExcelToPriceList, PriceItem };