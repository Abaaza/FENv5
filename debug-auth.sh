#!/bin/bash

echo "Testing authentication endpoint..."

# Test if the endpoint exists
echo "1. Testing if auth endpoint exists:"
curl -I -X POST "http://localhost:5000/api/auth/login" 2>&1 | head -10

echo -e "\n2. Testing authentication with verbose output:"
RESPONSE=$(curl -v -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mjd.com","password":"admin123"}' 2>&1)

echo "$RESPONSE" | grep -E "(HTTP|{|error|token)" 

echo -e "\n3. Testing with different endpoint variations:"
# Try without /api prefix
curl -s -X POST "http://localhost:5000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mjd.com","password":"admin123"}'

echo -e "\n\n4. Checking available routes:"
curl -s "http://localhost:5000/" | head -20

echo -e "\n5. Direct job check without auth (to see the exact error):"
curl -v "http://localhost:5000/api/jobs/j97fx6c2kkb1txz3yffgwvy99s7kxnak/status" 2>&1 | grep -E "(HTTP|{|error)"