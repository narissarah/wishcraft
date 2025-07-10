#!/bin/bash

# WishCraft Production Deployment Verification Script
# Run this after deployment to ensure everything is working correctly

echo "🔍 WishCraft Production Deployment Verification"
echo "=============================================="

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get app URL from environment or use default
APP_URL=${SHOPIFY_APP_URL:-"https://wishcraft-production.up.railway.app"}

echo -e "\n📍 Checking app at: $APP_URL"

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    echo -e -n "\n✓ Checking $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL$endpoint")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $response, expected $expected_status)"
        return 1
    fi
}

# Track failures
failures=0

# 1. Health Check Endpoints
echo -e "\n${YELLOW}1. Health Check Endpoints${NC}"
check_endpoint "/health" "200" "Main health endpoint" || ((failures++))
check_endpoint "/health/liveness" "200" "Liveness probe" || ((failures++))
check_endpoint "/health/readiness" "200" "Readiness probe" || ((failures++))

# 2. Authentication Endpoints
echo -e "\n${YELLOW}2. Authentication Endpoints${NC}"
check_endpoint "/auth/login" "302" "Login redirect" || ((failures++))
check_endpoint "/auth/callback" "400" "OAuth callback (should fail without params)" || ((failures++))

# 3. API Endpoints
echo -e "\n${YELLOW}3. API Endpoints${NC}"
check_endpoint "/api/registries" "401" "Registries API (requires auth)" || ((failures++))

# 4. Static Assets
echo -e "\n${YELLOW}4. Static Assets${NC}"
check_endpoint "/favicon.ico" "200" "Favicon" || ((failures++))

# 5. Webhook Endpoints
echo -e "\n${YELLOW}5. Webhook Endpoints${NC}"
check_endpoint "/webhooks/app/uninstalled" "401" "App uninstalled webhook" || ((failures++))

# 6. Check health endpoint details
echo -e "\n${YELLOW}6. Detailed Health Check${NC}"
echo -e -n "\n✓ Fetching health details... "
health_response=$(curl -s "$APP_URL/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}SUCCESS${NC}"
    echo -e "\nHealth Response:"
    echo "$health_response" | python3 -m json.tool 2>/dev/null || echo "$health_response"
else
    echo -e "${RED}FAILED${NC}"
    ((failures++))
fi

# 7. Security Headers Check
echo -e "\n${YELLOW}7. Security Headers${NC}"
echo -e -n "\n✓ Checking security headers... "
headers=$(curl -s -I "$APP_URL/health")
security_headers=(
    "Strict-Transport-Security"
    "X-Content-Type-Options"
    "X-Frame-Options"
    "X-XSS-Protection"
)

header_count=0
for header in "${security_headers[@]}"; do
    if echo "$headers" | grep -qi "$header"; then
        ((header_count++))
    fi
done

if [ $header_count -eq ${#security_headers[@]} ]; then
    echo -e "${GREEN}ALL PRESENT${NC} ($header_count/${#security_headers[@]})"
else
    echo -e "${YELLOW}PARTIAL${NC} ($header_count/${#security_headers[@]})"
fi

# Summary
echo -e "\n=============================================="
echo -e "📊 ${YELLOW}Deployment Verification Summary${NC}"
echo -e "=============================================="

if [ $failures -eq 0 ]; then
    echo -e "\n✅ ${GREEN}All checks passed!${NC} Your deployment is healthy."
    echo -e "\n🎯 Next steps:"
    echo -e "  1. Test OAuth flow by visiting: $APP_URL/auth/login"
    echo -e "  2. Monitor logs for any errors"
    echo -e "  3. Set up monitoring alerts for /health endpoint"
    echo -e "  4. Configure auto-scaling if needed"
else
    echo -e "\n⚠️  ${RED}$failures checks failed.${NC} Please investigate the issues above."
    echo -e "\n🔧 Troubleshooting:"
    echo -e "  1. Check application logs"
    echo -e "  2. Verify environment variables are set"
    echo -e "  3. Ensure database migrations have run"
    echo -e "  4. Check Shopify app configuration"
fi

echo -e "\n📚 Documentation: PRODUCTION_CHECKLIST.md"
echo -e "🐛 Support: https://github.com/narissarah/wishcraft/issues"

exit $failures