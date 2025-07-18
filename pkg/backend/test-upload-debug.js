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

async function testUploadWithDebugging() {
  console.log('\n=== Upload Debug Test ===\n');
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    const authToken = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    // 2. Create a medium-sized test file
    console.log('2. Creating test file with 100 rows...');
    const testFilePath = path.join(__dirname, 'test-debug.xlsx');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ');
    
    // Headers
    worksheet.addRow(['Item No', 'Description', 'Unit', 'Quantity', 'Rate']);
    
    // Add 100 rows
    for (let i = 1; i <= 100; i++) {
      worksheet.addRow([
        `1.${i}`,
        `Construction work item ${i} - This is a detailed description for testing`,
        'm³',
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 1000)
      ]);
    }
    
    await workbook.xlsx.writeFile(testFilePath);
    const fileSize = fs.statSync(testFilePath).size;
    console.log(`✅ File created: ${(fileSize / 1024).toFixed(2)} KB\n`);
    
    // 3. Upload with detailed error handling
    console.log('3. Uploading file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('projectName', 'Debug Test Project');
    form.append('method', 'LOCAL');
    
    const startTime = Date.now();
    
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
          maxBodyLength: Infinity,
          timeout: 120000, // 2 minutes
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\rUpload progress: ${percentCompleted}%`);
          }
        }
      );
      
      console.log('\n✅ Upload successful!');
      console.log('Response:', JSON.stringify(uploadResponse.data, null, 2));
      
      // 4. Poll job status
      if (uploadResponse.data.jobId) {
        console.log('\n4. Polling job status...');
        await pollJobWithDetails(authToken, uploadResponse.data.jobId);
      }
      
    } catch (uploadError) {
      console.log('\n❌ Upload failed!');
      console.log('Duration:', ((Date.now() - startTime) / 1000).toFixed(2), 'seconds');
      
      if (uploadError.response) {
        console.log('\nError details:');
        console.log('Status:', uploadError.response.status);
        console.log('Status Text:', uploadError.response.statusText);
        console.log('Headers:', uploadError.response.headers);
        console.log('Data:', JSON.stringify(uploadError.response.data, null, 2));
      } else if (uploadError.request) {
        console.log('No response received. Request error:', uploadError.message);
      } else {
        console.log('Error:', uploadError.message);
      }
    }
    
    // Clean up
    fs.unlinkSync(testFilePath);
    console.log('\n✅ Test file cleaned up');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

async function pollJobWithDetails(authToken, jobId) {
  let attempts = 0;
  let lastProgress = -1;
  let stuckCount = 0;
  
  while (attempts < 60) { // 10 minutes max
    try {
      const response = await axios.get(
        `${API_URL}/api/price-matching/job/${jobId}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      
      const job = response.data;
      const timestamp = new Date().toLocaleTimeString();
      
      // Check if progress changed
      if (job.progress === lastProgress) {
        stuckCount++;
      } else {
        stuckCount = 0;
        lastProgress = job.progress;
      }
      
      console.log(`[${timestamp}] Status: ${job.status}, Progress: ${job.progress}%, Processed: ${job.processedCount || 0}/${job.totalCount || 0}`);
      
      if (job.error) {
        console.log(`Error: ${job.error}`);
      }
      
      if (stuckCount > 3) {
        console.log('⚠️  Progress appears stuck!');
      }
      
      if (job.status === 'completed') {
        console.log('\n✅ Job completed successfully!');
        console.log(`Total items: ${job.totalCount}`);
        console.log(`Matched: ${job.matchedCount || 0}`);
        console.log(`Duration: ${job.duration || 'N/A'}`);
        break;
      } else if (job.status === 'failed') {
        console.log(`\n❌ Job failed: ${job.error}`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      attempts++;
    } catch (error) {
      console.log(`\n❌ Poll error: ${error.response?.data?.error || error.message}`);
      break;
    }
  }
  
  if (attempts >= 60) {
    console.log('\n⏱️  Polling timeout - job taking too long');
  }
}

// Run the test
testUploadWithDebugging();