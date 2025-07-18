// Test script to find problematic routes
const express = require('express');
const app = express();

console.log('Testing Express route patterns...\n');

// Test basic routes
try {
  app.get('/test', (req, res) => res.send('OK'));
  console.log('✓ Basic route works');
} catch (e) {
  console.log('✗ Basic route failed:', e.message);
}

// Test wildcard route
try {
  app.get('/*', (req, res) => res.send('OK'));
  console.log('✓ Wildcard route works');
} catch (e) {
  console.log('✗ Wildcard route failed:', e.message);
}

// Test parameter routes
try {
  app.get('/api/:id', (req, res) => res.send('OK'));
  console.log('✓ Parameter route works');
} catch (e) {
  console.log('✗ Parameter route failed:', e.message);
}

// Now let's load the actual server and see what happens
console.log('\nLoading actual server.js...');
try {
  require('./dist/server.js');
  console.log('✓ Server loaded successfully');
} catch (e) {
  console.log('✗ Server failed to load:', e.message);
  console.log('Stack trace:', e.stack);
}