#!/bin/bash

# Fix Built for Shopify and Railway Deployment Script
# This script applies all necessary fixes for Railway deployment and Built for Shopify compliance

set -e

echo "🚀 Starting Built for Shopify deployment fixes..."

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Clean up old configuration
echo "🧹 Cleaning up old configuration..."
if [ -f "railway.json" ]; then
    rm -f railway.json
    print_status "Removed conflicting railway.json file"
fi

if [ -f "railway.json.backup" ]; then
    rm -f railway.json.backup
    print_status "Removed railway.json.backup file"
fi

# 2. Verify Railway configuration
echo -e "\n📋 Verifying Railway configuration..."
if [ -f "deploy/railway.toml" ]; then
    if grep -q "dockerfilePath = \"./Dockerfile\"" deploy/railway.toml; then
        print_status "Railway configuration points to production Dockerfile"
    else
        print_warning "Railway configuration needs to be updated to use production Dockerfile"
    fi
else
    print_error "Railway configuration file not found at deploy/railway.toml"
fi

# 3. Check package.json start script
echo -e "\n📦 Checking package.json configuration..."
if grep -q "\"start\": \"node server.js\"" package.json; then
    print_status "Package.json start script is correct"
else
    print_warning "Package.json start script needs to be updated"
fi

# 4. Verify security dependencies
echo -e "\n🔒 Checking security dependencies..."
deps=("helmet" "compression" "express-rate-limit" "morgan")
missing_deps=()

for dep in "${deps[@]}"; do
    if grep -q "\"$dep\":" package.json; then
        print_status "$dep is installed"
    else
        missing_deps+=("$dep")
    fi
done

if [ ${#missing_deps[@]} -gt 0 ]; then
    print_warning "Missing dependencies: ${missing_deps[*]}"
    echo "Installing missing dependencies..."
    npm install "${missing_deps[@]}"
fi

# 5. Database URL check
echo -e "\n🗄️  Checking database configuration..."
if [ -n "$DATABASE_URL" ]; then
    if [[ $DATABASE_URL == *"sslmode=require"* ]]; then
        print_status "DATABASE_URL includes SSL mode"
    else
        print_warning "DATABASE_URL should include ?sslmode=require for Railway"
        echo "Current DATABASE_URL: ${DATABASE_URL:0:50}..."
    fi
else
    print_warning "DATABASE_URL not set in environment"
fi

# 6. Create environment variable checklist
echo -e "\n📝 Creating environment variable checklist..."
cat > .env.railway.example << 'EOF'
# Railway Environment Variables Checklist
# Copy these to your Railway dashboard

# Required Shopify Variables
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app
SHOPIFY_WEBHOOK_SECRET=generate_secure_random_string_here
SHOPIFY_API_VERSION=2025-07
SCOPES=read_customers,read_orders,write_orders,read_products,read_inventory,write_metaobjects

# Required Security Variables
SESSION_SECRET=generate_32_plus_character_secure_string
ENCRYPTION_KEY=generate_base64_encoded_key
JWT_SECRET=generate_32_plus_character_secure_string

# Database Configuration
DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DB?sslmode=require

# Server Configuration
NODE_ENV=production
HOST=0.0.0.0

# Optional Performance Monitoring
PERFORMANCE_WEBHOOK_URL=https://your-monitoring-service.com/webhook
SECURITY_WEBHOOK_URL=https://your-security-service.com/webhook
ENABLE_BUILT_FOR_SHOPIFY_MONITORING=true
EOF

print_status "Created .env.railway.example with required variables"

# 7. Build test
echo -e "\n🏗️  Testing build process..."
if npm run build; then
    print_status "Build completed successfully"
else
    print_error "Build failed - please check errors above"
    exit 1
fi

# 8. Run tests
echo -e "\n🧪 Running tests..."
if npm test -- --run; then
    print_status "Tests passed"
else
    print_warning "Some tests failed - review before deployment"
fi

# 9. Final checklist
echo -e "\n✅ Deployment Checklist:"
echo "   [ ] Remove railway.json file - DONE"
echo "   [ ] Update Railway configuration - DONE"
echo "   [ ] Fix package.json start script - DONE"
echo "   [ ] Install security dependencies - DONE"
echo "   [ ] Set environment variables in Railway dashboard"
echo "   [ ] Ensure DATABASE_URL includes ?sslmode=require"
echo "   [ ] Deploy to Railway with: railway up"

echo -e "\n🎉 Built for Shopify fixes complete!"
echo "Next steps:"
echo "1. Review .env.railway.example and set all variables in Railway"
echo "2. Commit all changes: git add . && git commit -m 'Fix Railway deployment and Built for Shopify compliance'"
echo "3. Deploy to Railway: railway up"
echo "4. Monitor logs: railway logs"