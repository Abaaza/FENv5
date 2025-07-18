#!/bin/bash

# Test S3 connection using AWS CLI
echo "Testing S3 Connection with AWS CLI"
echo "=================================="

BUCKET_NAME="mjd-boq-uploads-prod"
REGION="us-east-1"

echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Test 1: Check if bucket exists
echo "1. Checking if bucket exists..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "✅ Bucket exists and is accessible!"
else
    echo "❌ Cannot access bucket. Check permissions or bucket name."
    exit 1
fi

# Test 2: List files in bucket
echo ""
echo "2. Listing files in bucket (first 5)..."
aws s3 ls "s3://$BUCKET_NAME/uploads/" --max-items 5

# Test 3: Check current AWS identity
echo ""
echo "3. Current AWS Identity:"
aws sts get-caller-identity

# Test 4: Test upload
echo ""
echo "4. Testing file upload..."
TEST_FILE="/tmp/s3-test-$(date +%s).txt"
echo "Test file content - $(date)" > "$TEST_FILE"
TEST_KEY="test-connection/cli-test-$(date +%s).txt"

if aws s3 cp "$TEST_FILE" "s3://$BUCKET_NAME/$TEST_KEY"; then
    echo "✅ Upload successful!"
    
    # Test 5: Download the file
    echo ""
    echo "5. Testing file download..."
    DOWNLOAD_FILE="/tmp/s3-download-test.txt"
    if aws s3 cp "s3://$BUCKET_NAME/$TEST_KEY" "$DOWNLOAD_FILE"; then
        echo "✅ Download successful!"
        
        # Test 6: Delete the test file
        echo ""
        echo "6. Cleaning up test file..."
        aws s3 rm "s3://$BUCKET_NAME/$TEST_KEY"
        echo "✅ Cleanup complete!"
    fi
fi

# Clean up local files
rm -f "$TEST_FILE" "$DOWNLOAD_FILE"

echo ""
echo "=================================="
echo "All S3 tests completed!"