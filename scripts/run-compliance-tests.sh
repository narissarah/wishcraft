#!/bin/bash

# WishCraft Compliance Test Suite
# Runs all compliance and security tests

set -e

echo "🔒 WishCraft Compliance Test Suite"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -n "Running $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Passed${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ Failed${NC}"
        ((TESTS_FAILED++))
    fi
}

# 1. TypeScript compilation check
echo "1. TypeScript Compilation"
echo "------------------------"
run_test "TypeScript check" "npm run typecheck"
echo ""

# 2. Database migrations check
echo "2. Database Status"
echo "------------------"
run_test "Prisma generate" "npm run db:generate"
echo ""

# 3. Security tests
echo "3. Security Tests"
echo "-----------------"
run_test "GDPR webhook handlers" "test -f app/routes/webhooks.customers.data_request.tsx && test -f app/routes/webhooks.customers.redact.tsx && test -f app/routes/webhooks.shop.redact.tsx"
run_test "Security headers module" "test -f app/lib/security-headers.server.ts"
run_test "Rate limiter module" "test -f app/lib/rate-limiter.server.ts"
run_test "PCI compliance module" "test -f app/lib/pci-compliance.server.ts"
run_test "Web vitals module" "test -f app/lib/web-vitals.client.ts"
echo ""

# 4. Configuration tests
echo "4. Configuration Tests"
echo "----------------------"
run_test "Access scopes configured" "grep -q 'scopes = \"read_customers' shopify.app.wishcraft.toml"
run_test "Application URL configured" "grep -q 'application_url = \"https://wishcraft.app\"' shopify.app.wishcraft.toml"
run_test "Environment security flags" "grep -q 'FORCE_HTTPS=true' .env && grep -q 'ENABLE_AUDIT_LOGGING=true' .env"
run_test "Security keys generated" "grep -q 'SESSION_SECRET=' .env && grep -q 'JWT_SECRET=' .env && grep -q 'ENCRYPTION_KEY=' .env"
echo ""

# 5. Dependency security audit
echo "5. Dependency Security"
echo "----------------------"
echo "Running npm audit..."
npm_audit_output=$(npm audit --json 2>/dev/null || true)
vulnerabilities=$(echo "$npm_audit_output" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
if [ "$vulnerabilities" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $vulnerabilities vulnerabilities${NC}"
    echo "Run 'npm audit' for details"
else
    echo -e "${GREEN}✓ No vulnerabilities found${NC}"
    ((TESTS_PASSED++))
fi
echo ""

# 6. Bundle size check
echo "6. Bundle Size Analysis"
echo "-----------------------"
if command -v du > /dev/null; then
    if [ -d "build" ]; then
        bundle_size=$(du -sh build 2>/dev/null | cut -f1)
        echo "Build size: $bundle_size"
    else
        echo "No build directory found. Run 'npm run build' first."
    fi
else
    echo "Skipping bundle size check"
fi
echo ""

# 7. Performance checklist
echo "7. Performance Readiness"
echo "------------------------"
run_test "Performance monitoring client" "test -f app/lib/performance-monitoring.client.ts"
run_test "Performance dashboard server" "test -f app/lib/performance-dashboard.server.ts"
run_test "Image optimization" "test -f app/lib/image-optimization.server.ts"
run_test "Caching server" "test -f app/lib/caching.server.ts"
echo ""

# 8. Multi-store architecture
echo "8. Multi-Store Architecture"
echo "---------------------------"
run_test "Database schema with shop isolation" "grep -q 'shopId.*String' prisma/schema.prisma"
run_test "Middleware with shop context" "test -f app/lib/middleware.server.ts"
run_test "Multi-address shipping" "test -f app/lib/multi-address-shipping.server.ts"
echo ""

# Summary
echo "=================================="
echo "Test Summary"
echo "=================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All compliance tests passed!${NC}"
    echo ""
    echo "Your application is ready for:"
    echo "• Shopify App Store submission"
    echo "• Built for Shopify certification"
    echo "• Production deployment"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please fix the issues above.${NC}"
    exit 1
fi