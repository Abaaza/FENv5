const axios = require('axios');

const baseUrl = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testLogin() {
  try {
    console.log('Testing login to:', baseUrl);
    const response = await axios.post(`${baseUrl}/api/auth/login`, {
      email: 'abaza@mjd.com',
      password: 'abaza123'
    });
    
    console.log('Login successful!');
    console.log('User:', response.data.user);
    console.log('Access Token:', response.data.accessToken.substring(0, 50) + '...');
    
    // Test authenticated endpoint
    const meResponse = await axios.get(`${baseUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${response.data.accessToken}`
      }
    });
    
    console.log('\nAuthenticated user data:');
    console.log(meResponse.data);
    
  } catch (error) {
    console.error('Login failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testLogin();