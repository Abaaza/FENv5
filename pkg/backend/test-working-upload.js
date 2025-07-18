// Working test with correct endpoints and monitoring
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function monitorJob(token, jobId) {
  console.log('\nMonitoring job progress...');
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes with 5s intervals
  
  while (attempts < maxAttempts) {
    try {
      const { data } = await axios.get(
        `${API_URL}/api/price-matching/${jobId}/status`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const timestamp = new Date().toLocaleTimeString();
      process.stdout.write(`\r[${timestamp}] Status: ${data.status} | Progress: ${data.progress}% | ${data.progressMessage || 'Processing...'}`);
      
      if (data.status === 'completed') {
        console.log('\n✅ Job completed successfully!');
        console.log(`Total items: ${data.totalCount || data.itemCount}`);
        console.log(`Matched: ${data.matchedCount || 0}`);
        return true;
      } else if (data.status === 'failed') {
        console.log('\n❌ Job failed:', data.error || 'Unknown error');
        return false;
      }
      
      // If stuck at 90% for too long
      if (data.progress === 90 && attempts > 20) {
        console.log('\n⚠️  Progress stuck at 90% - this is a known issue');
        console.log('The job is likely trying to save results to database');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    } catch (error) {
      console.log('\n❌ Error checking status:', error.response?.data || error.message);
      return false;
    }
  }
  
  console.log('\n⏱️  Timeout - job taking too long');
  return false;
}

async function testDifferentSizes() {
  try {
    // Login
    console.log('Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    console.log('✅ Logged in\n');
    
    // Test different file sizes
    const testCases = [
      { rows: 5, name: 'Tiny (5 rows)' },
      { rows: 20, name: 'Small (20 rows)' },
      { rows: 50, name: 'Medium (50 rows)' },
      { rows: 100, name: 'Large (100 rows)' }
    ];
    
    for (const test of testCases) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Testing: ${test.name}`);
      console.log('='.repeat(50));
      
      // Create test file
      const testFile = path.join(__dirname, `test-${test.rows}.xlsx`);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('BOQ');
      
      // Headers
      worksheet.addRow(['Item No', 'Description', 'Unit', 'Quantity', 'Rate']);
      
      // Data rows
      for (let i = 1; i <= test.rows; i++) {
        worksheet.addRow([
          `${Math.floor(i/10)}.${i%10}`,
          `Construction work item ${i} - This is item number ${i}`,
          ['m³', 'm²', 'kg', 'nos'][i % 4],
          Math.floor(Math.random() * 100) + 1,
          Math.floor(Math.random() * 1000) + 100
        ]);
      }
      
      await workbook.xlsx.writeFile(testFile);
      const fileSize = fs.statSync(testFile).size;
      console.log(`File size: ${(fileSize / 1024).toFixed(2)} KB`);
      
      // Upload
      const form = new FormData();
      form.append('file', fs.createReadStream(testFile));
      form.append('projectName', test.name);
      form.append('method', 'LOCAL');
      
      try {
        console.log('Uploading...');
        const startTime = Date.now();
        
        const { data: uploadData } = await axios.post(
          `${API_URL}/api/price-matching/upload`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              'Authorization': `Bearer ${token}`
            },
            timeout: 300000 // 5 minutes
          }
        );
        
        const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Upload successful in ${uploadTime}s`);
        console.log(`Job ID: ${uploadData.jobId}`);
        console.log(`Items to process: ${uploadData.itemCount}`);
        
        // Monitor job
        const success = await monitorJob(token, uploadData.jobId);
        
        if (!success && test.rows > 50) {
          console.log('\n💡 Larger files might timeout due to database save issues');
        }
        
      } catch (error) {
        console.log('❌ Upload failed:', error.response?.data || error.message);
      }
      
      // Clean up
      fs.unlinkSync(testFile);
      
      // Wait between tests
      if (test !== testCases[testCases.length - 1]) {
        console.log('\nWaiting 10 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log('\n\n=== Summary ===');
    console.log('Small files (< 50 rows) should work fine');
    console.log('Larger files may get stuck at 90% due to database save issues');
    console.log('This is a known issue with the Convex batch save operation');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

console.log('=== BOQ Upload Test - Different File Sizes ===\n');
testDifferentSizes();