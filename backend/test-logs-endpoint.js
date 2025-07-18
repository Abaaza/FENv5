// Test the logs endpoint
const axios = require('axios');

const API_URL = 'https://ls4380art0.execute-api.us-east-1.amazonaws.com';

async function testLogsEndpoint() {
  console.log('=== Testing Logs Endpoint ===\n');
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const { data: loginData } = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    const token = loginData.accessToken;
    console.log('✅ Logged in\n');
    
    // 2. Get recent jobs to find one with logs
    console.log('2. Getting recent jobs...');
    const { data: jobs } = await axios.get(`${API_URL}/api/price-matching/jobs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!jobs || jobs.length === 0) {
      console.log('No jobs found. Please run a price matching job first.');
      return;
    }
    
    // Find a recent job
    const recentJob = jobs[0];
    console.log(`Found job: ${recentJob._id}\n`);
    
    // 3. Test the logs endpoint
    console.log('3. Fetching logs...');
    try {
      const { data: logsData } = await axios.get(
        `${API_URL}/api/jobs/${recentJob._id}/logs`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      console.log('✅ Logs endpoint response:');
      console.log(`- Total logs: ${logsData.logs?.length || 0}`);
      console.log(`- Has progress data: ${!!logsData.progress}`);
      console.log(`- Response timestamp: ${logsData.timestamp}`);
      
      if (logsData.logs && logsData.logs.length > 0) {
        console.log('\nSample logs:');
        logsData.logs.slice(0, 5).forEach((log, i) => {
          console.log(`  ${i + 1}. [${log.level}] ${log.timestamp} - ${log.message.substring(0, 60)}...`);
        });
      }
      
      // Test with 'since' parameter
      if (logsData.logs && logsData.logs.length > 0) {
        const lastTimestamp = logsData.logs[logsData.logs.length - 1].timestamp;
        console.log(`\n4. Testing 'since' parameter with timestamp: ${lastTimestamp}`);
        
        const { data: newLogsData } = await axios.get(
          `${API_URL}/api/jobs/${recentJob._id}/logs`,
          { 
            headers: { 'Authorization': `Bearer ${token}` },
            params: { since: lastTimestamp }
          }
        );
        
        console.log(`New logs since last fetch: ${newLogsData.logs?.length || 0}`);
      }
      
    } catch (error) {
      console.log('❌ Logs endpoint error:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        console.log('The /api/jobs/:jobId/logs endpoint might not be available');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

console.log('Testing logs endpoint on production Lambda\n');
testLogsEndpoint();