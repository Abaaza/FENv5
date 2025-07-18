# Lambda Deployment Guide for BOQ Matching System

## Overview
This guide covers the deployment and troubleshooting of the BOQ Matching System on AWS Lambda with Amplify frontend.

## Issues Fixed

### 1. Express Rate Limit Trust Proxy Error
**Problem**: `X-Forwarded-For` header present but Express not configured to trust proxies.
**Solution**: Added `app.set('trust proxy', true)` to server.ts

### 2. Cookie Authentication Issues
**Problem**: Cookies not being properly set/read in cross-origin Lambda environment.
**Solution**: 
- Set `sameSite: 'none'` for Lambda deployments
- Ensure `secure: true` for HTTPS
- Proper domain configuration

### 3. CORS Configuration
**Problem**: CORS errors when frontend calls Lambda API.
**Solution**: 
- Configured specific allowed origins including Amplify URL
- Added proper CORS headers in both Express and Lambda responses

### 4. File Upload Issues
**Problem**: Multipart form data not properly handled in Lambda.
**Solution**: 
- Configured serverless-http to handle binary content types
- Proper base64 encoding/decoding for file uploads

### 5. Long-Running Jobs
**Problem**: Price matching jobs exceed Lambda's 30-second API Gateway timeout.
**Solution**: 
- Implemented async job processing with SQS
- Jobs > 100 items processed asynchronously
- Separate Lambda function with 15-minute timeout

## Deployment Steps

### 1. Set Environment Variables
```bash
export CONVEX_URL="your-convex-url"
export JWT_ACCESS_SECRET="your-32-char-access-secret"
export JWT_REFRESH_SECRET="your-32-char-refresh-secret"
export AWS_PROFILE="your-aws-profile" # Optional

# API keys are now stored in the database
# Set them through the admin panel or API after deployment
```

### 2. Build and Deploy
```bash
# Build TypeScript
npm run build

# Deploy to AWS Lambda
npm run deploy:lambda
# or
./deploy-lambda.sh
# or (Windows)
deploy-lambda.bat
```

### 3. Update Frontend Configuration
Update your frontend to use the Lambda API endpoint:
```javascript
// frontend/.env.production
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
```

## Architecture

### Lambda Functions
1. **app** - Main HTTP API handler (30s timeout)
   - Handles all REST API requests
   - File uploads processed here
   - Small jobs processed synchronously

2. **processJob** - Async job processor (15min timeout)
   - Processes large BOQ files
   - Invoked via AWS SDK or SQS

3. **processSQSJob** - SQS message processor (15min timeout)
   - Processes jobs from SQS queue
   - Automatic retry with DLQ

### S3 Storage
- File uploads stored in S3
- Large job payloads stored temporarily in S3
- Bucket: `mjd-boq-uploads-{stage}`

### SQS Queue
- Queue: `boq-matching-system-job-queue-{stage}`
- DLQ: `boq-matching-system-job-dlq-{stage}`
- Visibility timeout: 16 minutes

## Common Issues and Solutions

### 1. "No refresh token" Error
**Cause**: Cookie not being sent with request.
**Solution**: 
- Ensure frontend sends credentials: `credentials: 'include'`
- Check cookie domain/path settings
- Verify CORS configuration

### 2. File Upload Returns 400
**Cause**: Binary data not properly handled.
**Solution**:
- Ensure file is sent as multipart/form-data
- Check file size limits (10MB max)
- Verify file type is allowed (.xlsx, .xls, .csv)

### 3. Job Stuck in "Processing"
**Cause**: Lambda timeout or error during processing.
**Solution**:
- Check CloudWatch logs for the processJob function
- Look for messages in DLQ
- Verify Convex connection

### 4. CORS Errors
**Cause**: Origin not allowed or credentials not configured.
**Solution**:
- Add frontend URL to allowed origins in server.ts
- Ensure credentials are properly configured
- Check API Gateway CORS settings

## Monitoring

### CloudWatch Logs
```bash
# View main API logs
npx serverless logs -f app --stage prod --tail

# View job processor logs
npx serverless logs -f processJob --stage prod --tail

# View SQS processor logs
npx serverless logs -f processSQSJob --stage prod --tail
```

### SQS Monitoring
```bash
# Get queue URL
aws sqs get-queue-url --queue-name boq-matching-system-job-queue-prod

# Check queue attributes
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All

# View messages in DLQ
aws sqs receive-message --queue-url <dlq-url>
```

### Lambda Metrics
- Monitor invocation count, errors, duration
- Set up alarms for high error rates
- Check concurrent execution limits

## Performance Optimization

### 1. Lambda Cold Starts
- Keep Lambda warm with scheduled pings
- Use provisioned concurrency for critical functions
- Minimize package size

### 2. File Processing
- Use streaming for large files
- Process in chunks
- Implement progress tracking

### 3. Database Queries
- Batch operations where possible
- Use indexes effectively
- Cache frequently accessed data

## API Key Management

### Setting API Keys
API keys are now stored in the database instead of environment variables:

1. **Via Admin Panel**: 
   - Login as admin
   - Go to Settings > API Keys
   - Update Cohere or OpenAI keys

2. **Via API**:
   ```bash
   # Update Cohere API key
   curl -X PUT https://your-api.execute-api.region.amazonaws.com/api/settings/api-keys/cohere \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "your-cohere-api-key"}'

   # Update OpenAI API key
   curl -X PUT https://your-api.execute-api.region.amazonaws.com/api/settings/api-keys/openai \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "your-openai-api-key"}'
   ```

3. **Benefits**:
   - No need to redeploy when changing API keys
   - Keys are cached for 5 minutes for performance
   - Keys are validated when updated
   - Keys are masked when retrieved

## Security Considerations

1. **API Keys**: Stored encrypted in database, never in code or env vars
2. **S3 Bucket**: Enable encryption and access logging
3. **API Gateway**: Enable throttling and API keys if needed
4. **JWT Tokens**: Use strong secrets and short expiry times
5. **File Uploads**: Validate file types and scan for malware
6. **Access Control**: Only admins can view/update API keys

## Rollback Procedure

If deployment fails:
```bash
# List deployments
npx serverless deploy list --stage prod

# Rollback to previous version
npx serverless rollback --timestamp <timestamp> --stage prod
```

## Support

For issues:
1. Check CloudWatch logs
2. Verify environment variables
3. Test with smaller files first
4. Check SQS queue for stuck messages
5. Verify Convex database connection