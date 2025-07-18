const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function buildLambdaPackage() {
  console.log('Building Lambda deployment package...');
  
  // 1. Build TypeScript
  console.log('Building TypeScript...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // 2. Create zip file
  const output = fs.createWriteStream('lambda-deploy.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', function() {
    const size = archive.pointer() / 1024 / 1024;
    console.log(`Lambda package created: ${size.toFixed(2)} MB`);
    
    // Deploy to Lambda
    console.log('Deploying to AWS Lambda...');
    try {
      execSync('aws lambda update-function-code --function-name boq-matching-system-prod-api --zip-file fileb://lambda-deploy.zip', {
        stdio: 'inherit'
      });
      
      // Update handler
      execSync('aws lambda update-function-configuration --function-name boq-matching-system-prod-api --handler handler-lambda.handler', {
        stdio: 'inherit'
      });
      
      console.log('Deployment successful!');
      
      // Test after a delay
      setTimeout(() => {
        console.log('\\nTesting deployment...');
        execSync('node test-lambda.js', { stdio: 'inherit' });
      }, 10000);
      
    } catch (error) {
      console.error('Deployment failed:', error.message);
    }
  });
  
  archive.on('error', function(err) {
    throw err;
  });
  
  archive.pipe(output);
  
  // Add dist folder
  archive.directory('dist/', 'dist');
  
  // Add handler
  archive.file('handler-lambda.js', { name: 'handler-lambda.js' });
  
  // Add package files
  archive.file('package.json', { name: 'package.json' });
  archive.file('package-lock.json', { name: 'package-lock.json' });
  
  // Add node_modules (excluding dev dependencies)
  console.log('Adding production dependencies...');
  archive.directory('node_modules/', 'node_modules', {
    ignore: [
      '**/test/**',
      '**/tests/**',
      '**/example/**',
      '**/examples/**',
      '**/*.md',
      '**/*.map',
      '**/LICENSE*',
      '**/.github/**'
    ]
  });
  
  archive.finalize();
}

buildLambdaPackage().catch(console.error);