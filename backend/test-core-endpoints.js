const axios = require('axios');

const baseUrl = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';
let accessToken = '';

async function testEndpoint(name, method, path, data = null, skipAuth = false) {
  console.log(`\nTesting: ${name}`);
  try {
    const config = {
      method,
      url: `${baseUrl}${path}`,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (!skipAuth && accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    if (data && method !== 'GET') {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✓ Success (${response.status})`);
    return response.data;
  } catch (error) {
    console.log(`✗ Failed: ${error.response?.status || error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('=== Core API Endpoints Test ===\n');
  
  // 1. Health checks
  console.log('1. HEALTH CHECKS');
  await testEndpoint('Health', 'GET', '/health', null, true);
  await testEndpoint('API Health', 'GET', '/api/health', null, true);
  
  // 2. Login
  console.log('\n2. AUTHENTICATION');
  const loginData = await testEndpoint('Login', 'POST', '/api/auth/login', {
    email: 'abaza@mjd.com',
    password: 'abaza123'
  }, true);
  
  if (loginData) {
    accessToken = loginData.accessToken;
    console.log(`  Token: ${accessToken.substring(0, 30)}...`);
  }
  
  await testEndpoint('Get Current User', 'GET', '/api/auth/me');
  
  // 3. Core endpoints
  console.log('\n3. CORE ENDPOINTS');
  await testEndpoint('Dashboard Stats', 'GET', '/api/dashboard/stats');
  await testEndpoint('Price List (first 5)', 'GET', '/api/price-list?limit=5');
  await testEndpoint('Clients', 'GET', '/api/clients');
  await testEndpoint('Jobs', 'GET', '/api/price-matching/jobs');
  await testEndpoint('Matching Methods', 'GET', '/api/price-matching/matching-methods');
  
  // 4. Test a search
  console.log('\n4. SEARCH TEST');
  await testEndpoint('Search Price Items', 'POST', '/api/price-list/search', { 
    query: 'cable',
    limit: 3 
  });
  
  // 5. Test local matching
  console.log('\n5. MATCHING TEST');
  await testEndpoint('Test Local Match', 'POST', '/api/price-matching/test/local', {
    description: '2.5mm twin and earth cable',
    clientId: 'test-client'
  });
  
  console.log('\n=== Test Complete ===');
}

runTests().catch(console.error);