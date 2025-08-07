# Convex Deployment Guide - The Fencing People

## Current Issue
The Convex CLI is still trying to deploy to the old URL (bright-scorpion-424) instead of the new URL (lovely-armadillo-372).

## Solution Steps

### 1. Clear Old Configuration
```powershell
cd C:\Users\abaza\OneDrive\Desktop\FENv5
Remove-Item -Path ".convex" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "auth.config.json" -Force -ErrorAction SilentlyContinue
```

### 2. Login to Convex
```bash
npx convex login
```
This will open a browser window for authentication.

### 3. Deploy to New Project

**Option A: If you have access to the lovely-armadillo-372 project**
```bash
npx convex deploy --prod
```
When prompted, select the project that corresponds to `lovely-armadillo-372`.

**Option B: If you need to create a new project**
```bash
npx convex init
```
1. Select "Create a new project"
2. Name it "the-fencing-people"
3. After creation, update the .env.local file with the new URL

### 4. Deploy Schema
```bash
npx convex deploy
```

### 5. Update All Configuration Files

The following files need to have the correct Convex URL:
- `.env.local` (already updated to lovely-armadillo-372)
- `frontend/.env`
- `frontend/.env.production`
- `backend/.env` (on EC2)
- `amplify.yml`

### 6. Restart Backend on EC2
```bash
ssh -i "C:\Users\abaza\Downloads\tfp-boq-key.pem" ec2-user@44.223.70.138
pm2 restart tfp-backend
```

### 7. Update Amplify
In AWS Amplify Console:
1. Go to Environment Variables
2. Update: `VITE_CONVEX_URL=https://lovely-armadillo-372.convex.cloud`
3. Redeploy the app

## Verification
Run the verification script:
```powershell
powershell -File VERIFY-CONVEX-DEPLOYMENT.ps1
```

## Creating Admin User
After deployment, create the admin user:
1. Use the Convex dashboard: https://dashboard.convex.dev
2. Or run the create-admin-user.js script

## Important URLs
- **New Convex URL**: https://lovely-armadillo-372.convex.cloud
- **Old URL to remove**: https://bright-scorpion-424.convex.cloud
- **EC2 Backend**: http://44.223.70.138:5000
- **Amplify Frontend**: https://main.d2devufp71564t.amplifyapp.com

## Troubleshooting

### If deployment still uses old URL:
1. Check if there's a hidden `.convex` folder with cached config
2. Look for `auth.config.json` in your home directory
3. Try logging out and back in: `npx convex logout` then `npx convex login`

### If you can't access the new project:
1. Make sure you're logged in with the correct account
2. Ask the project owner to add you as a collaborator
3. Create a completely new project if needed