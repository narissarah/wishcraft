#!/bin/bash
# Railway Debugging Helper Script
# This script helps debug common Railway deployment issues

echo "🚂 Railway Debugging Helper"
echo "=========================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check environment variable
check_env_var() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ $var_name is not set${NC}"
        return 1
    else
        if [[ "$var_name" == *"SECRET"* ]] || [[ "$var_name" == *"KEY"* ]] || [[ "$var_name" == *"DATABASE_URL"* ]]; then
            echo -e "${GREEN}✅ $var_name is set (length: ${#var_value})${NC}"
        else
            echo -e "${GREEN}✅ $var_name = $var_value${NC}"
        fi
        return 0
    fi
}

# 1. Check Required Environment Variables
echo "1. Checking Environment Variables"
echo "---------------------------------"
REQUIRED_VARS=(
    "DATABASE_URL"
    "SHOPIFY_APP_URL"
    "SHOPIFY_API_KEY"
    "SHOPIFY_API_SECRET"
    "SCOPES"
    "PORT"
    "NODE_ENV"
)

ENV_MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
    if ! check_env_var "$var"; then
        ENV_MISSING=1
    fi
done

if [ $ENV_MISSING -eq 1 ]; then
    echo -e "\n${YELLOW}⚠️  Some environment variables are missing${NC}"
    echo "Make sure to set them in Railway's Variables section"
fi

# 2. Check Node.js and npm versions
echo -e "\n2. Node.js Environment"
echo "---------------------"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Current directory: $(pwd)"
echo "User: $(whoami)"

# 3. Check Prisma setup
echo -e "\n3. Prisma Client Check"
echo "---------------------"
if [ -d "node_modules/.prisma/client" ]; then
    echo -e "${GREEN}✅ Prisma client directory exists${NC}"
    echo "Files in .prisma/client:"
    ls -la node_modules/.prisma/client/ | grep -E "(index|engine)"
else
    echo -e "${RED}❌ Prisma client not generated${NC}"
    echo "Generating Prisma client..."
    npx prisma generate
fi

# 4. Check build output
echo -e "\n4. Build Output Check"
echo "--------------------"
if [ -d "build" ]; then
    echo -e "${GREEN}✅ Build directory exists${NC}"
    echo "Build directory size: $(du -sh build | cut -f1)"
    if [ -f "build/index.js" ]; then
        echo -e "${GREEN}✅ build/index.js exists${NC}"
    else
        echo -e "${RED}❌ build/index.js not found${NC}"
    fi
else
    echo -e "${RED}❌ Build directory not found${NC}"
    echo "You need to run: npm run build"
fi

# 5. Test database connection
echo -e "\n5. Database Connection Test"
echo "--------------------------"
if [ ! -z "$DATABASE_URL" ]; then
    echo "Testing database connection..."
    node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    prisma.\$connect()
        .then(() => {
            console.log('✅ Database connection successful');
            return prisma.\$disconnect();
        })
        .catch((error) => {
            console.error('❌ Database connection failed:', error.message);
            process.exit(1);
        });
    " || echo -e "${RED}Database connection test failed${NC}"
else
    echo -e "${RED}❌ DATABASE_URL not set - cannot test connection${NC}"
fi

# 6. Check for common Railway issues
echo -e "\n6. Common Railway Issues Check"
echo "------------------------------"

# Check if PORT is hardcoded
if grep -r "3000" server.js package.json > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Found hardcoded port 3000 - make sure to use process.env.PORT${NC}"
fi

# Check for localhost references
if grep -r "localhost" app/ > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Found 'localhost' references in app/ - these won't work in production${NC}"
fi

# Check package.json scripts
echo -e "\n7. Package.json Scripts"
echo "----------------------"
echo "Build command: $(node -e "console.log(require('./package.json').scripts.build || 'not found')")"
echo "Start command: $(node -e "console.log(require('./package.json').scripts.start || 'not found')")"

# 8. Memory check
echo -e "\n8. Memory Usage"
echo "---------------"
free -h 2>/dev/null || echo "Memory info not available"

# 9. Test server startup (without actually starting it)
echo -e "\n9. Server File Check"
echo "-------------------"
if [ -f "server.js" ]; then
    echo -e "${GREEN}✅ server.js exists${NC}"
    # Check for syntax errors
    node -c server.js && echo -e "${GREEN}✅ server.js syntax is valid${NC}" || echo -e "${RED}❌ server.js has syntax errors${NC}"
else
    echo -e "${RED}❌ server.js not found${NC}"
fi

# 10. Final recommendations
echo -e "\n10. Recommendations"
echo "-------------------"
echo "If your app is still crashing:"
echo "1. Check Railway logs: railway logs"
echo "2. Try the debug server: node deploy/debug-server.js"
echo "3. Run the comprehensive debug script: node scripts/debug-railway.js"
echo "4. Ensure all environment variables are set in Railway"
echo "5. Try a manual deploy with: railway up"
echo ""
echo "For Prisma-specific issues:"
echo "- Make sure DATABASE_URL includes proper SSL settings"
echo "- For Railway PostgreSQL, you might need: ?sslmode=require"
echo ""
echo "Debug complete!"