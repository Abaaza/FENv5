// Test script to verify Lambda handles files correctly
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testFileUpload(fileName, expectedBehavior) {
  console.log(`\n=== Testing ${fileName} ===`);
  console.log(`Expected: ${expectedBehavior}\n`);
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    console.log('✅ Logged in\n');
    
    // 2. Upload file
    console.log('2. Uploading file...');
    const filePath = path.join(__dirname, 'src/tests', fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return;
    }
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('matchingMethod', 'LOCAL');
    form.append('clientName', 'Test Client');
    form.append('projectName', 'Test Project');
    
    const startTime = Date.now();
    
    try {
      const { data: uploadData } = await axios.post(
        `${API_URL}/api/price-matching/upload-and-match`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30000 // 30 second timeout
        }
      );
      
      const uploadTime = Date.now() - startTime;
      console.log(`✅ Upload successful in ${uploadTime}ms`);
      console.log(`Job ID: ${uploadData.jobId}`);
      console.log(`Items: ${uploadData.itemCount}`);
      
      // 3. Check job status
      if (uploadData.jobId) {
        console.log('\n3. Checking job status...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        try {
          const { data: statusData } = await axios.get(
            `${API_URL}/api/price-matching/${uploadData.jobId}/status`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          console.log(`Status: ${statusData.status}`);
          console.log(`Progress: ${statusData.progress}%`);
          if (statusData.error) {
            console.log(`Error: ${statusData.error}`);
          }
          
          // For small files, wait for completion
          if (uploadData.itemCount <= 500 && statusData.status === 'matching') {
            console.log('\nWaiting for completion...');
            let attempts = 0;
            while (attempts < 30) { // Max 60 seconds
              await new Promise(resolve => setTimeout(resolve, 2000));
              const { data: checkStatus } = await axios.get(
                `${API_URL}/api/price-matching/${uploadData.jobId}/status`,
                { headers: { 'Authorization': `Bearer ${token}` } }
              );
              
              console.log(`Progress: ${checkStatus.progress}% - ${checkStatus.progressMessage || checkStatus.status}`);
              
              if (checkStatus.status === 'completed' || checkStatus.status === 'failed') {
                console.log(`\nFinal status: ${checkStatus.status}`);
                if (checkStatus.error) {
                  console.log(`Error: ${checkStatus.error}`);
                }
                break;
              }
              attempts++;
            }
          }
        } catch (error) {
          console.log('❌ Status check failed:', error.response?.data || error.message);
        }
      }
      
    } catch (error) {
      const uploadTime = Date.now() - startTime;
      console.log(`❌ Upload failed after ${uploadTime}ms`);
      console.log('Error:', error.response?.data?.error || error.message);
      
      if (error.response?.status === 500 && expectedBehavior.includes('fail')) {
        console.log('✅ This was expected for large files');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('=== Lambda File Size Test Suite ===');
  console.log('Testing file upload with different sizes\n');
  
  // Test different file sizes
  const tests = [
    { file: 'test-boq.xlsx', expected: 'Should process successfully (small file ~5 items)' },
    { file: 'test-boq-100-items.xlsx', expected: 'Should process successfully (100 items)' },
    { file: 'test-boq-500-items.xlsx', expected: 'Should process successfully (500 items)' },
    { file: 'test-boq-1000-items.xlsx', expected: 'Should process successfully (1000 items)' },
    { file: 'test-boq-2000-items.xlsx', expected: 'Should process successfully (2000 items - at limit)' }
  ];
  
  for (const test of tests) {
    await testFileUpload(test.file, test.expected);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait between tests
  }
  
  console.log('\n=== Tests Complete ===');
}

// Run the tests
runTests().catch(console.error);