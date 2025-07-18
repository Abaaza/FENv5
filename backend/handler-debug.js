console.log('Handler starting...');
console.log('Current directory:', __dirname);
console.log('Environment:', process.env.NODE_ENV);

try {
    const serverless = require('serverless-http');
    console.log('serverless-http loaded');
    
    // Try to load the app
    let app;
    try {
        const serverModule = require('./dist/server.js');
        app = serverModule.app;
        console.log('App loaded from dist/server.js');
        console.log('App type:', typeof app);
        console.log('App keys:', app ? Object.keys(app).slice(0, 10) : 'app is null/undefined');
    } catch (e) {
        console.error('Failed to load from dist/server.js:', e.message);
        console.error('Error stack:', e.stack);
        
        // Check what files exist
        const fs = require('fs');
        const path = require('path');
        
        console.log('Current directory:', __dirname);
        console.log('Files in current directory:', fs.readdirSync(__dirname).slice(0, 10));
        
        if (fs.existsSync(path.join(__dirname, 'dist'))) {
            console.log('Files in dist:', fs.readdirSync(path.join(__dirname, 'dist')).slice(0, 10));
        }
        
        throw new Error('Could not load server app: ' + e.message);
    }
    
    if (!app) {
        throw new Error('App is undefined after loading');
    }
    
    // Create the serverless handler
    module.exports.handler = serverless(app, {
        binary: ['image/*', 'application/octet-stream', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    });
    
    console.log('Handler created successfully');
} catch (error) {
    console.error('Error creating handler:', error);
    
    // Fallback handler
    module.exports.handler = async (event, context) => {
        console.log('Fallback handler called');
        console.log('Event:', JSON.stringify(event, null, 2));
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Handler initialization failed',
                message: error.message,
                stack: error.stack,
                cwd: process.cwd(),
                dirname: __dirname
            })
        };
    };
}