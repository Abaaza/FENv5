// Test with immediate processing trigger
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testWithProcessing() {
  console.log('=== Testing with Processing Trigger ===\n');
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    console.log('✅ Logged in\n');
    
    // 2. Create small test file
    console.log('2. Creating test file...');
    const testFile = path.join(__dirname, 'process-test.xlsx');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ');
    
    worksheet.addRow(['Item', 'Description', 'Unit', 'Qty']);
    for (let i = 1; i <= 10; i++) {
      worksheet.addRow([
        `1.${i}`,
        `Test item ${i} for Lambda processing`,
        'm³',
        i * 10
      ]);
    }
    
    await workbook.xlsx.writeFile(testFile);
    console.log('✅ File created (10 rows)\n');
    
    // 3. Try upload-and-match endpoint (might process immediately)
    console.log('3. Using upload-and-match endpoint...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    form.append('projectName', 'Immediate Processing Test');
    form.append('method', 'LOCAL');
    
    try {
      const { data } = await axios.post(
        `${API_URL}/api/price-matching/upload-and-match`,  // Note: different endpoint
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          timeout: 300000 // 5 minutes
        }
      );
      
      console.log('✅ Upload response:', JSON.stringify(data, null, 2));
      
      if (data.jobId) {
        // Monitor the job
        console.log('\n4. Monitoring job...');
        await monitorJob(token, data.jobId);
      }
      
    } catch (error) {
      console.log('❌ Upload-and-match failed:', error.response?.data || error.message);
      
      // Try regular upload + manual start
      console.log('\n3b. Trying regular upload...');
      const uploadForm = new FormData();
      uploadForm.append('file', fs.createReadStream(testFile));
      uploadForm.append('projectName', 'Manual Start Test');
      uploadForm.append('method', 'LOCAL');
      
      const { data: uploadData } = await axios.post(
        `${API_URL}/api/price-matching/upload`,
        uploadForm,
        {
          headers: {
            ...uploadForm.getHeaders(),
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('✅ Upload successful, job ID:', uploadData.jobId);
      
      // Try to manually start the job
      console.log('\n4. Attempting to start processing...');
      try {
        const startResponse = await axios.post(
          `${API_URL}/api/price-matching/${uploadData.jobId}/start`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        console.log('Start response:', startResponse.data);
      } catch (startError) {
        console.log('Start endpoint response:', startError.response?.data || startError.message);
      }
      
      // Monitor anyway
      await monitorJob(token, uploadData.jobId);
    }
    
    // Clean up
    fs.unlinkSync(testFile);
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

async function monitorJob(token, jobId) {
  for (let i = 0; i < 30; i++) {
    try {
      const { data } = await axios.get(
        `${API_URL}/api/price-matching/${jobId}/status`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      console.log(`[${new Date().toLocaleTimeString()}] Status: ${data.status}, Progress: ${data.progress}%`);
      
      if (data.status === 'completed' || data.status === 'failed') {
        console.log(`\nJob ${data.status}!`);
        if (data.status === 'completed') {
          console.log(`Matched: ${data.matchedCount || 0} items`);
        }
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.log('Monitor error:', error.message);
      break;
    }
  }
}

// Also check if there's a processor status endpoint
async function checkProcessorStatus() {
  try {
    console.log('\n=== Checking Processor Status ===');
    const { data } = await axios.get(`${API_URL}/api/price-matching/processor/status`);
    console.log('Processor status:', data);
  } catch (error) {
    console.log('No processor status endpoint or not accessible');
  }
}

// Run tests
(async () => {
  await checkProcessorStatus();
  await testWithProcessing();
})();