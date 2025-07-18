const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123'
};

async function testUpload() {
  console.log('\n=== Detailed Upload Test ===\n');
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    const authToken = loginResponse.data.accessToken;
    console.log('✓ Login successful');
    
    // 2. Create test file
    console.log('\n2. Creating test Excel file...');
    const testFilePath = path.join(__dirname, 'test-upload.xlsx');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ');
    
    // Add headers
    worksheet.addRow(['Item No', 'Description', 'Unit', 'Quantity']);
    worksheet.addRow(['1.1', 'Excavation for foundation', 'm³', '100']);
    worksheet.addRow(['1.2', 'Concrete Grade C25', 'm³', '50']);
    
    await workbook.xlsx.writeFile(testFilePath);
    console.log('✓ Test file created');
    
    // 3. Upload file
    console.log('\n3. Uploading file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('projectName', 'Test Project');
    form.append('method', 'LOCAL');
    
    try {
      const uploadResponse = await axios.post(
        `${API_URL}/api/price-matching/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${authToken}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      console.log('✓ Upload successful!');
      console.log('Response:', JSON.stringify(uploadResponse.data, null, 2));
      
    } catch (uploadError) {
      console.error('✗ Upload failed:');
      console.error('Status:', uploadError.response?.status);
      console.error('Status Text:', uploadError.response?.statusText);
      console.error('Error Data:', uploadError.response?.data);
      console.error('Headers:', uploadError.response?.headers);
    }
    
    // Clean up
    fs.unlinkSync(testFilePath);
    console.log('\n✓ Test file cleaned up');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testUpload();