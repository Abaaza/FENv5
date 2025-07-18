const axios = require('axios');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User'
};

async function setupTestUser() {
  console.log('\n=== Setting up test user ===\n');
  
  try {
    // Try to login first
    console.log('Checking if user exists...');
    try {
      const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      console.log('✓ Test user already exists and can login');
      console.log('Access token:', loginResponse.data.accessToken.substring(0, 30) + '...');
      return;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('User not found or wrong password, creating new user...');
      } else {
        throw error;
      }
    }
    
    // Register new user
    console.log('\nRegistering new test user...');
    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, TEST_USER);
    
    console.log('✓ Test user created successfully!');
    console.log('User ID:', registerResponse.data.user.id);
    console.log('Email:', registerResponse.data.user.email);
    console.log('Access token:', registerResponse.data.accessToken.substring(0, 30) + '...');
    
  } catch (error) {
    console.error('Setup failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

setupTestUser();