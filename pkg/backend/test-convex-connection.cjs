const { ConvexHttpClient } = require('convex/browser');
require('dotenv').config();

async function testConnection() {
  console.log('Testing Convex connection...');
  console.log('CONVEX_URL:', process.env.CONVEX_URL);
  
  try {
    const client = new ConvexHttpClient(process.env.CONVEX_URL);
    
    // Try a simple query
    console.log('Attempting to connect to Convex...');
    
    // Just test the connection
    console.log('Client created successfully');
    console.log('Convex client:', client);
    
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