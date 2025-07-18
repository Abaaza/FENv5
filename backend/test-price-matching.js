const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const API_URL = process.env.API_URL || 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';
const LOCAL_API_URL = 'http://localhost:5000';

// Test credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testPriceMatching(useLocal = false) {
  const baseUrl = useLocal ? LOCAL_API_URL : API_URL;
  log(`\\nTesting Price Matching on ${baseUrl}`, 'blue');
  
  let authToken = '';
  
  try {
    // 1. Test health endpoint
    log('\\n1. Testing health endpoint...', 'yellow');
    try {
      const healthResponse = await axios.get(`${baseUrl}/api/health`);
      log(`✓ Health check passed: ${healthResponse.data.status}`, 'green');
    } catch (error) {
      log(`✗ Health check failed: ${error.response?.status} ${error.response?.statusText}`, 'red');
      if (!useLocal) {
        log('Lambda may not be properly deployed. Try running locally with: node test-price-matching.js --local', 'yellow');
        return;
      }
    }
    
    // 2. Login to get auth token
    log('\\n2. Testing authentication...', 'yellow');
    try {
      const loginResponse = await axios.post(`${baseUrl}/api/auth/login`, TEST_USER);
      authToken = loginResponse.data.accessToken;
      log(`✓ Login successful. Token received: ${authToken.substring(0, 20)}...`, 'green');
    } catch (error) {
      if (error.response?.status === 404) {
        log('✗ Auth endpoint not found. Creating test user...', 'yellow');
        
        // Try to register first
        try {
          const registerResponse = await axios.post(`${baseUrl}/api/auth/register`, {
            ...TEST_USER,
            name: 'Test User'
          });
          authToken = registerResponse.data.accessToken;
          log(`✓ Registration successful. Token received: ${authToken.substring(0, 20)}...`, 'green');
        } catch (regError) {
          log(`✗ Registration failed: ${regError.response?.data?.message || regError.message}`, 'red');
          return;
        }
      } else {
        log(`✗ Login failed: ${error.response?.data?.message || error.message}`, 'red');
        return;
      }
    }
    
    // 3. Create test Excel file
    log('\\n3. Creating test Excel file...', 'yellow');
    const testFilePath = path.join(__dirname, 'test-boq.xlsx');
    
    // Check if we have exceljs available
    try {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('BOQ');
      
      // Add headers
      worksheet.addRow(['Item', 'Description', 'Quantity', 'Unit']);
      
      // Add test data
      worksheet.addRow(['1', 'Concrete C25/30', '100', 'm3']);
      worksheet.addRow(['2', 'Steel Reinforcement 12mm', '5000', 'kg']);
      worksheet.addRow(['3', 'Cement 50kg bags', '200', 'bags']);
      worksheet.addRow(['4', 'Sand for concrete', '50', 'm3']);
      worksheet.addRow(['5', 'Aggregate 20mm', '75', 'm3']);
      
      await workbook.xlsx.writeFile(testFilePath);
      log('✓ Test Excel file created', 'green');
    } catch (error) {
      log('✗ Could not create Excel file. Using existing test file...', 'yellow');
      
      // Check if test file exists
      if (!fs.existsSync(testFilePath)) {
        log('✗ No test file available. Please create test-boq.xlsx manually', 'red');
        return;
      }
    }
    
    // 4. Upload file for matching
    log('\\n4. Uploading file for price matching...', 'yellow');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('clientId', 'test-client');
    form.append('matchingMethod', 'LOCAL');
    
    try {
      const uploadResponse = await axios.post(
        `${baseUrl}/api/price-matching/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${authToken}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000 // 60 seconds timeout
        }
      );
      
      const jobId = uploadResponse.data.jobId;
      log(`✓ File uploaded successfully. Job ID: ${jobId}`, 'green');
      
      // 5. Poll for job status
      log('\\n5. Checking job status...', 'yellow');
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes with 10 second intervals
      
      while (attempts < maxAttempts) {
        try {
          const statusResponse = await axios.get(
            `${baseUrl}/api/price-matching/job-status/${jobId}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          );
          
          const job = statusResponse.data;
          log(`Job status: ${job.status} (${job.progress}% complete)`, 'blue');
          
          if (job.status === 'completed') {
            log('\\n✓ Price matching completed successfully!', 'green');
            log(`Total rows: ${job.totalRows}`, 'green');
            log(`Matched rows: ${job.matchedRows}`, 'green');
            log(`Match rate: ${((job.matchedRows / job.totalRows) * 100).toFixed(2)}%`, 'green');
            
            // 6. Get results
            log('\\n6. Fetching match results...', 'yellow');
            const resultsResponse = await axios.get(
              `${baseUrl}/api/price-matching/results/${jobId}`,
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`
                }
              }
            );
            
            log('\\nSample results:', 'blue');
            resultsResponse.data.results.slice(0, 3).forEach((result, index) => {
              log(`\\nRow ${index + 1}:`, 'yellow');
              log(`  Original: ${result.originalDescription}`, 'reset');
              log(`  Matched: ${result.matchedItem?.name || 'No match'}`, 'reset');
              log(`  Confidence: ${result.confidence || 0}%`, 'reset');
              if (result.matchedItem?.unit_price) {
                log(`  Price: $${result.matchedItem.unit_price}`, 'reset');
              }
            });
            
            break;
          } else if (job.status === 'failed') {
            log(`\\n✗ Job failed: ${job.error}`, 'red');
            break;
          }
          
          // Wait 10 seconds before next check
          await new Promise(resolve => setTimeout(resolve, 10000));
          attempts++;
          
        } catch (error) {
          log(`✗ Error checking job status: ${error.response?.data?.message || error.message}`, 'red');
          break;
        }
      }
      
      if (attempts >= maxAttempts) {
        log('\\n✗ Timeout waiting for job completion', 'red');
      }
      
    } catch (error) {
      log(`✗ Upload failed: ${error.response?.data?.message || error.message}`, 'red');
      if (error.response?.status === 413) {
        log('File too large. Try a smaller test file.', 'yellow');
      }
    }
    
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      log('\\n✓ Test file cleaned up', 'green');
    }
    
  } catch (error) {
    log(`\\n✗ Test failed: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run test
const args = process.argv.slice(2);
const useLocal = args.includes('--local');

testPriceMatching(useLocal).then(() => {
  log('\\n=== Test completed ===\\n', 'blue');
}).catch(error => {
  log(`\\n✗ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});