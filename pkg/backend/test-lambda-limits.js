// Test script to verify actual Lambda processing limits
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testFileSize(itemCount) {
  console.log(`\n=== Testing ${itemCount} items ===`);
  
  const startTime = Date.now();
  
  try {
    // 1. Login
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    
    // 2. Use existing test file or small file
    let filePath;
    const testFilePath = path.join(__dirname, 'src/tests', `test-boq-${itemCount}-items.xlsx`);
    
    if (fs.existsSync(testFilePath)) {
      filePath = testFilePath;
      console.log(`Using existing test file`);
    } else {
      // Use the smallest available file
      filePath = path.join(__dirname, 'src/tests', 'test-boq.xlsx');
      console.log(`Using default test file`);
    }
    
    // 3. Upload file
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('matchingMethod', 'LOCAL');
    form.append('clientName', 'Test Client');
    form.append('projectName', `Test ${itemCount} Items`);
    
    const uploadStartTime = Date.now();
    
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
          timeout: 120000 // 2 minute timeout
        }
      );
      
      const uploadTime = Date.now() - uploadStartTime;
      console.log(`✅ Upload successful in ${(uploadTime/1000).toFixed(1)}s`);
      console.log(`Items: ${uploadData.itemCount}`);
      
      // Wait for processing
      if (uploadData.jobId && uploadData.itemCount <= 1000) {
        let attempts = 0;
        while (attempts < 60) { // 2 minutes max
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const { data: status } = await axios.get(
              `${API_URL}/api/price-matching/${uploadData.jobId}/status`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (status.status === 'completed') {
              const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`✅ COMPLETED in ${totalTime}s - ${status.matchedCount} matches`);
              return true;
            } else if (status.status === 'failed') {
              console.log(`❌ Failed: ${status.error}`);
              return false;
            }
          } catch (e) {
            // Ignore status check errors
          }
          attempts++;
        }
        console.log('⏱️ Timed out waiting for completion');
      }
      
    } catch (error) {
      const uploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
      console.log(`❌ Upload failed after ${uploadTime}s`);
      console.log(`Error: ${error.response?.data?.error || error.message}`);
      return false;
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('=== Lambda Processing Limits Test ===');
  console.log('Testing to find actual processing limits\n');
  
  // Wait for deployment
  console.log('Waiting 30s for deployment to complete...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Test different sizes
  const sizes = [100, 500, 1000];
  const results = {};
  
  for (const size of sizes) {
    const success = await testFileSize(size);
    results[size] = success;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait between tests
  }
  
  console.log('\n=== Summary ===');
  for (const [size, success] of Object.entries(results)) {
    console.log(`${size} items: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  }
  
  // Find the maximum successful size
  const successfulSizes = Object.entries(results)
    .filter(([_, success]) => success)
    .map(([size, _]) => parseInt(size));
  
  if (successfulSizes.length > 0) {
    const maxSize = Math.max(...successfulSizes);
    console.log(`\n📊 Maximum successful size: ${maxSize} items`);
    console.log(`Recommendation: Set Lambda limit to ${Math.floor(maxSize * 0.8)} items for safety margin`);
  }
}

// Run the tests
runTests().catch(console.error);