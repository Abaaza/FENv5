console.log('Handler loading...');

const serverless = require('serverless-http');

let app;
try {
  const server = require('./dist/server.js');
  app = server.app;
  console.log('App loaded successfully');
} catch (error) {
  console.error('Failed to load app:', error);
  console.error('Error stack:', error.stack);
  throw error;
}

// Create the serverless handler with error handling
const handler = serverless(app, {
  binary: ['image/*', 'application/octet-stream', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/csv', 'multipart/form-data'],
  request: (request, event, context) => {
    // Fix for API Gateway v2 - ensure body is properly parsed
    console.log('[Handler] Incoming event.body:', event.body);
    console.log('[Handler] Incoming event.isBase64Encoded:', event.isBase64Encoded);
    
    // Parse JSON body if it's a string
    if (event.body && typeof event.body === 'string' && !event.isBase64Encoded) {
      try {
        const parsed = JSON.parse(event.body);
        request.body = parsed;
        console.log('[Handler] Parsed body:', parsed);
      } catch (e) {
        console.error('[Handler] Failed to parse body:', e);
      }
    }
  }
});

// Wrap handler to catch runtime errors
module.exports.handler = async (event, context) => {
  // Force CloudWatch logging
  console.log('=== LAMBDA HANDLER START ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify({
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    requestId: context.awsRequestId
  }, null, 2));
  
  // Log request details
  console.log('Request Method:', event.httpMethod || event.requestContext?.http?.method);
  console.log('Request Path:', event.path || event.rawPath);
  console.log('Request Headers:', JSON.stringify(event.headers, null, 2));
  console.log('Request Body:', event.body);
  console.log('Is Base64 Encoded:', event.isBase64Encoded);
  
  try {
    console.log('Calling serverless-http handler...');
    const response = await handler(event, context);
    console.log('Response status:', response.statusCode);
    console.log('Response headers:', JSON.stringify(response.headers, null, 2));
    console.log('Response body preview:', response.body ? response.body.substring(0, 200) : 'no body');
    return response;
  } catch (error) {
    console.error('=== HANDLER ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};