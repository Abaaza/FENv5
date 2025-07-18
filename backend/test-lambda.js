// Simple test script for Lambda endpoint
const https = require('https');

const url = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com/health';

console.log('Testing Lambda endpoint:', url);

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);
  });
}).on('error', (err) => {
  console.error('Error:', err);
});