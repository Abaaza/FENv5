import ExcelJS from 'exceljs';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// Create a test Excel file with the new schema
async function createTestFile() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Price List');

  // Add headers
  worksheet.columns = [
    { header: 'id', key: 'id', width: 40 },
    { header: 'name', key: 'name', width: 30 },
    { header: 'product_template_variant_value_ids', key: 'variant', width: 40 },
    { header: 'operation_cost', key: 'cost', width: 15 },
    { header: 'uom_id', key: 'uom', width: 10 }
  ];

  // Add test data
  const testData = [
    {
      id: '__export__.product_product_test_001',
      name: 'Fence Post',
      variant: 'size: 2.4m x 100mm',
      cost: 25.50,
      uom: 'Unit'
    },
    {
      id: '__export__.product_product_test_002',
      name: 'Chain Link Fence',
      variant: 'height: 1.8m, gauge: 11',
      cost: 45.00,
      uom: 'm²'
    },
    {
      id: '__export__.product_product_test_003',
      name: 'Gate Hinge',
      variant: 'type: Heavy Duty, size: 150mm',
      cost: 12.75,
      uom: 'Unit'
    },
    {
      id: '__export__.product_product_test_004',
      name: 'Barbed Wire',
      variant: 'gauge: 12.5, length: 200m roll',
      cost: 85.00,
      uom: 'Roll'
    },
    {
      id: '__export__.product_product_test_005',
      name: 'Concrete Post',
      variant: 'size: 2.7m x 125mm slotted',
      cost: 42.00,
      uom: 'Unit'
    }
  ];

  testData.forEach(data => {
    worksheet.addRow(data);
  });

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Save the file
  const filename = 'test-new-schema.xlsx';
  await workbook.xlsx.writeFile(filename);
  console.log(`✓ Created test file: ${filename}`);
  console.log(`  Contains ${testData.length} test items with new schema`);
  
  return filename;
}

// Test the import
async function testImport() {
  const API_URL = 'http://localhost:5000';
  const EMAIL = 'abaza@tfp.com';
  const PASSWORD = 'abaza123';
  
  try {
    // Create test file
    const testFile = await createTestFile();
    
    // Login
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    const token = loginResponse.data.accessToken;
    console.log('✓ Login successful');
    
    // Import the file
    console.log('\n2. Importing test file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    
    const importResponse = await axios.post(`${API_URL}/api/price-list/import`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ Import started:', importResponse.data);
    
    // Check status
    if (importResponse.data.jobId) {
      console.log('\n3. Checking import status...');
      
      const checkStatus = async () => {
        const statusResponse = await axios.get(
          `${API_URL}/api/price-list/import/${importResponse.data.jobId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        const job = statusResponse.data;
        console.log(`  Progress: ${job.progress}% - ${job.progressMessage || 'Processing...'}`);
        
        if (job.status === 'completed') {
          console.log('\n✓ Import completed successfully!');
          if (job.results) {
            console.log(`  Created: ${job.results.created}`);
            console.log(`  Updated: ${job.results.updated}`);
            console.log(`  Skipped: ${job.results.skipped}`);
          }
          
          // Verify the imported items
          console.log('\n4. Verifying imported items...');
          const itemsResponse = await axios.get(`${API_URL}/api/price-list`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const newSchemaItems = itemsResponse.data.filter(item => 
            item.id && item.id.includes('test')
          );
          
          console.log(`✓ Found ${newSchemaItems.length} test items in database`);
          newSchemaItems.forEach(item => {
            console.log(`  - ${item.name} (${item.product_template_variant_value_ids}) @ ${item.operation_cost} ${item.uom_id}`);
          });
          
        } else if (job.status === 'failed') {
          console.error('✗ Import failed:', job.error);
        } else {
          // Check again in 2 seconds
          setTimeout(checkStatus, 2000);
        }
      };
      
      setTimeout(checkStatus, 2000);
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
console.log('Testing new schema import...\n');
testImport();