const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test data
const csvContent = `Description,Quantity,Unit
Test Item 1,10,EA
Test Item 2,20,M
Test Item 3,30,KG`;

const testFile = 'test-upload.csv';
fs.writeFileSync(testFile, csvContent);

async function testUpload() {
  try {
    // First login
    console.log('Logging in...');
    const loginResponse = await fetch('https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'abaza@mjd.com',
        password: 'abaza123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.accessToken) {
      console.error('Failed to get access token');
      return;
    }
    
    // Test upload
    console.log('\nTesting CSV upload...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile), {
      filename: testFile,
      contentType: 'text/csv'
    });
    form.append('method', 'LOCAL');
    
    const uploadResponse = await fetch('https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/price-matching/upload-and-match', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginData.accessToken}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    console.log('Upload status:', uploadResponse.status);
    const uploadText = await uploadResponse.text();
    console.log('Upload response:', uploadText);
    
    try {
      const uploadData = JSON.parse(uploadText);
      console.log('Parsed response:', uploadData);
    } catch (e) {
      console.log('Could not parse as JSON');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  }
}

testUpload();