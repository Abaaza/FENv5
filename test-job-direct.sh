#!/bin/bash

JOB_ID="j97fx6c2kkb1txz3yffgwvy99s7kxnak"

echo "Testing different approaches to find job $JOB_ID..."

# 1. Check if there's a health endpoint that might give us info
echo -e "\n1. Checking health endpoint:"
curl -s "http://localhost:5000/api/health" | jq '.'

# 2. Try to access monitoring endpoints (might not require auth)
echo -e "\n2. Checking monitoring endpoints:"
curl -s "http://localhost:5000/api/monitoring/jobs" 2>/dev/null | jq '.' || echo "Monitoring endpoint not accessible"

# 3. Check the main app routes
echo -e "\n3. Checking available API routes:"
curl -s "http://localhost:5000/api" | head -20

# 4. Try different auth endpoints to understand the auth flow
echo -e "\n4. Testing auth endpoints:"
curl -s -X POST "http://localhost:5000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{}' 2>&1 | jq '.' || echo "Register endpoint response"

# 5. Check if there's a public job status endpoint
echo -e "\n5. Trying public job endpoints:"
curl -s "http://localhost:5000/api/public/jobs/$JOB_ID" 2>/dev/null | jq '.' || echo "No public job endpoint"

# 6. Check process info to see if job is being processed
echo -e "\n6. Checking if job is mentioned in process:"
ps aux | grep -i "$JOB_ID" | grep -v grep || echo "Job ID not found in running processes"

# 7. Check temp uploads directory for job-related files
echo -e "\n7. Checking temp uploads for job files:"
ls -la /home/ec2-user/app/backend/temp_uploads/ | grep -i "${JOB_ID:0:10}" || echo "No files found for job"

# 8. Check if job ID appears in any log files
echo -e "\n8. Searching for job in all log files:"
find /home/ec2-user/app/backend -name "*.log" -type f 2>/dev/null | xargs grep -l "$JOB_ID" 2>/dev/null || echo "Job ID not found in log files"

# 9. Check environment to understand setup
echo -e "\n9. Backend environment info:"
cd /home/ec2-user/app/backend && node -e "
require('dotenv').config();
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CONVEX_URL:', process.env.CONVEX_URL);
console.log('Auth disabled?:', process.env.DISABLE_AUTH);
"