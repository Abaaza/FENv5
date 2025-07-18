// Test with default/common credentials
const axios = require('axios');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

const credentials = [
  { email: 'test@example.com', password: 'password123' },
  { email: 'test@example.com', password: 'test123' },
  { email: 'test@example.com', password: 'Password123!' },
  { email: 'admin@example.com', password: 'admin123' },
  { email: 'demo@example.com', password: 'demo123' },
];

async function tryLogin(creds) {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, creds);
    console.log(`✅ Success with ${creds.email} / ${creds.password}`);
    console.log('Token:', response.data.accessToken.substring(0, 30) + '...');
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(`❌ Failed: ${creds.email} / ${creds.password}`);
    } else {
      console.log(`⚠️  Error: ${error.response?.status} - ${error.message}`);
    }
    return false;
  }
}

async function findWorkingLogin() {
  console.log('Testing common credentials...\n');
  
  for (const creds of credentials) {
    const success = await tryLogin(creds);
    if (success) {
      console.log('\nUse these credentials for testing!');
      break;
    }
    // Small delay to avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

findWorkingLogin();