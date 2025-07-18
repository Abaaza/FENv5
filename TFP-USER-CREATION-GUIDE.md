# The Fencing People - Admin User Creation Guide

## Current Issue
The backend is returning "Internal server error" when trying to create or login users. This is likely due to:
1. Convex database connection issues
2. Missing Convex schema deployment
3. API key configuration issues

## Manual Steps to Create Admin User

### Option 1: Use Convex Dashboard (Recommended)
1. Go to https://dashboard.convex.dev/
2. Sign in and select the project: `bright-scorpion-424`
3. Go to the "Data" tab
4. Find the "users" table
5. Click "Add Document"
6. Add the following data:
```json
{
  "email": "abaza@tfp.com",
  "password": "$2a$10$YourHashedPasswordHere",
  "name": "Abaza Admin",
  "company": "The Fencing People",
  "role": "admin",
  "isActive": true,
  "createdAt": "2025-07-18T13:00:00.000Z"
}
```

Note: You'll need to generate a bcrypt hash for "abaza123". You can use online tools or run:
```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('abaza123',10).then(h=>console.log(h))"
```

### Option 2: Fix Backend Connection
1. SSH into the server:
```bash
ssh -i "C:\Users\abaza\Downloads\tfp-boq-key.pem" ec2-user@54.90.3.22
```

2. Check Convex connection:
```bash
cd /home/ec2-user/app/backend
pm2 logs tfp-backend --lines 100 | grep -i "convex\|error"
```

3. Verify environment variables:
```bash
cat .env | grep CONVEX_URL
```

4. Restart backend:
```bash
pm2 restart tfp-backend
pm2 logs tfp-backend --lines 50
```

### Option 3: Use Convex CLI
1. In your local FENv5 directory:
```bash
cd convex
npx convex env set CONVEX_URL https://bright-scorpion-424.convex.cloud
npx convex deploy
```

2. Create a user function in `convex/createAdmin.ts`:
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

export const createAdmin = mutation({
  handler: async (ctx) => {
    const hashedPassword = await bcrypt.hash("abaza123", 10);
    
    const userId = await ctx.db.insert("users", {
      email: "abaza@tfp.com",
      password: hashedPassword,
      name: "Abaza Admin",
      company: "The Fencing People",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    
    return userId;
  },
});
```

3. Run the function:
```bash
npx convex run createAdmin
```

## Testing the User
Once created, test login:
```bash
curl -X POST http://54.90.3.22:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"abaza@tfp.com","password":"abaza123"}'
```

## Troubleshooting
If login still fails:
1. Check if the Convex schema includes the users table
2. Verify the password hashing algorithm matches
3. Check backend logs for specific error messages
4. Ensure CORS is properly configured for your frontend domain