# EC2 Deployment Complete - Action Required

## ✅ What's Done:
1. EC2 instance is running (t3.micro - ~$8/month)
2. Node.js 16 installed successfully
3. Application code deployed and built
4. PM2 process manager configured
5. Nginx web server configured
6. Application is attempting to start

## ❌ Application Crashed - Missing Convex Credentials

The application is failing to start because the Convex credentials are missing. The error shows that the CONVEX_URL needs to be at least 32 characters (it's currently set to a placeholder).

## 🔧 Required Action:

### 1. SSH into your EC2 instance:
```bash
ssh -i boq-key-202507161911.pem ec2-user@13.218.146.247
```

### 2. Edit the .env file:
```bash
cd /home/ec2-user/app
nano .env
```

### 3. Update these values with your real Convex credentials:
```
CONVEX_URL=<your-actual-convex-url>
CONVEX_DEPLOY_KEY=<your-actual-convex-deploy-key>
JWT_SECRET=<generate-a-random-string>
JWT_ACCESS_SECRET=<generate-another-random-string>
JWT_REFRESH_SECRET=<generate-another-random-string>
```

To get your Convex credentials:
1. Go to https://dashboard.convex.dev/
2. Select your project
3. Go to Settings > URL & Deploy Key
4. Copy the values

### 4. Save and exit:
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

### 5. Restart the application:
```bash
pm2 restart all
```

### 6. Check if it's running:
```bash
pm2 status
pm2 logs --lines 20
```

### 7. Test the application:
```bash
curl http://localhost:5000/api/health
```

## 📊 Monitoring:

- View logs: `pm2 logs`
- Check status: `pm2 status`
- Monitor resources: `pm2 monit`
- View detailed info: `pm2 describe boq-app`

## 🌐 Access Your Application:

Once you've updated the .env file and restarted:
- Application URL: http://13.218.146.247
- API endpoint: http://13.218.146.247/api

## 🔍 Troubleshooting:

If the app still crashes after updating .env:
1. Check logs: `pm2 logs --lines 50`
2. Verify MongoDB connection if you have one configured
3. Check if all required environment variables are set
4. Ensure Convex project is active and credentials are correct

## 💰 Cost Information:
- EC2 t3.micro: ~$8/month
- Data transfer: First 100GB free/month
- Storage: 30GB included

Your EC2 deployment is ready! Just add your Convex credentials to get it running.