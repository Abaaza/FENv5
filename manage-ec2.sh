#!/bin/bash

# EC2 Management Script
# Provides commands to manage your EC2 deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    echo "BOQ Matching System - EC2 Management"
    echo "===================================="
    echo ""
    echo "Usage: ./manage-ec2.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  status          - Show status of EC2 instances"
    echo "  start           - Start stopped instances"
    echo "  stop            - Stop running instances"
    echo "  restart         - Restart the application"
    echo "  logs            - View application logs"
    echo "  ssh             - SSH into the instance"
    echo "  update          - Deploy latest code"
    echo "  scale <number>  - Scale to specified number of instances"
    echo "  terminate       - Terminate all instances (WARNING: destructive)"
    echo "  costs           - Show estimated monthly costs"
    echo ""
}

# Get instance info
get_instance_info() {
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=BOQ-Matching-Server" "Name=instance-state-name,Values=running,stopped" \
        --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,PrivateIpAddress,State.Name,InstanceType]' \
        --output table
}

# Main command handling
case "$1" in
    status)
        print_status "EC2 Instance Status:"
        get_instance_info
        ;;
    
    start)
        print_status "Starting instances..."
        INSTANCE_IDS=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=BOQ-Matching-Server" "Name=instance-state-name,Values=stopped" \
            --query 'Reservations[*].Instances[*].InstanceId' \
            --output text)
        
        if [ -z "$INSTANCE_IDS" ]; then
            print_warning "No stopped instances found"
        else
            aws ec2 start-instances --instance-ids $INSTANCE_IDS
            print_status "Instances starting..."
        fi
        ;;
    
    stop)
        print_status "Stopping instances..."
        INSTANCE_IDS=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=BOQ-Matching-Server" "Name=instance-state-name,Values=running" \
            --query 'Reservations[*].Instances[*].InstanceId' \
            --output text)
        
        if [ -z "$INSTANCE_IDS" ]; then
            print_warning "No running instances found"
        else
            aws ec2 stop-instances --instance-ids $INSTANCE_IDS
            print_status "Instances stopping..."
        fi
        ;;
    
    restart)
        print_status "Restarting application..."
        PUBLIC_IP=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=BOQ-Matching-Server" "Name=instance-state-name,Values=running" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
        
        if [ "$PUBLIC_IP" == "None" ] || [ -z "$PUBLIC_IP" ]; then
            print_error "No running instance found"
            exit 1
        fi
        
        KEY_FILE=$(ls *.pem 2>/dev/null | head -n 1)
        ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" ec2-user@$PUBLIC_IP "cd /home/ec2-user/app && pm2 restart all"
        print_status "Application restarted"
        ;;
    
    logs)
        PUBLIC_IP=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=BOQ-Matching-Server" "Name=instance-state-name,Values=running" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
        
        if [ "$PUBLIC_IP" == "None" ] || [ -z "$PUBLIC_IP" ]; then
            print_error "No running instance found"
            exit 1
        fi
        
        KEY_FILE=$(ls *.pem 2>/dev/null | head -n 1)
        print_status "Streaming logs from $PUBLIC_IP (Ctrl+C to exit)..."
        ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" ec2-user@$PUBLIC_IP "cd /home/ec2-user/app && pm2 logs"
        ;;
    
    ssh)
        PUBLIC_IP=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=BOQ-Matching-Server" "Name=instance-state-name,Values=running" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
        
        if [ "$PUBLIC_IP" == "None" ] || [ -z "$PUBLIC_IP" ]; then
            print_error "No running instance found"
            exit 1
        fi
        
        KEY_FILE=$(ls *.pem 2>/dev/null | head -n 1)
        print_status "Connecting to $PUBLIC_IP..."
        ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" ec2-user@$PUBLIC_IP
        ;;
    
    update)
        PUBLIC_IP=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=BOQ-Matching-Server" "Name=instance-state-name,Values=running" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
        
        if [ "$PUBLIC_IP" == "None" ] || [ -z "$PUBLIC_IP" ]; then
            print_error "No running instance found"
            exit 1
        fi
        
        print_status "Deploying latest code to $PUBLIC_IP..."
        ./deploy-to-ec2.sh "$PUBLIC_IP"
        ;;
    
    scale)
        if [ -z "$2" ]; then
            print_error "Usage: ./manage-ec2.sh scale <number>"
            exit 1
        fi
        
        print_warning "Auto-scaling setup requires Load Balancer configuration"
        print_status "For now, you can manually launch additional instances with ./deploy-ec2.sh"
        ;;
    
    costs)
        print_status "Estimated Monthly Costs (us-east-1):"
        echo ""
        echo "t3.medium instance (24/7): ~$30.24/month"
        echo "EBS Storage (30GB):        ~$3.00/month"
        echo "Data Transfer (100GB):     ~$9.00/month"
        echo "----------------------------------------"
        echo "Estimated Total:           ~$42.24/month"
        echo ""
        print_warning "Actual costs may vary based on usage"
        ;;
    
    terminate)
        print_warning "This will PERMANENTLY DELETE all EC2 instances!"
        read -p "Are you sure? Type 'yes' to confirm: " CONFIRM
        
        if [ "$CONFIRM" != "yes" ]; then
            print_status "Cancelled"
            exit 0
        fi
        
        INSTANCE_IDS=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=BOQ-Matching-Server" \
            --query 'Reservations[*].Instances[*].InstanceId' \
            --output text)
        
        if [ -z "$INSTANCE_IDS" ]; then
            print_warning "No instances found"
        else
            aws ec2 terminate-instances --instance-ids $INSTANCE_IDS
            print_status "Instances terminating..."
        fi
        ;;
    
    *)
        show_usage
        ;;
esac