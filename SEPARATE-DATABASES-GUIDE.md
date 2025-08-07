# Why Both Projects Are Using the Same Database

## The Problem
Both MJD and The Fencing People are currently pointing to the same Convex database. Here's why:

### 1. **Shared Convex URL**
- **MJD**: Using `https://good-dolphin-454.convex.cloud` (originally)
- **The Fencing People**: Was using `https://bright-scorpion-424.convex.cloud` 
- But somewhere in the process, both ended up pointing to the same database

### 2. **Common Issues That Cause This**
- Copy-pasting configuration without updating URLs
- Environment variables not properly separated
- Hardcoded URLs in source code
- Convex deployment mixing up projects

## Complete Separation Steps

### Step 1: Update The Fencing People to New Convex URL
Run the PowerShell script:
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\abaza\OneDrive\Desktop\FENv5\UPDATE-CONVEX-URL-COMPLETE.ps1"
```

### Step 2: Deploy Convex Schema to New Database
```bash
cd C:\Users\abaza\OneDrive\Desktop\FENv5
npx convex deploy --url https://lovely-armadillo-372.convex.cloud
```

### Step 3: Initialize New Database
You'll need to:
1. Create admin user
2. Import price list data for The Fencing People
3. Set up any initial configurations

### Step 4: Update Amplify
In AWS Amplify Console, update environment variables:
```
VITE_API_URL=https://44.223.70.138/api
VITE_CONVEX_URL=https://lovely-armadillo-372.convex.cloud
```

### Step 5: Verify Separation
Check that each project has:
- Different users
- Different price lists
- Different data

## Configuration Locations to Check

### Backend (EC2)
- `/home/ec2-user/app/backend/.env` - CONVEX_URL
- `/home/ec2-user/app/backend/index.js` - Hardcoded URLs

### Frontend
- `frontend/.env` - VITE_CONVEX_URL
- `frontend/.env.production` - VITE_CONVEX_URL
- `amplify.yml` - Environment variables

### Source Code
- `backend/src/config/convex.ts`
- Any hardcoded URLs in TypeScript/JavaScript files

## Verification Checklist

After separation, verify:
- [ ] MJD uses its original Convex URL
- [ ] The Fencing People uses the new URL (lovely-armadillo-372)
- [ ] Login works with different users on each system
- [ ] Price lists are separate
- [ ] No data crossover between projects

## Database URLs Summary

### MJD (Original Project)
- Convex: `https://good-dolphin-454.convex.cloud`
- Backend: `https://13.218.146.247/api`
- Frontend: `https://main.d3j084kic0l1ff.amplifyapp.com`

### The Fencing People (New Project)
- Convex: `https://lovely-armadillo-372.convex.cloud` ✅ NEW
- Backend: `https://44.223.70.138/api`
- Frontend: `https://main.d2devufp71564t.amplifyapp.com`