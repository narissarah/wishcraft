#!/bin/bash

# Railway Environment Variables Setup Script
# This script outputs the exact environment variables you need to set in Railway

echo "========================================"
echo "RAILWAY ENVIRONMENT VARIABLES TO SET"
echo "========================================"
echo ""
echo "Copy and paste these into Railway dashboard:"
echo ""

# Read values from .env file
source .env

echo "# Core Shopify Configuration"
echo "SHOPIFY_API_KEY=ac161e228a6b078fcdd3fa14586ded14"
echo "SHOPIFY_API_SECRET=f5e5f2bb3304ecacdf420e7b5ca68595"
echo "SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app"
echo "SHOPIFY_WEBHOOK_SECRET=hfvoIrkf6LUJdvl//9VwjBGyHyjT74fPpCK4enK5Vfo="
echo "SCOPES=$SHOPIFY_SCOPES"
echo ""

echo "# Database (Railway will auto-set DATABASE_URL)"
echo "# Make sure your DATABASE_URL includes: ?sslmode=require"
echo ""

echo "# Security Keys"
echo "SESSION_SECRET=$SESSION_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "HASH_SALT=$HASH_SALT"
echo ""

echo "# Environment"
echo "NODE_ENV=production"
echo "PORT=3000"
echo "HOST=0.0.0.0"
echo ""

echo "# Optional but recommended"
echo "DEBUG=false"
echo "LOG_LEVEL=info"
echo ""

echo "========================================"
echo "IMPORTANT NOTES:"
echo "========================================"
echo "1. The DATABASE_URL will be automatically set by Railway"
echo "2. Make sure to use the SECOND webhook secret (ending with Vfo=)"
echo "3. The SHOPIFY_APP_URL must match your Railway URL exactly"
echo "4. After setting these, redeploy your app"
echo ""
echo "To set these in Railway:"
echo "1. Go to your Railway project"
echo "2. Click on your service"
echo "3. Go to Variables tab"
echo "4. Add each variable above"
echo "5. Click 'Deploy' to apply changes"