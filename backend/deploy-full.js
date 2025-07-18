const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting full deployment with all dependencies...');

try {
  // 1. Build TypeScript
  console.log('1. Building TypeScript...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // 2. Create deployment folder
  const deployDir = path.join(__dirname, 'lambda-full-deploy');
  if (fs.existsSync(deployDir)) {
    fs.rmSync(deployDir, { recursive: true });
  }
  fs.mkdirSync(deployDir);
  
  // 3. Copy all necessary files
  console.log('2. Copying files...');
  
  // Copy entire dist directory
  fs.cpSync(path.join(__dirname, 'dist'), path.join(deployDir, 'dist'), { recursive: true });
  
  // Copy handler
  fs.copyFileSync(path.join(__dirname, 'handler-lambda.js'), path.join(deployDir, 'handler-lambda.js'));
  
  // Copy package files
  fs.copyFileSync(path.join(__dirname, 'package.json'), path.join(deployDir, 'package.json'));
  fs.copyFileSync(path.join(__dirname, 'package-lock.json'), path.join(deployDir, 'package-lock.json'));
  
  // 4. Install ALL dependencies (not just production)
  console.log('3. Installing all dependencies...');
  execSync('npm ci', {
    cwd: deployDir,
    stdio: 'inherit'
  });
  
  // 5. Create zip using 7z or tar (more reliable than PowerShell for large files)
  console.log('4. Creating deployment package...');
  const zipPath = path.join(__dirname, 'lambda-full.zip');
  
  // Try using tar first (available on Windows 10+)
  try {
    execSync(`tar -a -c -f ${zipPath} *`, {
      cwd: deployDir,
      stdio: 'inherit'
    });
  } catch (e) {
    // Fallback to PowerShell
    console.log('Using PowerShell to create zip...');
    execSync(`powershell -Command "Compress-Archive -Path '${deployDir}\\*' -DestinationPath '${zipPath}' -Force -CompressionLevel Optimal"`, {
      stdio: 'inherit'
    });
  }
  
  // Check size
  const stats = fs.statSync(zipPath);
  console.log(`\nDeployment package size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  if (stats.size < 1024 * 1024) {
    throw new Error('Package too small - dependencies may be missing');
  }
  
  // 6. Deploy to Lambda
  console.log('\n5. Deploying to AWS Lambda...');
  execSync(`aws lambda update-function-code --function-name boq-matching-system-prod-api --zip-file fileb://${zipPath}`, {
    stdio: 'inherit'
  });
  
  // 7. Update configuration
  console.log('\n6. Updating Lambda configuration...');
  execSync('aws lambda update-function-configuration --function-name boq-matching-system-prod-api --handler handler-lambda.handler --timeout 900', {
    stdio: 'inherit'
  });
  
  // 8. Clean up
  console.log('\n7. Cleaning up...');
  fs.rmSync(deployDir, { recursive: true });
  fs.unlinkSync(zipPath);
  
  console.log('\nDeployment complete! Waiting for Lambda to be ready...');
  
  // 9. Wait and test
  setTimeout(() => {
    console.log('\nTesting deployment...');
    execSync('node test-lambda.js', { stdio: 'inherit' });
  }, 15000);
  
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}