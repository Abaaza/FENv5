@echo off
echo Building project...
call npm run build

echo Creating deployment package...
if exist lambda-deploy rmdir /s /q lambda-deploy
mkdir lambda-deploy

echo Copying built files...
xcopy /E /I dist lambda-deploy\dist
copy handler-lambda.js lambda-deploy\
copy package.json lambda-deploy\
copy serverless.yml lambda-deploy\

echo Installing production dependencies...
cd lambda-deploy
call npm install --production --no-audit --no-fund

echo Deploying to AWS Lambda...
call serverless deploy

cd ..
echo Deployment complete!