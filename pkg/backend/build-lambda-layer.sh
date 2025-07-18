#!/bin/bash

echo "Building Lambda Layer..."

# Create layer directory
mkdir -p lambda-layer/nodejs

# Copy package files
cp package.json lambda-layer/nodejs/
cp package-lock.json lambda-layer/nodejs/

# Install production dependencies only
cd lambda-layer/nodejs
npm ci --production --no-audit

# Remove unnecessary files
find . -name "*.d.ts" -type f -delete
find . -name "*.ts" -type f -delete
find . -name "*.map" -type f -delete
find . -name "test" -type d -exec rm -rf {} +
find . -name "tests" -type d -exec rm -rf {} +
find . -name "docs" -type d -exec rm -rf {} +
find . -name "example" -type d -exec rm -rf {} +
find . -name "examples" -type d -exec rm -rf {} +
find . -name ".bin" -type d -exec rm -rf {} +
find . -name "README.md" -type f -delete
find . -name "CHANGELOG.md" -type f -delete
find . -name "LICENSE*" -type f -delete

# Remove AWS SDK (provided by Lambda)
rm -rf node_modules/aws-sdk

cd ../..

echo "Lambda layer built in lambda-layer/"
echo "Deploy with: serverless deploy --config serverless-layer.yml"