#!/bin/bash

# S3 Bucket Setup and Verification Script
# Run 'aws configure' before running this script

set -e  # Exit on error

# Configuration
BUCKET_NAME="mjd-boq-uploads-prod"
REGION="us-east-1"

echo "======================================"
echo "S3 Bucket Setup and Verification"
echo "======================================"
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Function to check if bucket exists
check_bucket_exists() {
    if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Step 1: Check AWS credentials
echo "1. Checking AWS credentials..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo "✅ AWS credentials are configured"
    aws sts get-caller-identity --output table
else
    echo "❌ AWS credentials not found. Please run 'aws configure' first"
    exit 1
fi
echo ""

# Step 2: Check if bucket exists
echo "2. Checking if bucket exists..."
if check_bucket_exists; then
    echo "✅ Bucket '$BUCKET_NAME' already exists"
    
    # Get bucket location
    LOCATION=$(aws s3api get-bucket-location --bucket "$BUCKET_NAME" --query 'LocationConstraint' --output text)
    if [ "$LOCATION" == "None" ]; then
        LOCATION="us-east-1"
    fi
    echo "   Location: $LOCATION"
else
    echo "⚠️  Bucket '$BUCKET_NAME' does not exist"
    echo ""
    read -p "Do you want to create it? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating bucket..."
        if [ "$REGION" == "us-east-1" ]; then
            # us-east-1 doesn't need LocationConstraint
            aws s3api create-bucket --bucket "$BUCKET_NAME"
        else
            aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" \
                --create-bucket-configuration LocationConstraint="$REGION"
        fi
        echo "✅ Bucket created successfully"
    else
        echo "Skipping bucket creation"
        exit 0
    fi
fi
echo ""

# Step 3: Set up bucket folders
echo "3. Setting up bucket structure..."
# Create placeholder files for folder structure
echo "placeholder" | aws s3 cp - "s3://$BUCKET_NAME/uploads/.keep" 2>/dev/null || true
echo "placeholder" | aws s3 cp - "s3://$BUCKET_NAME/job-payloads/.keep" 2>/dev/null || true
echo "placeholder" | aws s3 cp - "s3://$BUCKET_NAME/test-connection/.keep" 2>/dev/null || true
echo "✅ Bucket folders created"
echo ""

# Step 4: Configure bucket for the application
echo "4. Configuring bucket settings..."

# Enable versioning (optional but recommended)
echo "   - Enabling versioning..."
aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled

# Set lifecycle policy to clean up old job payloads
echo "   - Setting lifecycle policy for job-payloads..."
cat > /tmp/lifecycle-policy.json << EOF
{
    "Rules": [
        {
            "ID": "CleanupJobPayloads",
            "Status": "Enabled",
            "Prefix": "job-payloads/",
            "Expiration": {
                "Days": 7
            }
        },
        {
            "ID": "CleanupTestFiles",
            "Status": "Enabled", 
            "Prefix": "test-connection/",
            "Expiration": {
                "Days": 1
            }
        }
    ]
}
EOF

aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET_NAME" \
    --lifecycle-configuration file:///tmp/lifecycle-policy.json
rm /tmp/lifecycle-policy.json

echo "✅ Bucket configuration complete"
echo ""

# Step 5: Test permissions
echo "5. Testing bucket permissions..."

# Test upload
TEST_FILE="/tmp/s3-test-$(date +%s).txt"
echo "Test content - $(date)" > "$TEST_FILE"
TEST_KEY="test-connection/setup-test-$(date +%s).txt"

echo "   - Testing upload..."
if aws s3 cp "$TEST_FILE" "s3://$BUCKET_NAME/$TEST_KEY" > /dev/null 2>&1; then
    echo "   ✅ Upload successful"
    
    # Test download
    echo "   - Testing download..."
    if aws s3 cp "s3://$BUCKET_NAME/$TEST_KEY" "/tmp/download-test.txt" > /dev/null 2>&1; then
        echo "   ✅ Download successful"
        
        # Test delete
        echo "   - Testing delete..."
        if aws s3 rm "s3://$BUCKET_NAME/$TEST_KEY" > /dev/null 2>&1; then
            echo "   ✅ Delete successful"
        fi
    fi
fi

# Cleanup
rm -f "$TEST_FILE" "/tmp/download-test.txt"
echo ""

# Step 6: Display summary
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Bucket Details:"
echo "  Name: $BUCKET_NAME"
echo "  Region: $REGION"
echo "  URL: https://s3.$REGION.amazonaws.com/$BUCKET_NAME"
echo ""
echo "Folder Structure:"
aws s3 ls "s3://$BUCKET_NAME/" --recursive | head -10
echo ""
echo "Next Steps:"
echo "1. Update your .env file with:"
echo "   AWS_S3_BUCKET=$BUCKET_NAME"
echo "   AWS_REGION=$REGION"
echo ""
echo "2. Deploy your Lambda function:"
echo "   npm run build"
echo "   npx serverless deploy --stage prod"
echo ""
echo "✅ Your S3 bucket is ready for use!"