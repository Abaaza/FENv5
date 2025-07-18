# Fix Certificate Trust Issue

## The Problem
Your browser is blocking the HTTPS request because it doesn't trust the self-signed certificate. The error `ERR_CERT_AUTHORITY_INVALID` means the certificate wasn't issued by a trusted authority.

## Solution: Manually Accept the Certificate

### Step 1: Visit the API Directly
1. Open a new browser tab
2. Go to: **https://13.218.146.247/api/health**
3. You should see a certificate warning page

### Step 2: Accept the Certificate
**Chrome:**
- Click "Advanced"
- Click "Proceed to 13.218.146.247 (unsafe)"

**Firefox:**
- Click "Advanced"
- Click "Accept the Risk and Continue"

**Edge:**
- Click "Advanced"
- Click "Continue to 13.218.146.247 (unsafe)"

**Safari:**
- Click "Show Details"
- Click "visit this website"

### Step 3: Verify It's Working
After accepting the certificate, you should see:
```json
{"status":"ok","message":"BOQ Matching API is running"}
```

### Step 4: Return to Your App
Now go back to https://main.d3j084kic0l1ff.amplifyapp.com and try logging in again. It should work!

## Alternative Solution: Direct Browser Navigation

If the above doesn't work, try these URLs in order:
1. https://13.218.146.247/ (accept certificate)
2. https://13.218.146.247/api/health (should show JSON)
3. Then try your app again

## Why This Happens
- Self-signed certificates aren't trusted by browsers by default
- Browsers block "mixed content" and untrusted certificates for security
- Once you manually trust the certificate, the browser remembers your choice

## Important Notes
- You need to do this in each browser you use
- The trust is temporary - may need to repeat after browser updates
- This is why production apps use real SSL certificates from trusted authorities