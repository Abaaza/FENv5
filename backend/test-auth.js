const axios = require('axios');

// Test authentication locally
async function testAuth() {
  const url = 'http://localhost:5000/api/auth/login';
  const data = {
    email: 'abaza@mjd.com',
    password: 'abaza123'
  };

  console.log('Testing authentication...');
  console.log('URL:', url);
  console.log('Data:', data);

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Success!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.error('Error!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test with curl command
console.log('\nEquivalent curl command:');
console.log(`curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"abaza@mjd.com","password":"abaza123"}'`);

// Test Lambda endpoint
async function testLambda() {
  const lambdaUrl = process.env.LAMBDA_URL;
  if (!lambdaUrl) {
    console.log('\nSet LAMBDA_URL environment variable to test Lambda endpoint');
    return;
  }

  console.log('\n\nTesting Lambda endpoint...');
  console.log('URL:', lambdaUrl + '/api/auth/login');

  try {
    const response = await axios.post(lambdaUrl + '/api/auth/login', {
      email: 'abaza@mjd.com',
      password: 'abaza123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Success!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.error('Error!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run tests
testAuth().then(() => {
  if (process.env.LAMBDA_URL) {
    return testLambda();
  }
}).catch(console.error);