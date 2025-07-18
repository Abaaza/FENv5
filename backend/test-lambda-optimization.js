// Test Lambda optimization for small files
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testLambdaOptimization() {
  console.log('=== Testing Lambda Optimization ===');
  console.log('This test verifies that small files no longer get stuck at 90%\n');
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    console.log('✅ Logged in successfully\n');
    
    // 2. Test different file sizes
    const testCases = [
      { rows: 10, name: 'Small file (10 items)' },
      { rows: 25, name: 'Medium file (25 items)' },
      { rows: 45, name: 'Near threshold (45 items)' },
      { rows: 60, name: 'Above threshold (60 items)' }
    ];
    
    for (const test of testCases) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Testing: ${test.name}`);
      console.log('='.repeat(50));
      
      // Create test file
      const testFile = path.join(__dirname, `lambda-test-${test.rows}.xlsx`);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('BOQ');
      
      // Add headers
      worksheet.addRow(['Item No', 'Description', 'Unit', 'Quantity']);
      
      // Add test items
      for (let i = 1; i <= test.rows; i++) {
        worksheet.addRow([
          `1.${i}`,
          `Construction item ${i} - Lambda optimization test`,
          ['m³', 'm²', 'kg', 'nos'][i % 4],
          Math.floor(Math.random() * 100) + 1
        ]);
      }
      
      await workbook.xlsx.writeFile(testFile);
      console.log(`Created test file with ${test.rows} items`);
      
      // Upload and match
      const form = new FormData();
      form.append('file', fs.createReadStream(testFile));
      form.append('projectName', test.name);
      form.append('method', 'LOCAL');
      
      const uploadStart = Date.now();
      
      try {
        console.log('Uploading and matching...');
        const { data: uploadData } = await axios.post(
          `${API_URL}/api/price-matching/upload-and-match`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              'Authorization': `Bearer ${token}`
            },
            timeout: 300000 // 5 minutes
          }
        );
        
        const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(2);
        console.log(`✅ Upload successful in ${uploadTime}s`);
        console.log(`Job ID: ${uploadData.jobId}`);
        
        // Monitor job progress
        console.log('\nMonitoring progress:');
        let lastProgress = -1;
        let stuckAt90Count = 0;
        let completed = false;
        
        for (let i = 0; i < 60 && !completed; i++) { // Max 5 minutes
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          
          const { data: statusData } = await axios.get(
            `${API_URL}/api/price-matching/${uploadData.jobId}/status`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          // Only log when progress changes
          if (statusData.progress !== lastProgress) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] Progress: ${statusData.progress}% - ${statusData.progressMessage || 'Processing...'}`);
            lastProgress = statusData.progress;
            
            // Reset stuck counter when progress changes
            if (statusData.progress !== 90) {
              stuckAt90Count = 0;
            }
          }
          
          // Count if stuck at 90%
          if (statusData.progress === 90) {
            stuckAt90Count++;
            if (stuckAt90Count === 3) { // After 15 seconds at 90%
              console.log('⚠️  Progress at 90% for 15 seconds...');
            }
          }
          
          if (statusData.status === 'completed') {
            completed = true;
            const totalTime = ((Date.now() - uploadStart) / 1000).toFixed(2);
            console.log(`\n✅ Job completed in ${totalTime}s`);
            console.log(`Matched: ${statusData.matchedCount || 0} items`);
            
            // Check if it was processed synchronously (Lambda optimization)
            if (test.rows <= 50 && totalTime < 30) {
              console.log('🚀 Processed synchronously in Lambda (optimization working!)');
            }
            
            // Flag if it got stuck at 90%
            if (stuckAt90Count >= 6) { // 30+ seconds at 90%
              console.log('❌ Job got stuck at 90% for over 30 seconds');
            } else if (stuckAt90Count >= 3) {
              console.log('⚠️  Job paused at 90% but completed within reasonable time');
            } else {
              console.log('✅ No significant delays at 90%');
            }
          } else if (statusData.status === 'failed') {
            console.log('❌ Job failed:', statusData.error);
            break;
          }
        }
        
        if (!completed) {
          console.log('⏱️  Job timed out (still running after 5 minutes)');
        }
        
      } catch (error) {
        console.log('❌ Error:', error.response?.data || error.message);
      }
      
      // Clean up
      fs.unlinkSync(testFile);
      
      // Wait between tests
      if (test !== testCases[testCases.length - 1]) {
        console.log('\nWaiting 10 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log('\n\n=== Test Summary ===');
    console.log('Expected behavior:');
    console.log('- Files with ≤50 items should process synchronously (fast, no 90% delay)');
    console.log('- Files with >50 items use the job queue (may have some delay at 90%)');
    console.log('- Lambda optimization prevents the 90% stuck issue for small files');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

console.log('Lambda Optimization Test');
console.log('Testing fix for 90% progress issue\n');
testLambdaOptimization();