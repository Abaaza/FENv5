// Emergency Lambda handler that just returns health check
exports.handler = async (event, context) => {
  console.log('Emergency handler called');
  console.log('Event:', JSON.stringify(event));
  
  const path = event.path || event.rawPath || '';
  
  // Handle health check
  if (path === '/health' || path === '/api/health') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        status: 'healthy',
        message: 'Emergency handler active - deployment issues being fixed',
        timestamp: new Date().toISOString()
      })
    };
  }
  
  // Return error for other endpoints
  return {
    statusCode: 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({
      error: 'Service temporarily unavailable',
      message: 'The service is being updated. Please try again later.',
      path: path
    })
  };
};