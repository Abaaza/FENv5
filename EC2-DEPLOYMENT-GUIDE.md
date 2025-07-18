# EC2 Deployment Guide for BOQ Matching System

This guide will help you deploy the BOQ Matching System on EC2, which removes all Lambda/API Gateway limitations and allows processing of files with 2000+ items.

## Prerequisites

1. **AWS CLI installed and configured**
   ```bash
   aws --version
   aws configure
   ```

2. **Node.js and npm** (for building frontend)
   ```bash
   node --version
   npm --version
   ```

3. **Git Bash or WSL** (on Windows) to run the shell scripts

## Step 1: Build Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

## Step 2: Set Up EC2 Instance

```bash
# Make scripts executable
chmod +x deploy-ec2.sh deploy-to-ec2.sh manage-ec2.sh

# Create and launch EC2 instance
./deploy-ec2.sh
```

This will:
- Create an EC2 t3.medium instance (2 vCPU, 4GB RAM)
- Set up security groups for HTTP/HTTPS access
- Install Node.js, PM2, and Nginx
- Create SSH key pair (saved as `boq-matching-key.pem`)

## Step 3: Deploy Application

After the instance is ready (check the output for the public IP):

```bash
# Deploy to EC2 (replace with your instance IP)
./deploy-to-ec2.sh YOUR_EC2_PUBLIC_IP
```

## Step 4: Configure Environment Variables

SSH into your instance and set up the environment:

```bash
# SSH into EC2
ssh -i boq-matching-key.pem ec2-user@YOUR_EC2_PUBLIC_IP

# Edit environment variables
nano /home/ec2-user/app/.env
```

Add your credentials:
```env
# Convex Database
CONVEX_URL=your_convex_url_here
CONVEX_DEPLOY_KEY=your_convex_deploy_key_here

# JWT Secrets (generate random strings)
JWT_SECRET=your_jwt_secret_here
JWT_ACCESS_SECRET=your_jwt_access_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

# AWS (optional, for S3 file storage)
AWS_ACCESS_KEY_ID=your_aws_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_here
```

Save and restart the application:
```bash
pm2 restart all
pm2 save
```

## Step 5: Access Your Application

Your application is now available at:
- **Frontend**: `http://YOUR_EC2_PUBLIC_IP`
- **API**: `http://YOUR_EC2_PUBLIC_IP/api`

## Management Commands

```bash
# Check instance status
./manage-ec2.sh status

# View application logs
./manage-ec2.sh logs

# SSH into instance
./manage-ec2.sh ssh

# Deploy updates
./manage-ec2.sh update

# Restart application
./manage-ec2.sh restart

# Stop instance (to save costs)
./manage-ec2.sh stop

# Start instance
./manage-ec2.sh start

# View estimated costs
./manage-ec2.sh costs
```

## Performance Benefits

With EC2 deployment:
- ✅ **No timeout limits** - Can process for hours if needed
- ✅ **Handle 2000+ items** easily
- ✅ **4GB RAM** for large file processing
- ✅ **Multi-core processing** with PM2 cluster mode
- ✅ **Direct control** over the server

## Cost Optimization

- **Development**: Stop the instance when not in use (`./manage-ec2.sh stop`)
- **Production**: Consider Reserved Instances for 50-70% savings
- **Auto-scaling**: Set up Auto Scaling Groups for variable load

## Troubleshooting

1. **Can't connect to instance**
   - Check security group allows your IP
   - Ensure instance is running: `./manage-ec2.sh status`

2. **Application not starting**
   - Check logs: `pm2 logs`
   - Verify .env file is configured
   - Check Node.js version: `node --version`

3. **502 Bad Gateway**
   - Application may be starting, wait 30 seconds
   - Check PM2 status: `pm2 status`
   - Review nginx logs: `sudo tail -f /var/log/nginx/error.log`

## Security Recommendations

1. **Restrict SSH access** in security group to your IP only
2. **Use HTTPS** with Let's Encrypt: `sudo certbot --nginx`
3. **Regular updates**: `sudo yum update -y`
4. **Monitor logs** regularly
5. **Set up CloudWatch** alarms for CPU/disk usage

## Next Steps

1. Set up domain name with Route 53
2. Configure HTTPS with SSL certificate
3. Set up monitoring with CloudWatch
4. Configure backups for data persistence
5. Consider RDS for production database needs