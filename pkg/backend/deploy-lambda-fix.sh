#!/bin/bash

echo "Deploying Lambda fix for SQS message size limit..."

# Build the project
echo "Building project..."
npm run build

# Deploy using serverless
echo "Deploying to AWS Lambda..."
npx serverless deploy --stage prod

echo "Deployment complete!"
echo ""
echo "The fix includes:"
echo "1. Check message size before sending to SQS"
echo "2. Store large payloads (>200KB) in S3"
echo "3. Send only a reference in the SQS message"
echo "4. Retrieve payload from S3 when processing"
echo ""
echo "This should resolve the 500 error for large Excel files."