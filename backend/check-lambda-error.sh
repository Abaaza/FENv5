#!/bin/bash

# Script to check AWS Lambda logs for errors
echo "Checking AWS Lambda logs for price-matching errors..."

# Get the function name
FUNCTION_NAME="boq-matching-system-prod-api"

# Get the latest log stream
echo "Getting latest log stream..."
LOG_GROUP="/aws/lambda/$FUNCTION_NAME"

# Get logs from the last hour
START_TIME=$(($(date +%s) - 3600))000
END_TIME=$(date +%s)000

echo "Fetching logs from the last hour..."
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $START_TIME \
  --end-time $END_TIME \
  --filter-pattern "ERROR" \
  --query 'events[*].[timestamp,message]' \
  --output text | tail -20

echo ""
echo "Checking for 500 errors specifically..."
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $START_TIME \
  --end-time $END_TIME \
  --filter-pattern "500" \
  --query 'events[*].[timestamp,message]' \
  --output text | tail -10

echo ""
echo "Checking for upload-and-match endpoint errors..."
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $START_TIME \
  --end-time $END_TIME \
  --filter-pattern "upload-and-match" \
  --query 'events[*].[timestamp,message]' \
  --output text | tail -10