console.log('Lambda handler loading...');

const serverless = require('serverless-http');

let app;
try {
  const server = require('./dist/server.js');
  app = server.app || server.default;
  console.log('App loaded successfully');
} catch (error) {
  console.error('Failed to load app:', error);
  console.error('Error stack:', error.stack);
  throw error;
}

// Create the serverless handler with proper configuration
const handler = serverless(app, {
  binary: [
    'image/*', 
    'application/octet-stream', 
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
    'text/csv', 
    'application/csv', 
    'multipart/form-data'
  ],
  request: (request, event, context) => {
    // Fix for API Gateway v2 - ensure body is properly parsed
    console.log('[Handler] Incoming event path:', event.path || event.rawPath);
    console.log('[Handler] Incoming event method:', event.httpMethod || event.requestContext?.http?.method);
    console.log('[Handler] Incoming event.isBase64Encoded:', event.isBase64Encoded);
    
    // Parse cookies from headers for Lambda
    if (event.headers && event.headers.cookie) {
      request.headers.cookie = event.headers.cookie;
      
      // Parse cookies manually for debugging
      const cookies = {};
      event.headers.cookie.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies[name] = value;
        }
      });
      console.log('[Handler] Parsed cookies:', Object.keys(cookies));
    }
    
    // Handle API Gateway v2 format
    if (event.rawPath) {
      request.url = event.rawPath;
      if (event.rawQueryString) {
        request.url += '?' + event.rawQueryString;
      }
    }
    
    // Parse JSON body if it's a string and not multipart
    if (event.body && typeof event.body === 'string' && !event.isBase64Encoded) {
      const contentType = event.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(event.body);
          request.body = parsed;
          console.log('[Handler] Parsed JSON body');
        } catch (e) {
          console.error('[Handler] Failed to parse JSON body:', e);
        }
      }
    }
    
    // Fix for multipart form data
    if (event.isBase64Encoded && event.headers['content-type']?.includes('multipart/form-data')) {
      console.log('[Handler] Handling multipart form data');
      request.headers['content-length'] = Buffer.byteLength(event.body, 'base64').toString();
    }
  },
  response: (response, event, context) => {
    // Ensure response has headers object
    if (!response.headers) {
      response.headers = {};
    }
    
    // Ensure cookies are properly set in the response
    if (response.headers['set-cookie']) {
      console.log('[Handler] Response has set-cookie headers');
      
      // API Gateway expects set-cookie as an array
      if (!Array.isArray(response.headers['set-cookie'])) {
        response.headers['set-cookie'] = [response.headers['set-cookie']];
      }
    }
    
    // Add CORS headers if not present
    if (!response.headers['access-control-allow-origin']) {
      const origin = event.headers?.origin || 'https://main.d3j084kic0l1ff.amplifyapp.com';
      response.headers['access-control-allow-origin'] = origin;
    }
    
    if (!response.headers['access-control-allow-credentials']) {
      response.headers['access-control-allow-credentials'] = 'true';
    }
    
    console.log('[Handler] Response status:', response.statusCode);
    console.log('[Handler] Response headers:', JSON.stringify(response.headers, null, 2));
  }
});

// Wrap handler to catch runtime errors and add detailed logging
module.exports.handler = async (event, context) => {
  // Force CloudWatch logging
  console.log('=== LAMBDA HANDLER START ===');
  console.log('Event:', JSON.stringify({
    httpMethod: event.httpMethod || event.requestContext?.http?.method,
    path: event.path || event.rawPath,
    headers: event.headers,
    isBase64Encoded: event.isBase64Encoded,
    requestContext: {
      requestId: event.requestContext?.requestId,
      domainName: event.requestContext?.domainName,
      stage: event.requestContext?.stage
    }
  }, null, 2));
  
  console.log('Context:', JSON.stringify({
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    requestId: context.awsRequestId,
    remainingTime: context.getRemainingTimeInMillis()
  }, null, 2));
  
  // Set environment variables for Lambda
  process.env.AWS_LAMBDA_FUNCTION_NAME = context.functionName;
  process.env.AWS_REQUEST_ID = context.awsRequestId;
  
  try {
    console.log('Calling serverless-http handler...');
    const response = await handler(event, context);
    
    console.log('Response preview:', {
      statusCode: response.statusCode,
      headers: response.headers,
      bodyLength: response.body ? response.body.length : 0,
      bodyPreview: response.body ? response.body.substring(0, 200) : 'no body'
    });
    
    console.log('=== LAMBDA HANDLER END ===');
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
        'Access-Control-Allow-Origin': event.headers?.origin || 'https://main.d3j084kic0l1ff.amplifyapp.com',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        requestId: context.awsRequestId
      })
    };
  }
};

// Export the app for local testing
module.exports.app = app;