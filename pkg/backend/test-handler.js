// Test handler to diagnose auth issues
exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const path = event.path || event.rawPath || '/';
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    
    // For root path, return success
    if (path === '/') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            },
            body: 'BOQ Matching System API is running'
        };
    }
    
    // For /api/status, return status without auth
    if (path === '/api/status' || path.endsWith('/api/status')) {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'BOQ Matching System API',
                version: '1.0.0',
                status: 'operational',
                timestamp: new Date().toISOString()
            })
        };
    }
    
    // Load the actual app
    try {
        const serverless = require('serverless-http');
        const { app } = require('./dist/server.js');
        const handler = serverless(app);
        return await handler(event, context);
    } catch (error) {
        console.error('Error loading app:', error);
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
