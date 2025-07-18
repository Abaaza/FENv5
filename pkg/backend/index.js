// Lambda handler for BOQ Matching System
const serverless = require('serverless-http');

// Set environment variables
process.env.CONVEX_URL = process.env.CONVEX_URL || 'https://good-dolphin-454.convex.cloud';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'mjd-boq-access-secret-2025';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mjd-boq-refresh-secret-2025';
process.env.NODE_ENV = 'production';
process.env.FRONTEND_URL = 'http://mjd-boq-5785-20250708233159.s3-website-us-east-1.amazonaws.com';

console.log('Loading BOQ Matching System backend...');

let app;
let handler;

try {
    // Load the compiled Express app
    const server = require('./dist/server.js');
    app = server.app || server.default || server;
    console.log('Express app loaded successfully');
    
    // Create serverless handler
    handler = serverless(app, {
        binary: ['image/*', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    });
} catch (error) {
    console.error('Failed to load Express app:', error);
    throw error;
}

// Export the handler
exports.handler = async (event, context) => {
    console.log('Request:', event.httpMethod || event.requestContext?.http?.method, event.path || event.rawPath);
    
    try {
        const result = await handler(event, context);
        return result;
    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};