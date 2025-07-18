// Test async processing for 2000 items
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testAsync2000Items() {
  console.log('=== Testing Async Processing for Large Files ===\n');
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    console.log('✅ Logged in\n');
    
    // 2. Test with 2000 item file
    const filePath = path.join(__dirname, 'src/tests', 'test-boq-2000-items.xlsx');
    if (!fs.existsSync(filePath)) {
      console.log('Test file not found, using 1000 item file');
      filePath = path.join(__dirname, 'src/tests', 'test-boq-1000-items.xlsx');
    }
    
    console.log('2. Uploading large file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('matchingMethod', 'LOCAL');
    form.append('clientName', 'Test Client');
    form.append('projectName', 'Test Async Processing');
    
    const uploadStartTime = Date.now();
    
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
        timeout: 60000 // 1 minute timeout for upload
      }
    );
    
    const uploadTime = Date.now() - uploadStartTime;
    console.log(`✅ Upload returned in ${(uploadTime/1000).toFixed(1)}s`);
    console.log(`Job ID: ${uploadData.jobId}`);
    console.log(`Items: ${uploadData.itemCount}\n`);
    
    // 3. Poll for status
    console.log('3. Monitoring job progress...');
    let lastProgress = -1;
    let attempts = 0;
    const maxAttempts = 450; // 15 minutes max (Lambda timeout)
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
      
      try {
        const { data: statusData } = await axios.get(
          `${API_URL}/api/price-matching/${uploadData.jobId}/status`,
          { 
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 5000
          }
        );
        
        if (statusData.progress !== lastProgress || statusData.status !== 'matching') {
          const elapsed = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
          console.log(`[${elapsed}s] Status: ${statusData.status}, Progress: ${statusData.progress}% - ${statusData.progressMessage || ''}`);
          lastProgress = statusData.progress;
        }
        
        if (statusData.status === 'completed') {
          const totalTime = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
          console.log(`\n✅ JOB COMPLETED SUCCESSFULLY!`);
          console.log(`Total time: ${totalTime} seconds`);
          console.log(`Matched items: ${statusData.matchedCount}/${statusData.itemCount}`);
          
          // Test download
          console.log('\n4. Testing download...');
          try {
            const downloadResponse = await axios.get(
              `${API_URL}/api/price-matching/${uploadData.jobId}/export`,
              { 
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'arraybuffer'
              }
            );
            console.log(`✅ Download successful (${(downloadResponse.data.length / 1024).toFixed(1)} KB)`);
          } catch (e) {
            console.log('❌ Download failed:', e.message);
          }
          
          return true;
        } else if (statusData.status === 'failed') {
          console.log(`\n❌ Job failed: ${statusData.error}`);
          return false;
        }
      } catch (error) {
        // Ignore transient errors
        if (error.code !== 'ECONNABORTED') {
          console.log(`Status check error: ${error.message}`);
        }
      }
      
      attempts++;
    }
    
    console.log(`\n⏱️ Test timed out after ${attempts * 2} seconds`);
    return false;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data?.error || error.message);
    return false;
  }
}

// Run the test
testAsync2000Items()
  .then(success => {
    console.log(`\n=== Test ${success ? 'PASSED' : 'FAILED'} ===`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });