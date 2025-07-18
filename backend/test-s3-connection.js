const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config();

// Configure AWS
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  // If running locally, you might need to set credentials explicitly
  ...(process.env.AWS_ACCESS_KEY_ID && {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  })
});

const bucketName = process.env.AWS_S3_BUCKET || 'mjd-boq-uploads-prod';

async function testS3Connection() {
  console.log('Testing S3 Connection...');
  console.log('=====================================');
  console.log(`Bucket Name: ${bucketName}`);
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`AWS Lambda Function: ${process.env.AWS_LAMBDA_FUNCTION_NAME || 'Not in Lambda'}`);
  console.log('=====================================\n');

  try {
    // Test 1: Check if bucket exists
    console.log('1. Checking if bucket exists...');
    await s3.headBucket({ Bucket: bucketName }).promise();
    console.log('✅ Bucket exists and is accessible!\n');

    // Test 2: List bucket location
    console.log('2. Getting bucket location...');
    const location = await s3.getBucketLocation({ Bucket: bucketName }).promise();
    console.log(`✅ Bucket location: ${location.LocationConstraint || 'us-east-1'}\n`);

    // Test 3: Check bucket permissions by listing objects
    console.log('3. Testing LIST permissions...');
    const listResult = await s3.listObjectsV2({ 
      Bucket: bucketName, 
      MaxKeys: 5,
      Prefix: 'uploads/'
    }).promise();
    console.log(`✅ Can list objects. Found ${listResult.KeyCount} objects in uploads/ folder\n`);

    // Test 4: Test WRITE permissions
    console.log('4. Testing WRITE permissions...');
    const testKey = `test-connection/test-${Date.now()}.txt`;
    const testContent = 'This is a test file to verify S3 write permissions';
    
    await s3.putObject({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    }).promise();
    console.log(`✅ Successfully wrote test file: ${testKey}\n`);

    // Test 5: Test READ permissions
    console.log('5. Testing READ permissions...');
    const getResult = await s3.getObject({
      Bucket: bucketName,
      Key: testKey
    }).promise();
    const readContent = getResult.Body.toString();
    console.log(`✅ Successfully read test file. Content matches: ${readContent === testContent}\n`);

    // Test 6: Test DELETE permissions
    console.log('6. Testing DELETE permissions...');
    await s3.deleteObject({
      Bucket: bucketName,
      Key: testKey
    }).promise();
    console.log(`✅ Successfully deleted test file\n`);

    // Test 7: Check IAM permissions (if possible)
    console.log('7. Checking S3 bucket policies...');
    try {
      const bucketPolicy = await s3.getBucketPolicy({ Bucket: bucketName }).promise();
      console.log('✅ Bucket policy exists (details hidden for security)\n');
    } catch (err) {
      if (err.code === 'NoSuchBucketPolicy') {
        console.log('ℹ️  No bucket policy set (using IAM permissions)\n');
      } else {
        console.log('⚠️  Cannot read bucket policy (insufficient permissions)\n');
      }
    }

    console.log('=====================================');
    console.log('🎉 All S3 connection tests passed!');
    console.log('=====================================');
    
    // Additional info for Lambda environment
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('\nLambda Environment Info:');
      console.log(`- Function Name: ${process.env.AWS_LAMBDA_FUNCTION_NAME}`);
      console.log(`- Execution Role: ${process.env.AWS_LAMBDA_FUNCTION_NAME}-role`);
      console.log('- Using IAM role permissions (no access keys needed)');
    } else {
      console.log('\nLocal Environment Info:');
      console.log('- Using AWS credentials from environment or ~/.aws/credentials');
      if (process.env.AWS_ACCESS_KEY_ID) {
        console.log('- AWS_ACCESS_KEY_ID is set');
      }
    }

  } catch (error) {
    console.error('❌ S3 Connection Test Failed!');
    console.error('=====================================');
    console.error(`Error Code: ${error.code}`);
    console.error(`Error Message: ${error.message}`);
    console.error('=====================================\n');

    // Provide helpful troubleshooting tips
    console.log('Troubleshooting Tips:');
    
    if (error.code === 'NoSuchBucket') {
      console.log('1. The bucket does not exist. Create it with:');
      console.log(`   aws s3 mb s3://${bucketName} --region ${process.env.AWS_REGION || 'us-east-1'}`);
    } else if (error.code === 'AccessDenied' || error.code === 'Forbidden') {
      console.log('1. Check IAM permissions. The user/role needs:');
      console.log('   - s3:ListBucket on the bucket');
      console.log('   - s3:GetObject, s3:PutObject, s3:DeleteObject on bucket objects');
      console.log('\n2. If using Lambda, check the execution role has S3 permissions');
      console.log('\n3. If running locally, ensure AWS credentials are configured:');
      console.log('   - Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
      console.log('   - Or run: aws configure');
    } else if (error.code === 'CredentialsError') {
      console.log('1. No AWS credentials found. Configure them by:');
      console.log('   - Setting AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file');
      console.log('   - Or running: aws configure');
    } else if (error.code === 'NetworkingError') {
      console.log('1. Check your internet connection');
      console.log('2. Check if you\'re behind a corporate proxy');
      console.log('3. Verify the AWS region is correct');
    }
    
    process.exit(1);
  }
}

// Run the test
testS3Connection().catch(console.error);