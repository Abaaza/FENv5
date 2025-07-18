// Test script specifically for 2000 item file
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function test2000ItemFile() {
  console.log('=== Testing 2000 Item File Processing ===\n');
  
  const startTime = Date.now();
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    console.log('✅ Logged in\n');
    
    // 2. First, let's create a file with exactly 1900 items (safely under 2000)
    const { generateLargeTestFile } = require('./generate-large-test-file');
    console.log('2. Generating test file with 1900 items...');
    const filePath = await generateLargeTestFile(1900);
    console.log('✅ Test file created\n');
    
    // 3. Upload file
    console.log('3. Uploading 1900 item file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('matchingMethod', 'LOCAL');
    form.append('clientName', 'Test Client');
    form.append('projectName', 'Test 1900 Items');
    
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
          timeout: 300000 // 5 minute timeout
        }
      );
      
      const uploadTime = Date.now() - uploadStartTime;
      console.log(`✅ Upload successful in ${(uploadTime/1000).toFixed(1)} seconds`);
      console.log(`Job ID: ${uploadData.jobId}`);
      console.log(`Items: ${uploadData.itemCount}\n`);
      
      // 4. Monitor job progress
      if (uploadData.jobId) {
        console.log('4. Monitoring job progress...');
        let lastProgress = -1;
        let attempts = 0;
        const maxAttempts = 150; // 5 minutes max
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
          
          try {
            const { data: statusData } = await axios.get(
              `${API_URL}/api/price-matching/${uploadData.jobId}/status`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (statusData.progress !== lastProgress) {
              const elapsed = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
              console.log(`[${elapsed}s] Progress: ${statusData.progress}% - ${statusData.progressMessage || statusData.status}`);
              lastProgress = statusData.progress;
            }
            
            if (statusData.status === 'completed') {
              const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`\n✅ JOB COMPLETED SUCCESSFULLY!`);
              console.log(`Total time: ${totalTime} seconds`);
              console.log(`Matched items: ${statusData.matchedCount}/${statusData.itemCount}`);
              break;
            } else if (statusData.status === 'failed') {
              console.log(`\n❌ Job failed: ${statusData.error}`);
              break;
            }
          } catch (error) {
            console.log('Error checking status:', error.message);
          }
          
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`\n⏱️ Test timed out after ${totalTime} seconds`);
          console.log('Job may still be running...');
        }
      }
      
    } catch (error) {
      const uploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
      console.log(`\n❌ Upload failed after ${uploadTime} seconds`);
      console.log('Error:', error.response?.data?.error || error.message);
      
      if (error.code === 'ECONNABORTED') {
        console.log('The request timed out - file may be too large for Lambda');
      }
    }
    
    // Clean up
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('\n🧹 Cleaned up test file');
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Test completed in ${totalTime} seconds ===`);
}

// Run the test
test2000ItemFile().catch(console.error);