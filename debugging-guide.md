# Debugging Guide for Upload Issues

## Issue Summary
- Small files work but large files fail with 500 error
- Progress stops at 90%
- Logs are lagging

## How to Monitor Live Logs

### Option 1: AWS CLI (Recommended)
```bash
# Open a terminal and run:
aws logs tail /aws/lambda/boq-matching-system-prod-api --follow
```

### Option 2: PowerShell Script
```powershell
# Run the monitoring script:
.\monitor-lambda-logs.ps1
```

### Option 3: AWS Console
1. Go to AWS Console > CloudWatch > Log groups
2. Find `/aws/lambda/boq-matching-system-prod-api`
3. Click on latest log stream
4. Enable "Auto-refresh"

## Common Issues and Solutions

### 1. Progress Stuck at 90%
**Cause**: The job processor caps progress at 90% during batch processing, then should jump to 98% for "calculating statistics" and 100% when complete.

**What's happening**: The `batchUpdateConvex` method is likely timing out when saving results to the database.

**Debug steps**:
1. Check logs for "Saving X results to database"
2. Look for Convex-related errors
3. Check if results are being saved

### 2. Large Files Fail with 500 Error
**Possible causes**:
- Lambda timeout (15 minutes max)
- Memory issues (3GB limit)
- Convex rate limits
- File processing errors

**Debug steps**:
1. Check Lambda logs for memory usage
2. Look for timeout messages
3. Check for "rate limit" errors

### 3. File Size Limits
- **API Gateway**: 10MB payload limit
- **Lambda**: 6MB synchronous response limit
- **Your app**: 50MB file size limit (MAX_FILE_SIZE)

## Quick Test Commands

### Test Small File (should work)
```bash
cd backend
node test-quick-upload.js
```

### Test Different File Sizes
```bash
cd backend
node test-file-sizes.js
```

### Monitor While Testing
Open two terminals:
1. Terminal 1: `aws logs tail /aws/lambda/boq-matching-system-prod-api --follow`
2. Terminal 2: Run your test

## Temporary Workarounds

### 1. For Testing, Use Local Server
```bash
cd backend
npm run dev
# Then run tests with --local flag
node test-price-matching.js --local
```

### 2. Reduce Batch Size
The system processes in batches. You could reduce batch size in the code to avoid timeouts.

### 3. Split Large Files
Process large BOQ files in smaller chunks.

## Fix Recommendations

### 1. Add Timeout Handling
The `batchUpdateConvex` method needs timeout protection:
```javascript
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Convex save timeout')), 30000)
);

await Promise.race([
  ConvexBatchProcessor.saveMatchResults(results),
  timeoutPromise
]);
```

### 2. Improve Progress Reporting
Update progress more granularly instead of jumping from 90% to 98%.

### 3. Add S3 Support
Currently using Lambda's /tmp directory. Large files should use S3.

### 4. Implement Async Processing
For large files, return immediately and process in background.

## Environment Variables to Check
```bash
# Check current Lambda config
aws lambda get-function-configuration --function-name boq-matching-system-prod-api
```

Key variables:
- `MAX_FILE_SIZE`: Currently 50MB
- `NODE_ENV`: Should be "production"
- `CONVEX_URL`: Should point to your Convex instance

## Next Steps

1. **Monitor logs while testing** to see exact error
2. **Test with progressively larger files** to find the threshold
3. **Check Convex dashboard** for rate limits or errors
4. **Consider implementing async job processing** for large files

## Emergency Fix

If you need it working immediately:
1. Reduce file size to under 100 rows
2. Use LOCAL matching method (faster)
3. Process files in batches manually