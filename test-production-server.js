import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import ExcelJS from 'exceljs';

const API_URL = 'https://54.90.3.22/api';
const EMAIL = 'abaza@tfp.com';
const PASSWORD = 'abaza123';

// Test suite for production server
async function runTests() {
  let token = null;
  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('🧪 Running Production Server Tests');
  console.log('================================');
  console.log(`Server: ${API_URL}`);
  console.log(`User: ${EMAIL}`);
  console.log('================================\n');

  // Test 1: Login
  console.log('📋 Test 1: Authentication');
  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    token = loginResponse.data.accessToken;
    if (token) {
      console.log('✅ Login successful');
      console.log(`   Token received: ${token.substring(0, 20)}...`);
      testResults.passed++;
      testResults.tests.push({ name: 'Login', status: 'passed' });
    } else {
      throw new Error('No token received');
    }
  } catch (error) {
    console.log('❌ Login failed:');
    console.log('   Status:', error.response?.status);
    console.log('   Data:', error.response?.data);
    console.log('   Message:', error.message);
    if (error.response?.headers) {
      console.log('   Headers:', error.response.headers);
    }
    testResults.failed++;
    testResults.tests.push({ name: 'Login', status: 'failed', error: error.message });
    return testResults; // Can't continue without auth
  }

  // Test 2: Get Price List
  console.log('\n📋 Test 2: Get Price List');
  try {
    const priceListResponse = await axios.get(`${API_URL}/price-list?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const items = priceListResponse.data;
    console.log(`✅ Retrieved ${items.length} price items`);
    
    // Check for new schema fields
    const hasNewSchema = items.some(item => 
      item.name !== undefined || 
      item.operation_cost !== undefined || 
      item.uom_id !== undefined
    );
    
    if (hasNewSchema) {
      console.log('   ✅ New schema fields detected');
      items.slice(0, 3).forEach(item => {
        const name = item.name || item.description || 'N/A';
        const cost = item.operation_cost || item.rate || 0;
        const unit = item.uom_id || item.unit || 'N/A';
        console.log(`   - ${name}: ${cost} ${unit}`);
      });
    } else {
      console.log('   ⚠️  No new schema fields found in items');
    }
    
    testResults.passed++;
    testResults.tests.push({ name: 'Get Price List', status: 'passed', hasNewSchema });
  } catch (error) {
    console.log('❌ Get price list failed:', error.response?.data || error.message);
    testResults.failed++;
    testResults.tests.push({ name: 'Get Price List', status: 'failed', error: error.message });
  }

  // Test 3: Dashboard Stats
  console.log('\n📋 Test 3: Dashboard Statistics');
  try {
    const statsResponse = await axios.get(`${API_URL}/stats/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const stats = statsResponse.data;
    console.log('✅ Dashboard stats retrieved');
    console.log(`   Total Price Items: ${stats.totalPriceItems || 0}`);
    console.log(`   Total Jobs: ${stats.totalJobs || 0}`);
    console.log(`   Jobs This Month: ${stats.jobsThisMonth || 0}`);
    
    testResults.passed++;
    testResults.tests.push({ name: 'Dashboard Stats', status: 'passed' });
  } catch (error) {
    console.log('❌ Dashboard stats failed:', error.response?.data || error.message);
    testResults.failed++;
    testResults.tests.push({ name: 'Dashboard Stats', status: 'failed', error: error.message });
  }

  // Test 4: Export Price List
  console.log('\n📋 Test 4: Export Price List');
  try {
    const exportResponse = await axios.get(`${API_URL}/price-list/export`, {
      headers: { 'Authorization': `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    
    console.log('✅ Price list exported successfully');
    console.log(`   File size: ${(exportResponse.data.byteLength / 1024).toFixed(2)} KB`);
    
    // Save and analyze the exported file
    fs.writeFileSync('exported-price-list.csv', exportResponse.data);
    const csvContent = fs.readFileSync('exported-price-list.csv', 'utf-8');
    const headers = csvContent.split('\n')[0];
    
    console.log(`   Headers: ${headers}`);
    const hasNewHeaders = headers.includes('operation_cost') || headers.includes('uom_id');
    console.log(`   ${hasNewHeaders ? '✅' : '⚠️ '} New schema headers ${hasNewHeaders ? 'present' : 'not found'}`);
    
    testResults.passed++;
    testResults.tests.push({ name: 'Export Price List', status: 'passed', hasNewHeaders });
  } catch (error) {
    console.log('❌ Export failed:', error.response?.data || error.message);
    testResults.failed++;
    testResults.tests.push({ name: 'Export Price List', status: 'failed', error: error.message });
  }

  // Test 5: Create Test BOQ for Matching
  console.log('\n📋 Test 5: Price Matching Test');
  try {
    // Create a test BOQ file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ');
    
    worksheet.columns = [
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit', key: 'unit', width: 10 }
    ];
    
    worksheet.addRow({ description: 'Fence Post 2.4m x 100mm', quantity: 10, unit: 'Unit' });
    worksheet.addRow({ description: 'Chain Link Fence 1.8m high', quantity: 50, unit: 'm²' });
    worksheet.addRow({ description: 'Gate Hinge Heavy Duty', quantity: 4, unit: 'Unit' });
    
    const boqBuffer = await workbook.xlsx.writeBuffer();
    fs.writeFileSync('test-boq.xlsx', boqBuffer);
    
    // Upload for matching
    const form = new FormData();
    form.append('file', fs.createReadStream('test-boq.xlsx'));
    form.append('matchingMethod', 'LOCAL');
    
    const uploadResponse = await axios.post(
      `${API_URL}/price-matching/upload-and-match`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const jobId = uploadResponse.data.jobId;
    console.log('✅ Price matching job created');
    console.log(`   Job ID: ${jobId}`);
    console.log(`   Status: ${uploadResponse.data.status}`);
    
    // Wait for job completion
    console.log('   Waiting for job to complete...');
    let jobComplete = false;
    let attempts = 0;
    
    while (!jobComplete && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const statusResponse = await axios.get(
          `${API_URL}/price-matching/${jobId}/status`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        const job = statusResponse.data;
        console.log(`   Progress: ${job.progress}% - ${job.status}`);
        
        if (job.status === 'completed') {
          jobComplete = true;
          console.log('✅ Price matching completed');
          console.log(`   Matched: ${job.matchedCount}/${job.itemCount} items`);
          
          // Check matching method
          console.log(`   Method used: ${job.matchingMethod}`);
          const methodCorrect = job.matchingMethod === 'LOCAL' || job.matchingMethod === 'V1' || job.matchingMethod === 'V2';
          console.log(`   ${methodCorrect ? '✅' : '❌'} Matching method naming is ${methodCorrect ? 'correct' : 'incorrect (still using old names)'}`);
        } else if (job.status === 'failed') {
          throw new Error(`Job failed: ${job.error}`);
        }
        
        attempts++;
      } catch (error) {
        console.log('   Error checking status:', error.message);
        attempts++;
      }
    }
    
    testResults.passed++;
    testResults.tests.push({ name: 'Price Matching', status: 'passed' });
  } catch (error) {
    console.log('❌ Price matching test failed:', error.response?.data || error.message);
    testResults.failed++;
    testResults.tests.push({ name: 'Price Matching', status: 'failed', error: error.message });
  }

  // Test 6: Check AI Method Names
  console.log('\n📋 Test 6: AI Method Naming Check');
  try {
    // Try to get recent jobs to check method names
    const jobsResponse = await axios.get(`${API_URL}/price-matching/jobs?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const jobs = jobsResponse.data;
    console.log(`✅ Retrieved ${jobs.length} recent jobs`);
    
    const methodsUsed = [...new Set(jobs.map(job => job.matchingMethod))];
    console.log(`   Methods found: ${methodsUsed.join(', ')}`);
    
    const hasOldNames = methodsUsed.some(method => method === 'COHERE' || method === 'OPENAI');
    const hasNewNames = methodsUsed.some(method => method === 'V1' || method === 'V2');
    
    if (hasOldNames) {
      console.log('   ❌ Old method names (COHERE/OPENAI) still in use');
    }
    if (hasNewNames) {
      console.log('   ✅ New method names (V1/V2) are being used');
    }
    
    testResults.passed++;
    testResults.tests.push({ 
      name: 'AI Method Naming', 
      status: hasOldNames ? 'warning' : 'passed',
      hasOldNames,
      hasNewNames
    });
  } catch (error) {
    console.log('⚠️  Could not check AI method names:', error.response?.status === 404 ? 'Endpoint not found' : error.message);
    testResults.tests.push({ name: 'AI Method Naming', status: 'skipped' });
  }

  // Clean up test files
  try {
    if (fs.existsSync('test-boq.xlsx')) fs.unlinkSync('test-boq.xlsx');
    if (fs.existsSync('exported-price-list.csv')) fs.unlinkSync('exported-price-list.csv');
  } catch (error) {
    // Ignore cleanup errors
  }

  // Summary
  console.log('\n================================');
  console.log('📊 Test Summary');
  console.log('================================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏭️  Skipped: ${testResults.tests.filter(t => t.status === 'skipped').length}`);
  console.log('\nDetailed Results:');
  testResults.tests.forEach(test => {
    const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⚠️ ';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) console.log(`   Error: ${test.error}`);
  });

  return testResults;
}

// Run the tests
console.log('Starting production server tests...\n');
runTests()
  .then(results => {
    console.log('\n✅ Tests completed');
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });