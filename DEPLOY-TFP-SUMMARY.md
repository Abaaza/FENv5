# The Fencing People Backend Deployment Summary

## Current Status
✅ Backend is running on EC2 (54.90.3.22) on port 5000
✅ PM2 process manager is running (process name: tfp-backend)
✅ Database connected to Convex: https://bright-scorpion-424.convex.cloud
✅ JWT authentication configured with proper secrets
⚠️ HTTPS/Nginx configuration needs manual fix

## Access URLs
- **HTTP (working)**: http://54.90.3.22:5000/api/health
- **HTTPS (pending)**: https://54.90.3.22/api/health

## Backend Configuration
The backend is configured with:
- Changed all "COHERE/OPENAI" references to "V2/V1" in the code
- Environment variables renamed: V2_API_KEY and V1_API_KEY
- JWT secrets are properly configured (32+ characters)
- Frontend URL: https://main.d2devufp71564t.amplifyapp.com

## Manual Steps Needed

### 1. Fix Nginx Configuration
SSH into the server:
```bash
ssh -i "C:\Users\abaza\Downloads\tfp-boq-key.pem" ec2-user@54.90.3.22
```

Create Nginx config:
```bash
sudo nano /etc/nginx/conf.d/tfp.conf
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
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
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://main.d2devufp71564t.amplifyapp.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        # Handle OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://main.d2devufp71564t.amplifyapp.com';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
            add_header 'Access-Control-Allow-Credentials' 'true';
            add_header 'Content-Length' '0';
            add_header 'Content-Type' 'text/plain';
            return 204;
        }
    }
}
```

Test and restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 2. Update Amplify Frontend
Configure environment variables in AWS Amplify:
- `VITE_API_URL`: `https://54.90.3.22/api`
- `VITE_CONVEX_URL`: `https://bright-scorpion-424.convex.cloud`

### 3. Create Admin User
After Nginx is working, create the admin user using the Convex dashboard or API.

## Monitoring Commands
```bash
# Check backend logs
ssh -i "C:\Users\abaza\Downloads\tfp-boq-key.pem" ec2-user@54.90.3.22 'pm2 logs tfp-backend'

# Check backend status
ssh -i "C:\Users\abaza\Downloads\tfp-boq-key.pem" ec2-user@54.90.3.22 'pm2 status'

# Restart backend if needed
ssh -i "C:\Users\abaza\Downloads\tfp-boq-key.pem" ec2-user@54.90.3.22 'pm2 restart tfp-backend'
```

## Key Files on EC2
- Backend location: `/home/ec2-user/app/backend/`
- Entry point: `/home/ec2-user/app/backend/index.js`
- Environment: `/home/ec2-user/app/backend/.env`
- Nginx config: `/etc/nginx/conf.d/tfp.conf`

## Notes
- The backend code has been successfully updated with V2/V1 naming
- All TypeScript compilation errors have been fixed
- The system is identical to MJD but with:
  - Different company branding ("The Fencing People")
  - Different Convex database
  - Different EC2 instance
  - V2/V1 instead of COHERE/OPENAI naming