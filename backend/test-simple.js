const axios = require('axios');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testAPI() {
  console.log('Testing API endpoints...\n');
  
  // Test health
  console.log('1. Testing /health endpoint:');
  try {
    const response = await axios.get(`${API_URL}/health`);
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('✗ Error:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test API health
  console.log('\n2. Testing /api/health endpoint:');
  try {
    const response = await axios.get(`${API_URL}/api/health`);
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('✗ Error:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test root
  console.log('\n3. Testing / endpoint:');
  try {
    const response = await axios.get(`${API_URL}/`);
    console.log('✓ Status:', response.status);
    console.log('✓ Response:', response.data.substring(0, 100) + '...');
  } catch (error) {
    console.log('✗ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testAPI();