// Minimal test to find exact error
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function test() {
  try {
    // 1. Login with your credentials
    console.log('1. Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'  // Based on the logs, this password works
    });
    console.log('✅ Logged in successfully');
    const token = loginData.accessToken;
    
    // 2. Create minimal Excel file
    console.log('\n2. Creating minimal Excel file...');
    const testFile = path.join(__dirname, 'minimal-test.xlsx');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ');
    
    // Just 3 rows
    worksheet.addRow(['Item', 'Description', 'Unit', 'Qty']);
    worksheet.addRow(['1', 'Test Item 1', 'm³', '10']);
    worksheet.addRow(['2', 'Test Item 2', 'm²', '20']);
    
    await workbook.xlsx.writeFile(testFile);
    const fileSize = fs.statSync(testFile).size;
    console.log(`✅ File created: ${(fileSize / 1024).toFixed(2)} KB`);
    
    // 3. Upload
    console.log('\n3. Uploading file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    form.append('projectName', 'Minimal Test');
    form.append('method', 'LOCAL');
    
    try {
      const { data: uploadData } = await axios.post(
        `${API_URL}/api/price-matching/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          timeout: 60000
        }
      );
      
      console.log('✅ Upload successful!');
      console.log('Response:', JSON.stringify(uploadData, null, 2));
      
      // 4. Check job status once
      if (uploadData.jobId) {
        console.log('\n4. Checking job status...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const { data: jobData } = await axios.get(
          `${API_URL}/api/price-matching/${uploadData.jobId}/status`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        console.log('Job status:', jobData.status);
        console.log('Progress:', jobData.progress + '%');
        console.log('Message:', jobData.progressMessage);
      }
      
    } catch (uploadError) {
      console.log('\n❌ Upload failed!');
      if (uploadError.response) {
        console.log('Status:', uploadError.response.status);
        console.log('Error:', uploadError.response.data);
        
        // Get the request ID to check logs
        const requestId = uploadError.response.data?.error?.match(/Request ID: ([a-z0-9]+)/)?.[1];
        if (requestId) {
          console.log('\nTo see detailed error in Lambda logs, search for:', requestId);
        }
      } else {
        console.log('Error:', uploadError.message);
      }
    }
    
    // Clean up
    fs.unlinkSync(testFile);
    console.log('\n✅ Cleaned up test file');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

console.log('=== Minimal Upload Test ===\n');
console.log('This test uses a very small file to isolate the issue.\n');
test();