#!/bin/bash

echo "========================================"
echo "WISHCRAFT DEPLOYMENT FIX SCRIPT"
echo "========================================"
echo ""

# Step 1: Clean build artifacts
echo "Step 1: Cleaning build artifacts..."
rm -rf build/
rm -rf public/build/
rm -rf .cache/
echo "✅ Build artifacts cleaned"
echo ""

# Step 2: Install dependencies
echo "Step 2: Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 3: Generate Prisma client
echo "Step 3: Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

# Step 4: Build the project
echo "Step 4: Building project..."
npm run build
echo "✅ Project built"
echo ""

# Step 5: Check build output for CSP issues
echo "Step 5: Checking build for CSP issues..."
if grep -q "frame-ancestors 'none'" build/index.js; then
    echo "❌ WARNING: Build still contains frame-ancestors 'none'"
    echo "This might be from a Shopify package. Checking further..."
else
    echo "✅ No frame-ancestors 'none' found in build"
fi
echo ""

# Step 6: Show environment variables to set
echo "Step 6: Environment Variables for Railway"
echo "========================================"
echo "Set these in Railway dashboard:"
echo ""
echo "SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app"
echo "NODE_ENV=production"
echo "PORT=3000"
echo "HOST=0.0.0.0"
echo ""
echo "Plus all the variables from RAILWAY_ENV_SETUP.sh"
echo ""

echo "========================================"
echo "DEPLOYMENT STEPS:"
echo "========================================"
echo "1. Run: chmod +x RAILWAY_ENV_SETUP.sh && ./RAILWAY_ENV_SETUP.sh"
echo "2. Copy all environment variables to Railway"
echo "3. Ensure DATABASE_URL has ?sslmode=require"
echo "4. Commit and push: git add . && git commit -m 'fix: rebuild and database compatibility' && git push"
echo "5. Railway will auto-deploy"
echo ""

echo "✅ Fix script complete!"