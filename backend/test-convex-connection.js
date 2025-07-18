import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('Testing Convex connection...');
  console.log('CONVEX_URL:', process.env.CONVEX_URL);
  
  try {
    const client = new ConvexHttpClient(process.env.CONVEX_URL);
    
    // Try a simple query
    console.log('Attempting to connect to Convex...');
    
    // Test with a simple operation
    const testQuery = await client.query({
      path: 'users:getByEmail',
      args: { email: 'test@example.com' }
    });
    
    console.log('Connection successful!');
    console.log('Query result:', testQuery);
  } catch (error) {
    console.error('Connection failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      cause: error.cause
    });
  }
}

testConnection();