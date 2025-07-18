#!/bin/bash

JOB_ID="j97fx6c2kkb1txz3yffgwvy99s7kxnak"

echo "Checking job $JOB_ID in Convex database..."

# First, try to authenticate
echo "Attempting authentication..."
TOKEN=$(curl -s -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mjd.com","password":"admin123"}' | jq -r '.token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to authenticate. Checking if auth is required..."
  
  # Try without auth first
  RESPONSE=$(curl -s -X GET "http://localhost:5000/api/jobs/$JOB_ID/status" \
    -H "Content-Type: application/json")
  
  echo "Response without auth: $RESPONSE"
else
  echo "Authentication successful!"
  
  # Try with auth
  RESPONSE=$(curl -s -X GET "http://localhost:5000/api/jobs/$JOB_ID/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Response with auth: $RESPONSE"
fi

# Pretty print if we have jq
if command -v jq &> /dev/null; then
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
  echo "$RESPONSE"
fi

# Also check the Convex database directly if possible
echo -e "\nChecking Convex database directly..."
curl -s -X GET "http://localhost:5000/api/jobs/$JOB_ID/logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq '.' 2>/dev/null || echo "Could not fetch logs"