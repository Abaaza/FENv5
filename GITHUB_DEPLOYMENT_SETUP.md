# GitHub Actions Deployment Setup

This guide will help you set up GitHub Actions for automatic deployment of your BOQ Matching System.

## Prerequisites

1. A GitHub repository with your code
2. AWS account with appropriate permissions
3. Existing Lambda function and Amplify app

## Step 1: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

### Required Secrets

1. **AWS_ACCESS_KEY_ID**
   - Your AWS Access Key ID
   - Get from AWS IAM console

2. **AWS_SECRET_ACCESS_KEY**
   - Your AWS Secret Access Key
   - Get from AWS IAM console

3. **JWT_SECRET**
   - Value: `8aApS-a1qfwfZOFai7QwrRq10XwhbCgbsxECg_PWV97agiiLwb_GkB_-ZCsMeKe3`

4. **JWT_REFRESH_SECRET**
   - Value: `cSmmxIRoS2JIGaY6v_vF2bl309IdlqNdOW15PasVAURjuI7QkqGzqSwM_HNxDk-R`

5. **CONVEX_URL**
   - Value: `https://good-dolphin-454.convex.cloud`

6. **FRONTEND_URL**
   - Value: `https://main.d3j084kic0l1ff.amplifyapp.com`

## Step 2: AWS IAM Permissions

Ensure your AWS user has the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:us-east-1:*:function:boq-matching-system-prod-api"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mjd-boq-uploads-prod",
        "arn:aws:s3:::mjd-boq-uploads-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "amplify:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Step 3: Enable GitHub Actions

1. Push the `.github/workflows` folder to your repository
2. GitHub Actions will automatically detect the workflows

## Step 4: Deploy

### Automatic Deployment
- Every push to `main` branch will trigger deployment
- Backend changes only deploy when files in `backend/` are modified

### Manual Deployment
1. Go to Actions tab in your GitHub repository
2. Select "Deploy Full Stack" workflow
3. Click "Run workflow"
4. Choose what to deploy:
   - Deploy Backend: Yes/No
   - Deploy Frontend: Yes/No
5. Click "Run workflow"

## Step 5: Monitor Deployment

1. Go to Actions tab to see deployment progress
2. Click on the running workflow to see detailed logs
3. Check the test results at the end

## Workflows Available

### 1. Deploy Lambda (`deploy-lambda.yml`)
- Deploys only the backend to AWS Lambda
- Triggered on changes to `backend/` folder
- Runs tests after deployment

### 2. Deploy Full Stack (`deploy-full-stack.yml`)
- Deploys both backend and frontend
- Can be triggered manually with options
- Includes health checks

## Troubleshooting

### Deployment Fails
1. Check GitHub Actions logs for errors
2. Verify all secrets are set correctly
3. Ensure AWS credentials have proper permissions

### Lambda Not Working
1. Check CloudWatch logs in AWS console
2. Verify environment variables in Lambda console
3. Test with the provided test scripts

### Frontend Not Updating
1. Check Amplify console for build logs
2. Clear browser cache
3. Verify Amplify app is connected to correct repository

## Local Testing Before Deployment

```bash
# Test backend locally
cd backend
npm run dev

# In another terminal
node test-price-matching.js --local

# Test Lambda endpoint
node test-lambda.js
```

## Support

If you encounter issues:
1. Check the workflow logs in GitHub Actions
2. Review AWS CloudWatch logs for Lambda errors
3. Ensure all environment variables are set correctly