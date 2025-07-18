// Quick test to see the exact error
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function quickTest() {
  try {
    // Login
    console.log('Logging in...');
    const { data: { accessToken } } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword123'
    });
    console.log('✅ Logged in\n');
    
    // Create small test file (10 rows)
    console.log('Creating small test file...');
    const testFile = path.join(__dirname, 'quick-test.xlsx');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ');
    
    worksheet.addRow(['Item', 'Description', 'Unit', 'Qty']);
    for (let i = 1; i <= 10; i++) {
      worksheet.addRow([`1.${i}`, `Test item ${i}`, 'm³', i * 10]);
    }
    
    await workbook.xlsx.writeFile(testFile);
    console.log('✅ File created\n');
    
    // Upload
    console.log('Uploading...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    form.append('projectName', 'Quick Test');
    form.append('method', 'LOCAL');
    
    const { data } = await axios.post(
      `${API_URL}/api/price-matching/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 60000
      }
    );
    
    console.log('✅ Upload response:', data);
    
    if (data.jobId) {
      // Poll once
      console.log('\nChecking job status...');
      const jobResponse = await axios.get(
        `${API_URL}/api/price-matching/job/${data.jobId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      console.log('Job status:', jobResponse.data);
    }
    
    // Cleanup
    fs.unlinkSync(testFile);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

quickTest();