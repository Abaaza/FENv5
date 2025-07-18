const serverless = require('serverless-http');

// Import the ES module
async function loadApp() {
    try {
        const serverModule = await import('./dist/server.js');
        return serverModule.app;
    } catch (error) {
        console.error('Failed to load server module:', error);
        throw error;
    }
}

// Create async handler
const createHandler = async () => {
    const app = await loadApp();
    return serverless(app, {
        binary: ['image/*', 'application/octet-stream', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    });
};

// Export handler
let cachedHandler;
module.exports.handler = async (event, context) => {
    if (!cachedHandler) {
        try {
            cachedHandler = await createHandler();
        } catch (error) {
            console.error('Error creating handler:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Failed to initialize handler',
                    message: error.message
                })
            };
        }
    }
    
    return cachedHandler(event, context);
};