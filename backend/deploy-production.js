const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deployToLambda() {
  console.log('Starting production deployment...');
  
  try {
    // 1. Build TypeScript
    console.log('Building TypeScript...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // 2. Create deployment directory
    const deployDir = path.join(__dirname, 'lambda-deploy');
    if (fs.existsSync(deployDir)) {
      fs.rmSync(deployDir, { recursive: true });
    }
    fs.mkdirSync(deployDir);
    
    // 3. Copy necessary files
    console.log('Copying deployment files...');
    
    // Copy dist folder
    const distSource = path.join(__dirname, 'dist');
    const distDest = path.join(deployDir, 'dist');
    fs.cpSync(distSource, distDest, { recursive: true });
    
    // Copy handler
    fs.copyFileSync(
      path.join(__dirname, 'handler-lambda.js'),
      path.join(deployDir, 'handler-lambda.js')
    );
    
    // Create minimal package.json with only production dependencies
    const originalPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deployPackage = {
      name: originalPackage.name,
      version: originalPackage.version,
      main: originalPackage.main,
      dependencies: originalPackage.dependencies
    };
    
    // Remove dev dependencies from dependencies if any
    delete deployPackage.dependencies['@types/node'];
    delete deployPackage.dependencies['typescript'];
    delete deployPackage.dependencies['tsx'];
    
    fs.writeFileSync(
      path.join(deployDir, 'package.json'),
      JSON.stringify(deployPackage, null, 2)
    );
    
    // 4. Install production dependencies
    console.log('Installing production dependencies...');
    execSync('npm install --production --no-audit --no-fund', {
      cwd: deployDir,
      stdio: 'inherit'
    });
    
    // 5. Clean up unnecessary files
    console.log('Cleaning up unnecessary files...');
    const cleanupCommands = [
      'find node_modules -name "*.md" -type f -delete 2>nul || echo.',
      'find node_modules -name "*.txt" -type f -delete 2>nul || echo.',
      'find node_modules -name "*.map" -type f -delete 2>nul || echo.',
      'find node_modules -name "test" -type d -exec rm -rf {} + 2>nul || echo.',
      'find node_modules -name "tests" -type d -exec rm -rf {} + 2>nul || echo.',
      'find node_modules -name "example" -type d -exec rm -rf {} + 2>nul || echo.',
      'find node_modules -name ".github" -type d -exec rm -rf {} + 2>nul || echo.'
    ];
    
    cleanupCommands.forEach(cmd => {
      try {
        execSync(cmd, { cwd: deployDir });
      } catch (e) {
        // Ignore errors
      }
    });
    
    // 6. Create deployment package
    console.log('Creating deployment package...');
    const zipPath = path.join(__dirname, 'lambda-function.zip');
    
    // Use PowerShell to create zip on Windows
    execSync(`powershell Compress-Archive -Path ${deployDir}\\* -DestinationPath ${zipPath} -Force`);
    
    // Check file size
    const stats = fs.statSync(zipPath);
    console.log(`Deployment package size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // 7. Update Lambda function
    console.log('Updating Lambda function...');
    execSync(`aws lambda update-function-code --function-name boq-matching-system-prod-api --zip-file fileb://${zipPath}`, {
      stdio: 'inherit'
    });
    
    // 8. Update handler back to normal
    console.log('Updating Lambda configuration...');
    execSync('aws lambda update-function-configuration --function-name boq-matching-system-prod-api --handler handler-lambda.handler', {
      stdio: 'inherit'
    });
    
    // 9. Clean up
    console.log('Cleaning up...');
    fs.rmSync(deployDir, { recursive: true });
    fs.unlinkSync(zipPath);
    
    console.log('Deployment complete!');
    
    // 10. Test the deployment
    console.log('\\nTesting deployment...');
    setTimeout(() => {
      execSync('node test-lambda.js', { stdio: 'inherit' });
    }, 5000);
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

deployToLambda();