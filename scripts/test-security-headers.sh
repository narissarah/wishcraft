#!/bin/bash
# Test security headers

URL=${1:-http://localhost:3000}

echo "Testing security headers for $URL"
echo "================================"

curl -s -I "$URL" | grep -E "X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Strict-Transport-Security|Content-Security-Policy|Permissions-Policy"

echo ""
echo "Full headers:"
curl -s -I "$URL"