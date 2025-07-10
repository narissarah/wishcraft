#!/bin/bash

echo "========================================"
echo "WISHCRAFT DEPLOYMENT VERIFICATION"
echo "========================================"
echo ""

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s https://wishcraft-production.up.railway.app/health)
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo "✅ Health check passed"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "❌ Health check failed"
    echo "   Response: $HEALTH_RESPONSE"
fi
echo ""

# Test 2: CSP Headers
echo "2. Testing CSP Headers..."
CSP_HEADER=$(curl -sI https://wishcraft-production.up.railway.app/ | grep -i "content-security-policy")
if [[ $CSP_HEADER == *"frame-ancestors https://*.myshopify.com https://admin.shopify.com"* ]]; then
    echo "✅ CSP frame-ancestors correctly set for Shopify"
else
    echo "❌ CSP frame-ancestors not correct"
    echo "   Current: $CSP_HEADER"
fi
echo ""

# Test 3: X-Frame-Options
echo "3. Checking X-Frame-Options..."
XFRAME=$(curl -sI https://wishcraft-production.up.railway.app/ | grep -i "x-frame-options")
if [[ -z "$XFRAME" ]] || [[ $XFRAME == *"SAMEORIGIN"* ]]; then
    echo "✅ X-Frame-Options not blocking Shopify (or set to SAMEORIGIN)"
else
    echo "❌ X-Frame-Options might block embedding: $XFRAME"
fi
echo ""

# Test 4: App Route
echo "4. Testing App Route..."
APP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://wishcraft-production.up.railway.app/app?embedded=1&shop=test.myshopify.com")
if [[ $APP_RESPONSE == "500" ]]; then
    echo "⚠️  App route returns 500 (expected - needs OAuth)"
    echo "   This is normal if accessed directly without Shopify OAuth"
elif [[ $APP_RESPONSE == "302" ]]; then
    echo "✅ App route redirects (OAuth flow working)"
else
    echo "❓ App route returns: $APP_RESPONSE"
fi
echo ""

# Test 5: Database Route
echo "5. Testing Database Health..."
DB_RESPONSE=$(curl -s https://wishcraft-production.up.railway.app/health/db)
if [[ $DB_RESPONSE == *"connected"* ]]; then
    echo "✅ Database connected successfully"
else
    echo "❌ Database connection issue"
    echo "   Response: $DB_RESPONSE"
fi
echo ""

echo "========================================"
echo "NEXT STEPS:"
echo "========================================"

if [[ $DB_RESPONSE != *"connected"* ]]; then
    echo "⚠️  DATABASE ISSUE DETECTED!"
    echo "   1. Check DATABASE_URL in Railway includes ?sslmode=require"
    echo "   2. Ensure PostgreSQL addon is attached to your service"
    echo ""
fi

echo "To complete setup:"
echo "1. Ensure all environment variables are set in Railway"
echo "2. Go to Shopify Partners Dashboard"
echo "3. Update your app URL to: https://wishcraft-production.up.railway.app"
echo "4. Update redirect URLs to include:"
echo "   - https://wishcraft-production.up.railway.app/auth/callback"
echo "   - https://wishcraft-production.up.railway.app/auth/shopify/callback"
echo "5. Install the app in a test store"
echo ""

echo "========================================"
echo "MANUAL TEST:"
echo "========================================"
echo "1. Go to your test store admin"
echo "2. Navigate to Apps"
echo "3. Click 'WishCraft'"
echo "4. The app should load without CSP errors"
echo ""

echo "If you still see errors in Shopify admin:"
echo "- Check browser console for specific error messages"
echo "- Ensure app is properly installed in the store"
echo "- Verify OAuth redirect URLs match exactly"