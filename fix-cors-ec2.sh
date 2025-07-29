#!/bin/bash

echo "Fixing CORS configuration on EC2..."

# SSH into EC2 and update nginx configuration
ssh -i "Downloads/tfp-boq-key.pem" ec2-user@54.90.3.22 << 'EOF'
    # Check current nginx configuration
    echo "Current nginx configuration:"
    sudo cat /etc/nginx/sites-available/api-tfp.braunwell.io
    
    # Create backup
    sudo cp /etc/nginx/sites-available/api-tfp.braunwell.io /etc/nginx/sites-available/api-tfp.braunwell.io.backup
    
    # Test nginx configuration
    sudo nginx -t
    
    # Reload nginx
    sudo systemctl reload nginx
    
    echo "Nginx reloaded. CORS should be fixed now."
EOF

echo "Done!"