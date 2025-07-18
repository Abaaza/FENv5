# The Fencing People - Deployment Guide

This guide outlines how to deploy The Fencing People BOQ Matching System to new AWS infrastructure.

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI configured
3. Node.js 16+ installed
4. Git repository access

## Infrastructure Setup

### 1. EC2 Instance for Backend

1. **Launch EC2 Instance**:
   - AMI: Amazon Linux 2023 or Ubuntu 22.04
   - Instance Type: t3.medium (minimum)
   - Security Group:
     - Port 22 (SSH) - Your IP only
     - Port 443 (HTTPS) - 0.0.0.0/0
     - Port 5000 (Backend) - 0.0.0.0/0 (or restrict to Amplify)
   
2. **Install Dependencies**:
   ```bash
   # Connect to EC2
   ssh -i your-key.pem ec2-user@your-ec2-ip
   
   # Install Node.js
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Install Nginx
   sudo yum install -y nginx
   ```

3. **Configure Nginx**:
   Create `/etc/nginx/conf.d/tfp-boq.conf`:
   ```nginx
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
       }
   }
   ```

### 2. AWS Amplify for Frontend

1. **Create Amplify App**:
   - Go to AWS Amplify Console
   - Connect your GitHub repository
   - Choose the `fenv5` branch
   - Use the existing `amplify.yml` configuration

2. **Environment Variables**:
   Set in Amplify Console:
   - `VITE_API_URL`: https://your-ec2-ip/api
   - `VITE_CONVEX_URL`: https://bright-scorpion-424.convex.cloud

### 3. S3 Bucket for File Storage

```bash
# Create S3 bucket
aws s3 mb s3://tfp-boq-uploads-prod --region us-east-1

# Set bucket policy for backend access
aws s3api put-bucket-policy --bucket tfp-boq-uploads-prod --policy file://bucket-policy.json
```

## Deployment Process

### Backend Deployment

1. **Prepare Backend**:
   ```bash
   cd backend
   npm install
   npm run build
   ```

2. **Update Environment Variables**:
   Create `.env` file:
   ```env
   NODE_ENV=production
   PORT=5000
   CONVEX_URL=https://bright-scorpion-424.convex.cloud
   JWT_ACCESS_SECRET=tfp-boq-matching-access-secret-key-2025-secure
   JWT_REFRESH_SECRET=tfp-boq-matching-refresh-secret-key-2025-secure
   JWT_ACCESS_EXPIRY=16h
   JWT_REFRESH_EXPIRY=30d
   FRONTEND_URL=https://your-amplify-url.amplifyapp.com
   CORS_ORIGIN=https://your-amplify-url.amplifyapp.com
   AWS_S3_BUCKET=tfp-boq-uploads-prod
   COOKIE_SECURE=true
   ```

3. **Deploy to EC2**:
   ```bash
   # From local machine
   scp -i your-key.pem -r backend/* ec2-user@your-ec2-ip:/home/ec2-user/app/backend/
   
   # On EC2
   cd /home/ec2-user/app/backend
   npm install --production
   pm2 start index.js --name tfp-backend
   pm2 save
   pm2 startup
   ```

### Frontend Deployment

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Deploy The Fencing People frontend"
   git push origin main
   ```

2. **Amplify Auto-Deploy**:
   - Amplify will automatically build and deploy
   - Check build logs in Amplify Console

### Convex Database Setup

1. **Login to Convex**:
   ```bash
   npx convex login
   ```

2. **Deploy Schema**:
   ```bash
   cd /path/to/fenv5
   npx convex init  # Choose "Create new project"
   npx convex deploy
   ```

3. **Create Admin User**:
   ```bash
   cd backend
   npx tsx scripts/create-abaza-admin.ts
   ```

## Post-Deployment Checklist

- [ ] Backend health check: `curl -k https://your-ec2-ip/api/health`
- [ ] Frontend loads correctly
- [ ] Login works with admin credentials
- [ ] File upload functionality works
- [ ] Price matching processes correctly
- [ ] SSL certificates are valid
- [ ] CORS headers are correct
- [ ] Environment variables are set correctly

## Monitoring

1. **Backend Logs**:
   ```bash
   pm2 logs tfp-backend
   ```

2. **Nginx Logs**:
   ```bash
   sudo tail -f /var/log/nginx/access.log
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Application Monitoring**:
   - Set up CloudWatch for EC2
   - Monitor Amplify build logs
   - Check Convex dashboard for database stats

## Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Verify CORS_ORIGIN in backend .env
   - Check Nginx proxy headers
   - Ensure frontend URL is correct

2. **Authentication Failures**:
   - Verify JWT secrets match
   - Check Convex connection
   - Ensure user exists in database

3. **File Upload Issues**:
   - Check S3 bucket permissions
   - Verify AWS credentials
   - Check file size limits

## Important Notes

- Keep all secrets secure and never commit them to Git
- Regularly backup Convex database
- Monitor AWS costs, especially for S3 and EC2
- Update SSL certificates before expiry
- Use CloudFormation or Terraform for infrastructure as code (future improvement)