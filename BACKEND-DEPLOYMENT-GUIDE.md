# Backend Deployment Guide - The Fencing People

## Overview
This guide documents the correct deployment process for the TFP backend to AWS EC2 to avoid CORS and routing issues.

## Infrastructure Setup
- **Frontend**: https://tfp.braunwell.io (CloudFront + S3)
- **Backend API**: https://api-tfp.braunwell.io (CloudFront)
- **Origin Server**: http://origin-tfp.braunwell.io (EC2 nginx reverse proxy)
- **EC2 Instance**: 54.90.3.22
- **Backend Port**: 5000 (local)

## Common Issues and Solutions

### 1. CORS Errors
**Symptom**: "No 'Access-Control-Allow-Origin' header" or "Multiple values in Access-Control-Allow-Origin"

**Root Cause**: Both Express and nginx trying to set CORS headers, causing conflicts.

**Solution**: Let nginx handle ALL CORS headers, disable Express CORS or ensure it returns the correct origin.

### 2. 404 Errors on Valid Routes
**Symptom**: POST /api/auth/login returns 404 even though route exists

**Root Cause**: Backend not properly compiled or routes not loaded.

**Solution**: Full rebuild and redeploy of backend.

### 3. JWT Secret Validation Errors
**Symptom**: Backend crashes with "String must contain at least 32 character(s)"

**Root Cause**: JWT secrets too short in index.js

**Solution**: Use secrets with 32+ characters.

## Correct Deployment Process

### Step 1: Build Backend Locally
```bash
cd backend
rm -rf dist/
npm run build
```

### Step 2: Create Deployment Package
```bash
cd ..
tar -czf backend-full.tar.gz backend/dist backend/package.json backend/package-lock.json backend/.env backend/src
```

### Step 3: Upload to EC2
```bash
scp -i ~/Downloads/tfp-boq-key.pem backend-full.tar.gz ec2-user@54.90.3.22:/home/ec2-user/
```

### Step 4: Deploy on EC2
```bash
ssh -i ~/Downloads/tfp-boq-key.pem ec2-user@54.90.3.22

# Extract files
cd /home/ec2-user
tar -xzf backend-full.tar.gz

# Backup current
cp -r app/backend app/backend.bak

# Copy new files
cp -r backend/* app/backend/

# Update index.js
cd app/backend
```

### Step 5: Create Proper index.js
```javascript
require('dotenv').config();

// JWT secrets MUST be 32+ characters
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'tfp-boq-matching-access-secret-key-2025-secure-production-v2';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'tfp-boq-matching-refresh-secret-key-2025-secure-production-long-v2';
process.env.PORT = process.env.PORT || 5000;
process.env.NODE_ENV = 'production';

console.log('Starting The Fencing People backend...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Convex URL:', process.env.CONVEX_URL);

const { app } = require("./dist/server");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
    console.log("API available at http://localhost:" + PORT + "/api");
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
```

### Step 6: Configure nginx CORS (/etc/nginx/conf.d/tfp-api.conf)
```nginx
server {
    listen 80;
    server_name origin-tfp.braunwell.io;
    
    location / {
        # Handle OPTIONS preflight
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Add CORS headers to responses
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        # Hide any CORS headers from backend to avoid duplicates
        proxy_hide_header 'Access-Control-Allow-Origin';
        proxy_hide_header 'Access-Control-Allow-Credentials';
        proxy_hide_header 'Access-Control-Allow-Methods';
        proxy_hide_header 'Access-Control-Allow-Headers';
    }
}
```

### Step 7: Start/Restart Services
```bash
# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Restart backend
pm2 delete tfp-backend
pm2 start index.js --name tfp-backend
pm2 save
```

### Step 8: Verify Deployment
```bash
# Test locally on EC2
curl http://localhost:5000/api/health
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"abaza@tfp.com","password":"abaza123"}' \
  http://localhost:5000/api/auth/login

# Test via CloudFront
curl https://api-tfp.braunwell.io/api/health
```

## Quick Fix Scripts

### Fix CORS Issues
```bash
#!/bin/bash
ssh -i ~/Downloads/tfp-boq-key.pem ec2-user@54.90.3.22 << 'EOF'
# Remove any conflicting nginx configs
sudo rm -f /etc/nginx/conf.d/tfp.conf

# Ensure tfp-api.conf has correct CORS settings
sudo systemctl reload nginx
EOF
```

### Emergency Backend Restart
```bash
#!/bin/bash
ssh -i ~/Downloads/tfp-boq-key.pem ec2-user@54.90.3.22 << 'EOF'
cd /home/ec2-user/app/backend
pm2 restart tfp-backend
pm2 logs tfp-backend --lines 50
EOF
```

## Important Notes

1. **NEVER** let both Express and nginx set CORS headers - choose one
2. **ALWAYS** ensure JWT secrets are 32+ characters
3. **ALWAYS** test locally on EC2 before testing through CloudFront
4. **ALWAYS** backup before deployment (`cp -r app/backend app/backend.bak`)
5. CloudFront can cache errors - wait 1-2 minutes or use different browser

## Troubleshooting Checklist

- [ ] Is nginx running? `sudo systemctl status nginx`
- [ ] Is backend running? `pm2 status`
- [ ] Are routes loading? Check `pm2 logs tfp-backend`
- [ ] Is nginx config valid? `sudo nginx -t`
- [ ] Are CORS headers correct? `curl -I -H "Origin: https://tfp.braunwell.io" https://api-tfp.braunwell.io/api/health`
- [ ] Is backend accessible locally? `curl http://localhost:5000/api/health`

## Backend Update Checklist

Before deploying any backend updates:

1. [ ] Build locally with `npm run build`
2. [ ] Check that all routes are exported in server.ts
3. [ ] Verify JWT secrets in index.js are long enough
4. [ ] Test login endpoint locally
5. [ ] Ensure nginx CORS config hasn't changed
6. [ ] Have backup of working backend ready

Following this guide will prevent CORS and routing issues during deployment!