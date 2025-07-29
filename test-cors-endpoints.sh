#!/bin/bash

echo "Testing CORS on different endpoints..."
echo "======================================"

echo -e "\n1. Testing CloudFront endpoint (api-tfp.braunwell.io):"
echo "--------------------------------------------------------"
curl -I -X OPTIONS https://api-tfp.braunwell.io/api/auth/login \
  -H "Origin: https://tfp.braunwell.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>&1 | grep -E "(HTTP|Access-Control|access-control)"

echo -e "\n2. Testing origin endpoint directly (origin-tfp.braunwell.io):"
echo "--------------------------------------------------------"
curl -I -X OPTIONS http://origin-tfp.braunwell.io/api/auth/login \
  -H "Origin: https://tfp.braunwell.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>&1 | grep -E "(HTTP|Access-Control|access-control)"

echo -e "\n3. Testing direct IP (54.90.3.22):"
echo "--------------------------------------------------------"
curl -I -X OPTIONS https://54.90.3.22/api/auth/login -k \
  -H "Origin: https://tfp.braunwell.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>&1 | grep -E "(HTTP|Access-Control|access-control)"

echo -e "\nDone testing!"