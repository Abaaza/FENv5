// Test specifically against the production Lambda server
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// PRODUCTION SERVER URL - AWS Lambda
const PRODUCTION_API = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

// Test credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

async function testProductionServer() {
  console.log('=== Testing PRODUCTION Lambda Server ===');
  console.log(`Server: ${PRODUCTION_API}`);
  console.log('Time:', new Date().toLocaleString());
  console.log('');

  try {
    // 1. Verify we're hitting the production server
    console.log('1. Verifying production server...');
    const healthResponse = await axios.get(`${PRODUCTION_API}/health`);
    console.log('✅ Server is responding');
    console.log('   Timestamp:', healthResponse.data.timestamp);
    
    // Check API health too
    const apiHealthResponse = await axios.get(`${PRODUCTION_API}/api/health`);
    console.log('✅ API health check passed');
    console.log('   Service:', apiHealthResponse.data.service);
    console.log('   Version:', apiHealthResponse.data.version);

    // 2. Login
    console.log('\n2. Testing authentication...');
    const loginResponse = await axios.post(`${PRODUCTION_API}/api/auth/login`, TEST_USER);
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful');
    console.log('   User:', loginResponse.data.user.email);
    console.log('   Token:', token.substring(0, 30) + '...');

    // 3. Create test file
    console.log('\n3. Creating test Excel file...');
    const testFile = path.join(__dirname, 'production-test.xlsx');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ');
    
    // Add headers
    worksheet.addRow(['Item No', 'Description', 'Unit', 'Quantity', 'Rate', 'Amount']);
    
    // Add 25 test rows
    for (let i = 1; i <= 25; i++) {
      const qty = Math.floor(Math.random() * 100) + 1;
      const rate = Math.floor(Math.random() * 1000) + 100;
      worksheet.addRow([
        `1.${i}`,
        `Construction work item ${i} - Testing on production server`,
        ['m³', 'm²', 'kg', 'nos', 'L'][i % 5],
        qty,
        rate,
        qty * rate
      ]);
    }
    
    await workbook.xlsx.writeFile(testFile);
    const fileSize = fs.statSync(testFile).size;
    console.log('✅ File created');
    console.log('   Size:', (fileSize / 1024).toFixed(2), 'KB');
    console.log('   Rows:', 25);

    // 4. Upload to production server
    console.log('\n4. Uploading to production Lambda...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    form.append('projectName', 'Production Server Test');
    form.append('method', 'LOCAL');
    
    const uploadStart = Date.now();
    
    try {
      const uploadResponse = await axios.post(
        `${PRODUCTION_API}/api/price-matching/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          timeout: 120000, // 2 minutes
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\r   Upload progress: ${percentCompleted}%`);
          }
        }
      );
      
      const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(2);
      console.log('\n✅ Upload successful!');
      console.log('   Time:', uploadTime, 'seconds');
      console.log('   Job ID:', uploadResponse.data.jobId);
      console.log('   Items:', uploadResponse.data.itemCount);
      
      // 5. Monitor job on production server
      console.log('\n5. Monitoring job progress on Lambda...');
      const jobId = uploadResponse.data.jobId;
      let attempts = 0;
      let lastProgress = -1;
      let stuckCount = 0;
      
      while (attempts < 60) { // 5 minutes max
        try {
          const statusResponse = await axios.get(
            `${PRODUCTION_API}/api/price-matching/${jobId}/status`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          const job = statusResponse.data;
          
          // Check if progress changed
          if (job.progress === lastProgress) {
            stuckCount++;
          } else {
            stuckCount = 0;
            lastProgress = job.progress;
          }
          
          // Update status line
          const timestamp = new Date().toLocaleTimeString();
          process.stdout.write(`\r   [${timestamp}] Status: ${job.status} | Progress: ${job.progress}% | ${job.progressMessage || 'Processing...'}${' '.repeat(20)}`);
          
          // Warn if stuck
          if (job.progress === 90 && stuckCount > 3) {
            console.log('\n   ⚠️  Progress stuck at 90% - Lambda might be having issues saving to database');
          }
          
          if (job.status === 'completed') {
            console.log('\n✅ Job completed on Lambda!');
            console.log('   Total items:', job.totalCount || job.itemCount);
            console.log('   Matched:', job.matchedCount || 0);
            console.log('   Success rate:', job.matchRate || 'N/A');
            
            // Get results
            console.log('\n6. Fetching results from Lambda...');
            try {
              const resultsResponse = await axios.get(
                `${PRODUCTION_API}/api/price-matching/${jobId}/results`,
                { headers: { 'Authorization': `Bearer ${token}` } }
              );
              console.log('✅ Results retrieved');
              console.log('   Total results:', resultsResponse.data.results?.length || 0);
            } catch (e) {
              console.log('❌ Could not fetch results:', e.response?.data || e.message);
            }
            
            break;
          } else if (job.status === 'failed') {
            console.log('\n❌ Job failed on Lambda:', job.error || 'Unknown error');
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          attempts++;
        } catch (error) {
          console.log('\n❌ Error checking status:', error.response?.data || error.message);
          break;
        }
      }
      
      if (attempts >= 60) {
        console.log('\n⏱️  Timeout - Lambda job taking too long (might be stuck at 90%)');
      }
      
    } catch (uploadError) {
      console.log('\n❌ Upload to Lambda failed!');
      console.log('   Status:', uploadError.response?.status);
      console.log('   Error:', uploadError.response?.data);
      
      if (uploadError.response?.status === 500) {
        console.log('\n💡 500 errors usually mean:');
        console.log('   - Database connection issues');
        console.log('   - Missing environment variables');
        console.log('   - Code errors in job creation');
        console.log('   Check Lambda logs for details');
      }
    }
    
    // Clean up
    fs.unlinkSync(testFile);
    console.log('\n✅ Test file cleaned up');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
  
  console.log('\n=== Production Server Test Complete ===');
  console.log('Server tested:', PRODUCTION_API);
  console.log('Environment: AWS Lambda (Production)');
}

// Run the test
console.log('');
testProductionServer();