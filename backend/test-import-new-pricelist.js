const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// API Configuration
const API_URL = 'http://localhost:5000';
const EMAIL = 'abaza@tfp.com';
const PASSWORD = 'abaza123';

// File to import
const PRICELIST_FILE = 'C:\\Users\\abaza\\Downloads\\asdasdasdasfddfdfd.xlsx';

async function login() {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    console.log('✓ Login successful');
    return response.data.accessToken;
  } catch (error) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function importPriceList(token) {
  try {
    const form = new FormData();
    const fileStream = fs.createReadStream(PRICELIST_FILE);
    form.append('file', fileStream, path.basename(PRICELIST_FILE));

    const response = await axios.post(`${API_URL}/api/price-list/import`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✓ Import started:', response.data);
    return response.data.jobId;
  } catch (error) {
    console.error('✗ Import failed:', error.response?.data || error.message);
    throw error;
  }
}

async function checkImportStatus(token, jobId) {
  try {
    const response = await axios.get(`${API_URL}/api/price-list/import/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('✗ Status check failed:', error.response?.data || error.message);
    throw error;
  }
}

async function waitForImport(token, jobId) {
  console.log('Monitoring import progress...');
  
  while (true) {
    const status = await checkImportStatus(token, jobId);
    
    console.log(`Progress: ${status.progress}% - ${status.progressMessage || 'Processing...'}`);
    
    if (status.status === 'completed') {
      console.log('✓ Import completed!');
      if (status.results) {
        console.log(`  Created: ${status.results.created}`);
        console.log(`  Updated: ${status.results.updated}`);
        console.log(`  Skipped: ${status.results.skipped}`);
        if (status.results.errors && status.results.errors.length > 0) {
          console.log(`  Errors: ${status.results.errors.length}`);
          status.results.errors.forEach(err => console.log(`    - ${err}`));
        }
      }
      break;
    } else if (status.status === 'failed') {
      console.error('✗ Import failed:', status.error);
      break;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function main() {
  try {
    console.log('Starting price list import...');
    console.log(`File: ${PRICELIST_FILE}`);
    
    // Check if file exists
    if (!fs.existsSync(PRICELIST_FILE)) {
      throw new Error(`File not found: ${PRICELIST_FILE}`);
    }
    
    // Login
    const token = await login();
    
    // Start import
    const jobId = await importPriceList(token);
    
    // Wait for completion
    await waitForImport(token, jobId);
    
    console.log('\nImport process completed!');
  } catch (error) {
    console.error('\nImport failed:', error.message);
    process.exit(1);
  }
}

// Run the import
main();