#!/bin/bash

echo "=== Deploying BOQ Matching System to AWS Lambda ==="

# Check if environment variables are set
if [ -z "$CONVEX_URL" ]; then
    echo "Error: CONVEX_URL is not set"
    exit 1
fi

# API keys are now fetched from database, not required in env

if [ -z "$JWT_ACCESS_SECRET" ] || [ -z "$JWT_REFRESH_SECRET" ]; then
    echo "Error: JWT secrets are not set"
    exit 1
fi

# Optional: Set AWS profile
if [ ! -z "$AWS_PROFILE" ]; then
    echo "Using AWS profile: $AWS_PROFILE"
    export AWS_PROFILE=$AWS_PROFILE
fi

# Build the project
echo "Building backend..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not found"
    exit 1
fi

# Deploy to AWS Lambda
echo "Deploying to AWS Lambda..."
npx serverless deploy --stage prod

echo "=== Deployment Complete ==="
echo ""
echo "Important Notes:"
echo "1. Make sure your Amplify frontend is configured with the correct API endpoint"
echo "2. Update CORS settings if your frontend URL changes"
echo "3. Monitor CloudWatch logs for any runtime errors"
echo "4. Check SQS queue for any stuck messages"
echo ""
echo "To view logs:"
echo "  npx serverless logs -f app --stage prod"
echo "  npx serverless logs -f processJob --stage prod"
echo ""
echo "To check SQS queue:"
echo "  aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All"