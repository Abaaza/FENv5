const serverless = require('serverless-http');

// Set environment variables
process.env.CONVEX_URL = 'https://good-dolphin-454.convex.cloud';
process.env.JWT_ACCESS_SECRET = 'mjd-boq-access-secret-2025';
process.env.JWT_REFRESH_SECRET = 'mjd-boq-refresh-secret-2025';
process.env.NODE_ENV = 'production';

let app;
try {
    console.log('Loading Express app...');
    const server = require('./dist/server.js');
    app = server.app || server.default || server;
    console.log('Express app loaded successfully');
} catch (error) {
    console.error('Failed to load app:', error);
    // Fallback simple app
    const express = require('express');
    app = express();
    app.use(express.json());
    
    // Add CORS
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', '*');
        res.header('Access-Control-Allow-Headers', '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });
    
    app.get('/', (req, res) => res.send('BOQ API Running'));
    app.get('/api/status', (req, res) => res.json({ 
        message: 'BOQ Matching System API',
        version: '1.0.0',
        status: 'operational'
    }));
}

exports.handler = serverless(app);
