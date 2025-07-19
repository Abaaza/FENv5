#!/bin/bash
echo "=== Setting up TFP Nginx like MJD ==="

# First, remove any conflicting configs
sudo rm -f /etc/nginx/conf.d/default.conf
sudo rm -f /etc/nginx/sites-enabled/default

# Create the origin configuration for CloudFront
sudo tee /etc/nginx/conf.d/origin-tfp.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name origin-tfp.braunwell.io;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host api-tfp.braunwell.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # NO CORS headers - let Express handle them
    }
}
EOF

# Create the direct IP access configuration (keep existing SSL)
sudo tee /etc/nginx/conf.d/direct-access.conf > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name 54.90.3.22;
    
    ssl_certificate /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS for direct IP access
server {
    listen 80;
    server_name 54.90.3.22;
    return 301 https://$server_name$request_uri;
}
EOF

# Remove any catch-all redirect that might interfere
sudo rm -f /etc/nginx/conf.d/ssl.conf

# Test configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

echo "=== TFP Nginx Setup Complete! ==="
echo "Configuration matches MJD setup:"
echo "- origin-tfp.braunwell.io on port 80 for CloudFront"
echo "- Direct IP access on HTTPS with existing certificate"
echo "- No conflicting redirects"