// Lambda handler for serverless deployment
import express from 'express';

// Import the Express app configuration
let app: express.Application;

// Lazy load the server to avoid initialization issues
async function getApp() {
  if (!app) {
    // Dynamically import server to ensure proper initialization
    const serverModule = await import('./server.js');
    app = serverModule.app || serverModule.default;
  }
  return app;
}

// Lambda handler function
export const handler = async (event: any, context: any) => {
  console.log('Lambda handler invoked', {
    path: event.path || event.rawPath,
    method: event.httpMethod || event.requestContext?.http?.method,
    headers: event.headers
  });

  // Get the Express app
  const expressApp = await getApp();

  // Convert Lambda event to Express request/response
  return new Promise((resolve, reject) => {
    // Create mock request
    const req = {
      method: event.httpMethod || event.requestContext?.http?.method || 'GET',
      url: event.path || event.rawPath || '/',
      headers: event.headers || {},
      body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : undefined,
      query: event.queryStringParameters || {},
      ip: event.requestContext?.identity?.sourceIp || '127.0.0.1'
    };

    // Parse JSON body if needed
    if (req.headers['content-type']?.includes('application/json') && typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
      }
    }

    // Create mock response
    let statusCode = 200;
    const headers: any = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    };
    let body = '';

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      set: (key: string, value: string) => {
        headers[key] = value;
        return res;
      },
      setHeader: (key: string, value: string) => {
        headers[key] = value;
        return res;
      },
      json: (data: any) => {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(data);
        resolve({
          statusCode,
          headers,
          body
        });
      },
      send: (data: any) => {
        if (typeof data === 'object') {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify(data);
        } else {
          body = String(data);
        }
        resolve({
          statusCode,
          headers,
          body
        });
      },
      end: () => {
        resolve({
          statusCode,
          headers,
          body
        });
      }
    };

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Process request through Express
    try {
      // @ts-ignore - Express typing issues
      expressApp(req, res, (err: any) => {
        if (err) {
          console.error('Express error:', err);
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
          });
        }
      });
    } catch (error) {
      console.error('Handler error:', error);
      resolve({
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error' })
      });
    }
  });
};