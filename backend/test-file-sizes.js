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

async function createTestFile(rows, filename) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('BOQ');
  
  // Add headers
  worksheet.addRow(['Item No', 'Description', 'Unit', 'Quantity', 'Rate', 'Amount']);
  
  // Add data rows
  for (let i = 0; i < rows; i++) {
    worksheet.addRow([
      `${Math.floor(i/100)}.${i%100}`,
      `Construction item ${i} - ${Math.random().toString(36).substring(7)}`,
      ['m³', 'm²', 'kg', 'nos', 'L'][Math.floor(Math.random() * 5)],
      Math.floor(Math.random() * 1000),
      Math.floor(Math.random() * 10000),
      Math.floor(Math.random() * 1000000)
    ]);
  }
  
  const filePath = path.join(__dirname, filename);
  await workbook.xlsx.writeFile(filePath);
  
  const stats = fs.statSync(filePath);
  return { path: filePath, size: stats.size };
}

async function testFileUpload(authToken, fileInfo, testName) {
  console.log(`\n${testName}:`);
  console.log(`File size: ${(fileInfo.size / 1024).toFixed(2)} KB`);
  
  const form = new FormData();
  form.append('file', fs.createReadStream(fileInfo.path));
  form.append('projectName', testName);
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
        timeout: 300000 // 5 minutes
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Upload successful in ${duration}s`);
    console.log(`Job ID: ${uploadResponse.data.jobId}`);
    
    // Poll for results
    if (uploadResponse.data.jobId) {
      await pollJobStatus(authToken, uploadResponse.data.jobId);
    }
    
    return true;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ Upload failed after ${duration}s`);
    console.log(`Error: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function pollJobStatus(authToken, jobId) {
  console.log(`Polling job ${jobId}...`);
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes with 10s intervals
  
  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(
        `${API_URL}/api/price-matching/job/${jobId}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      
      const job = response.data;
      console.log(`Status: ${job.status}, Progress: ${job.progress}%`);
      
      if (job.status === 'completed') {
        console.log('✅ Job completed successfully!');
        break;
      } else if (job.status === 'failed') {
        console.log(`❌ Job failed: ${job.error}`);
        break;
      }
      
      // Check if progress is stuck
      if (job.progress === 90 && attempts > 5) {
        console.log('⚠️  Progress stuck at 90%');
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
    } catch (error) {
      console.log(`Poll error: ${error.message}`);
      break;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('⏱️  Polling timeout - job taking too long');
  }
}

async function runTests() {
  console.log('=== File Size Upload Tests ===\n');
  
  try {
    // Login first
    console.log('Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    const authToken = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    // Create test files of different sizes
    const testCases = [
      { rows: 10, name: 'Small file (10 rows)' },
      { rows: 100, name: 'Medium file (100 rows)' },
      { rows: 500, name: 'Large file (500 rows)' },
      { rows: 1000, name: 'Extra large file (1000 rows)' },
      { rows: 2000, name: 'Huge file (2000 rows)' }
    ];
    
    for (const testCase of testCases) {
      const fileInfo = await createTestFile(testCase.rows, `test-${testCase.rows}.xlsx`);
      await testFileUpload(authToken, fileInfo, testCase.name);
      
      // Clean up
      fs.unlinkSync(fileInfo.path);
      
      // Wait between tests to avoid rate limits
      if (testCase !== testCases[testCases.length - 1]) {
        console.log('\nWaiting 15 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
    
    console.log('\n=== All tests completed ===');
    
  } catch (error) {
    console.error('Test suite failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run tests
runTests();