const axios = require('axios');

const baseUrl = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';
let accessToken = '';
let refreshToken = '';
let testUserId = '';

// Test credentials
const testUser = {
  email: 'test@example.com',
  password: 'Test123!@#',
  name: 'Test User'
};

const adminUser = {
  email: 'abaza@mjd.com',
  password: 'abaza123'
};

async function testEndpoint(name, method, path, data = null, headers = {}, skipAuth = false) {
  console.log(`\n--- Testing: ${name} ---`);
  console.log(`Method: ${method}`);
  console.log(`Path: ${path}`);
  
  try {
    const config = {
      method,
      url: `${baseUrl}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (!skipAuth && accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    if (data && method !== 'GET') {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2).slice(0, 200));
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(`Error Status: ${error.response.status}`);
      console.log(`Error:`, error.response.data);
    } else {
      console.log(`Error:`, error.message);
    }
    return null;
  }
}

async function runTests() {
  console.log('=== Testing BOQ Matching System API ===\n');
  
  // 1. Health Check
  console.log('\n=== 1. Health Check ===');
  await testEndpoint('Health Check', 'GET', '/health', null, {}, true);
  await testEndpoint('API Health Check', 'GET', '/api/health', null, {}, true);
  await testEndpoint('Detailed Health Check', 'GET', '/api/health/detailed', null, {}, true);
  
  // 2. Authentication
  console.log('\n=== 2. Authentication ===');
  
  // Try to register (might fail if user exists)
  await testEndpoint('Register', 'POST', '/api/auth/register', testUser, {}, true);
  
  // Login with admin user
  const loginResponse = await testEndpoint('Login', 'POST', '/api/auth/login', {
    email: adminUser.email,
    password: adminUser.password
  }, {}, true);
  
  if (loginResponse) {
    accessToken = loginResponse.accessToken;
    refreshToken = loginResponse.refreshToken;
    testUserId = loginResponse.user.id;
  }
  
  // Test authenticated endpoints
  await testEndpoint('Get Current User', 'GET', '/api/auth/me');
  await testEndpoint('Update Profile', 'PUT', '/api/auth/profile', { name: 'Updated Admin' });
  await testEndpoint('Refresh Token', 'POST', '/api/auth/refresh', { refreshToken });
  
  // 3. Dashboard
  console.log('\n=== 3. Dashboard ===');
  await testEndpoint('Dashboard Stats', 'GET', '/api/dashboard/stats');
  await testEndpoint('Recent Activity', 'GET', '/api/dashboard/activity');
  await testEndpoint('Recent Jobs', 'GET', '/api/dashboard/recent-jobs');
  await testEndpoint('System Health', 'GET', '/api/dashboard/system-health');
  await testEndpoint('Activity Summary', 'GET', '/api/dashboard/activity-summary?period=week');
  await testEndpoint('Activity Stats', 'GET', '/api/dashboard/activity-stats');
  
  // 4. Price List
  console.log('\n=== 4. Price List ===');
  await testEndpoint('Get Price List', 'GET', '/api/price-list?page=1&limit=10');
  await testEndpoint('Price List Stats', 'GET', '/api/price-list/stats');
  await testEndpoint('Search Price Items', 'POST', '/api/price-list/search', { query: 'cable' });
  await testEndpoint('Export Price List', 'GET', '/api/price-list/export');
  
  // 5. Clients
  console.log('\n=== 5. Clients ===');
  await testEndpoint('Get Clients', 'GET', '/api/clients');
  await testEndpoint('Get Active Clients', 'GET', '/api/clients/active');
  const clientResponse = await testEndpoint('Create Client', 'POST', '/api/clients', {
    name: 'Test Client',
    contact: 'test@client.com',
    phone: '1234567890'
  });
  
  // 6. Jobs
  console.log('\n=== 6. Jobs ===');
  await testEndpoint('Get User Jobs', 'GET', '/api/price-matching/jobs');
  await testEndpoint('Get All Jobs', 'GET', '/api/price-matching/all-jobs');
  
  // 7. Price Matching
  console.log('\n=== 7. Price Matching ===');
  await testEndpoint('Processor Status', 'GET', '/api/price-matching/processor/status');
  await testEndpoint('Get Matching Methods', 'GET', '/api/price-matching/matching-methods');
  await testEndpoint('Test Local Match', 'POST', '/api/price-matching/test/local', {
    description: '2.5mm cable',
    clientId: 'test-client'
  });
  
  // 8. Projects
  console.log('\n=== 8. Projects ===');
  await testEndpoint('Get Projects', 'GET', '/api/projects');
  await testEndpoint('Create Project', 'POST', '/api/projects', {
    name: 'Test Project',
    clientId: clientResponse?._id || 'test-client',
    description: 'Test project description'
  });
  
  // 9. Admin endpoints
  console.log('\n=== 9. Admin ===');
  await testEndpoint('Get All Users (Admin)', 'GET', '/api/admin/users');
  await testEndpoint('Get Settings (Admin)', 'GET', '/api/admin/settings');
  await testEndpoint('System Stats (Admin)', 'GET', '/api/admin/system/stats');
  await testEndpoint('Update Setting (Admin)', 'POST', '/api/admin/settings', {
    key: 'currency',
    value: { currency: 'GBP', symbol: '£' }
  });
  
  // 10. Price List Admin
  console.log('\n=== 10. Price List Admin ===');
  await testEndpoint('Create Price Item (Admin)', 'POST', '/api/price-list', {
    code: 'TEST001',
    description: 'Test Cable Item',
    unit: 'm',
    rate: 10.50,
    category: 'Cables'
  });
  
  // 11. Cleanup
  console.log('\n=== 11. Cleanup Operations ===');
  await testEndpoint('Logout', 'POST', '/api/auth/logout');
  
  console.log('\n=== Testing Complete ===\n');
  console.log('Note: File upload endpoints require multipart/form-data and are not tested in this script:');
  console.log('- POST /api/price-matching/upload');
  console.log('- POST /api/price-matching/upload-and-match');
  console.log('- POST /api/projects/upload');
  console.log('- POST /api/projects/upload-and-match');
  console.log('- POST /api/jobs/upload');
  console.log('- POST /api/price-list/import');
  console.log('\nTo test file uploads, use curl or a tool like Postman.');
}

runTests().catch(console.error);