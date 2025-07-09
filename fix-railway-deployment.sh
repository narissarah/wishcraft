#!/bin/bash
# Railway Deployment Fix Script for WishCraft
# This script fixes all identified deployment issues

echo "🚀 WishCraft Railway Deployment Fix"
echo "==================================="

# Step 1: Remove conflicting Railway configuration
echo "1️⃣ Removing conflicting railway.json..."
if [ -f "railway.json" ]; then
    mv railway.json railway.json.backup
    echo "✅ Moved railway.json to railway.json.backup"
else
    echo "✅ No railway.json found (already removed)"
fi

# Step 2: Clean and rebuild dependencies
echo -e "\n2️⃣ Cleaning and rebuilding dependencies..."
rm -rf node_modules package-lock.json
echo "✅ Removed node_modules and package-lock.json"

# Step 3: Install dependencies fresh
echo -e "\n3️⃣ Installing dependencies (this may take a few minutes)..."
npm install
echo "✅ Dependencies installed"

# Step 4: Generate Prisma client
echo -e "\n4️⃣ Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"

# Step 5: Build locally to verify
echo -e "\n5️⃣ Running test build..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed - please fix errors before deploying"
    exit 1
fi

# Step 6: Verify environment variables
echo -e "\n6️⃣ Checking Railway environment variables..."
required_vars=(
    "DATABASE_URL"
    "SHOPIFY_API_KEY"
    "SHOPIFY_API_SECRET"
    "SHOPIFY_APP_URL"
    "SESSION_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if railway variables | grep -q "^$var"; then
        echo "✅ $var is set"
    else
        missing_vars+=($var)
        echo "❌ $var is missing"
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "\n⚠️  Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    echo -e "\nSet them using:"
    echo "railway variables --set \"VAR_NAME=value\""
    exit 1
fi

# Step 7: Final checklist
echo -e "\n7️⃣ Pre-deployment checklist:"
echo "✅ Conflicting railway.json removed"
echo "✅ Dependencies freshly installed"
echo "✅ Prisma client generated"
echo "✅ Build successful"
echo "✅ Environment variables verified"

echo -e "\n✨ Ready to deploy! Run:"
echo "railway up"

# Optional: Auto-deploy
read -p "Deploy now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n🚀 Deploying to Railway..."
    railway up
else
    echo -e "\n👍 Run 'railway up' when you're ready to deploy"
fi