import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// Import the actual Excel file
async function importActualFile() {
  const API_URL = 'http://localhost:5000';
  const EMAIL = 'abaza@tfp.com';
  const PASSWORD = 'abaza123';
  const EXCEL_FILE_PATH = 'C:\\Users\\abaza\\Downloads\\asdasdasdasfddfdfd.xlsx';
  
  try {
    // Check if file exists
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.error('❌ Excel file not found at:', EXCEL_FILE_PATH);
      return;
    }
    
    console.log('✓ Found Excel file:', EXCEL_FILE_PATH);
    const stats = fs.statSync(EXCEL_FILE_PATH);
    console.log(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Login
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    const token = loginResponse.data.accessToken;
    console.log('✓ Login successful');
    
    // First, deactivate all existing items to replace the price list
    console.log('\n2. Deactivating existing price list...');
    try {
      const deactivateResponse = await axios.post(
        `${API_URL}/api/price-list/deactivate-all`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      console.log('✓ Deactivated existing items:', deactivateResponse.data);
    } catch (error) {
      console.log('ℹ️  Deactivation endpoint not available or failed:', error.response?.data?.message || error.message);
    }
    
    // Import the file
    console.log('\n3. Importing new price list...');
    const form = new FormData();
    form.append('file', fs.createReadStream(EXCEL_FILE_PATH));
    
    const importResponse = await axios.post(`${API_URL}/api/price-list/import`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ Import started:', importResponse.data);
    
    // Check status
    if (importResponse.data.jobId) {
      console.log('\n4. Monitoring import progress...');
      
      const checkStatus = async () => {
        const statusResponse = await axios.get(
          `${API_URL}/api/price-list/import/${importResponse.data.jobId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        const job = statusResponse.data;
        console.log(`  Progress: ${job.progress}% - ${job.progressMessage || 'Processing...'}${job.itemsProcessed ? ` (${job.itemsProcessed}/${job.totalItems})` : ''}`);
        
        if (job.status === 'completed') {
          console.log('\n✅ Import completed successfully!');
          if (job.results) {
            console.log(`  Created: ${job.results.created}`);
            console.log(`  Updated: ${job.results.updated}`);
            console.log(`  Skipped: ${job.results.skipped}`);
            if (job.results.errors && job.results.errors.length > 0) {
              console.log(`  Errors: ${job.results.errors.length}`);
              job.results.errors.slice(0, 5).forEach(err => console.log(`    - ${err}`));
              if (job.results.errors.length > 5) {
                console.log(`    ... and ${job.results.errors.length - 5} more errors`);
              }
            }
          }
          
          // Get summary of imported items
          console.log('\n5. Getting summary of imported items...');
          const itemsResponse = await axios.get(`${API_URL}/api/price-list?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const items = itemsResponse.data;
          const totalCount = await axios.get(`${API_URL}/api/price-list/count`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.data.count).catch(() => items.length);
          
          console.log(`\n✓ Total items in database: ${totalCount}`);
          console.log('Sample items:');
          items.slice(0, 5).forEach(item => {
            const name = item.name || item.description || 'Unnamed';
            const variant = item.product_template_variant_value_ids || '';
            const cost = item.operation_cost || item.rate || 0;
            const unit = item.uom_id || item.unit || '';
            console.log(`  - ${name}${variant ? ` (${variant})` : ''} @ ${cost} ${unit}`);
          });
          
        } else if (job.status === 'failed') {
          console.error('❌ Import failed:', job.error);
          if (job.results?.errors) {
            console.error('Errors:', job.results.errors);
          }
        } else {
          // Check again in 2 seconds
          setTimeout(checkStatus, 2000);
        }
      };
      
      setTimeout(checkStatus, 2000);
    }
    
  } catch (error) {
    console.error('Import failed:', error.response?.data || error.message);
    if (error.response?.data?.errors) {
      console.error('Detailed errors:', error.response.data.errors);
    }
  }
}

// Run the import
console.log('Importing actual Excel file with new schema...\n');
importActualFile();