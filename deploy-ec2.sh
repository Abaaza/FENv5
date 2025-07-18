#!/bin/bash

# EC2 Deployment Script for BOQ Matching System
# This script sets up and deploys the application on an EC2 instance

set -e  # Exit on error

echo "🚀 EC2 Deployment Script for BOQ Matching System"
echo "================================================"

# Configuration
INSTANCE_TYPE="t3.medium"  # 2 vCPU, 4GB RAM - good for processing
REGION="us-east-1"
KEY_NAME="boq-matching-key"
SECURITY_GROUP_NAME="boq-matching-sg"
INSTANCE_NAME="BOQ-Matching-Server"
AMI_ID="ami-0c02fb55956c7d316"  # Amazon Linux 2 AMI (update based on region)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    echo "Visit: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

# Get the default VPC ID
print_status "Getting default VPC..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text)
if [ "$VPC_ID" == "None" ]; then
    print_error "No default VPC found. Please create one or specify a VPC ID."
    exit 1
fi
print_status "Using VPC: $VPC_ID"

# Create key pair if it doesn't exist
print_status "Checking for SSH key pair..."
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" &> /dev/null; then
    print_status "Creating new key pair..."
    aws ec2 create-key-pair --key-name "$KEY_NAME" --query 'KeyMaterial' --output text > "$KEY_NAME.pem"
    chmod 400 "$KEY_NAME.pem"
    print_status "Key pair created and saved to $KEY_NAME.pem"
else
    print_warning "Key pair $KEY_NAME already exists"
fi

# Create security group if it doesn't exist
print_status "Setting up security group..."
SG_ID=$(aws ec2 describe-security-groups --group-names "$SECURITY_GROUP_NAME" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")

if [ "$SG_ID" == "None" ]; then
    print_status "Creating security group..."
    SG_ID=$(aws ec2 create-security-group \
        --group-name "$SECURITY_GROUP_NAME" \
        --description "Security group for BOQ Matching System" \
        --vpc-id "$VPC_ID" \
        --query 'GroupId' \
        --output text)
    
    # Add inbound rules
    print_status "Adding security group rules..."
    # SSH access
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0
    
    # HTTP access
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0
    
    # HTTPS access
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0
    
    # Node.js app port (optional, for direct access)
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 5000 \
        --cidr 0.0.0.0/0
    
    print_status "Security group created: $SG_ID"
else
    print_warning "Security group already exists: $SG_ID"
fi

# Create user data script for instance initialization
cat > user-data.sh << 'EOF'
#!/bin/bash
# Update system
yum update -y

# Install Node.js 18
curl -sL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install Git
yum install -y git

# Install nginx
amazon-linux-extras install nginx1 -y

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

# Install build tools (for native modules)
yum groupinstall -y "Development Tools"
yum install -y python3

# Configure nginx to start on boot
systemctl enable nginx

# Create a flag file to indicate setup is complete
touch /home/ec2-user/setup-complete
EOF

# Launch EC2 instance
print_status "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data file://user-data.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

print_status "Instance launched: $INSTANCE_ID"

# Wait for instance to be running
print_status "Waiting for instance to start..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

print_status "Instance is running!"
print_status "Public IP: $PUBLIC_IP"

# Create deployment info file
cat > ec2-deployment-info.txt << EOL
EC2 Deployment Information
=========================
Instance ID: $INSTANCE_ID
Public IP: $PUBLIC_IP
Security Group: $SG_ID
Key Name: $KEY_NAME
Region: $REGION

SSH Command:
ssh -i "$KEY_NAME.pem" ec2-user@$PUBLIC_IP

Next Steps:
1. Wait 2-3 minutes for the instance to complete setup
2. Run: ./deploy-to-ec2.sh $PUBLIC_IP
EOL

cat ec2-deployment-info.txt

# Clean up
rm -f user-data.sh

print_status "✅ EC2 instance is ready!"
print_status "Run the deployment script next: ./deploy-to-ec2.sh $PUBLIC_IP"