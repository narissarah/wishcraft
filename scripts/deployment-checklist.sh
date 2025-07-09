#!/bin/bash

# WishCraft Deployment Readiness Checklist
# Ensures all requirements are met before deployment

set -e

echo "🚀 WishCraft Deployment Readiness Check"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

check_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 1. Environment Check
echo "1. Environment Configuration"
echo "---------------------------"

if [ -f .env ]; then
    check_pass ".env file exists"
    
    # Check required environment variables
    required_vars=(
        "SHOPIFY_API_KEY"
        "SHOPIFY_API_SECRET"
        "SESSION_SECRET"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "DATABASE_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" .env && ! grep -q "^${var}=.*_here$\|^${var}=$\|^${var}=generate_" .env; then
            check_pass "$var is configured"
        else
            check_fail "$var is not properly configured"
        fi
    done
else
    check_fail ".env file not found"
fi

echo ""

# 2. Security Configuration
echo "2. Security Configuration"
echo "------------------------"

if grep -q "^FORCE_HTTPS=true" .env; then
    check_pass "HTTPS enforcement enabled"
else
    check_warn "HTTPS enforcement not enabled"
fi

if grep -q "^ENABLE_AUDIT_LOGGING=true" .env; then
    check_pass "Audit logging enabled"
else
    check_warn "Audit logging not enabled"
fi

# Check security files exist
security_files=(
    "app/lib/security-headers.server.ts"
    "app/lib/rate-limiter.server.ts"
    "app/lib/pci-compliance.server.ts"
    "app/routes/webhooks.customers.data_request.tsx"
    "app/routes/webhooks.customers.redact.tsx"
    "app/routes/webhooks.shop.redact.tsx"
)

for file in "${security_files[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$(basename $file) exists"
    else
        check_fail "Missing security file: $file"
    fi
done

echo ""

# 3. Database Status
echo "3. Database Configuration"
echo "------------------------"

if command -v prisma > /dev/null; then
    check_pass "Prisma CLI installed"
    
    # Check if migrations directory exists
    if [ -d "prisma/migrations" ]; then
        migration_count=$(ls -1 prisma/migrations 2>/dev/null | wc -l)
        check_pass "Database migrations found: $migration_count"
    else
        check_warn "No database migrations found"
    fi
else
    check_fail "Prisma CLI not installed"
fi

echo ""

# 4. Build Check
echo "4. Build Status"
echo "---------------"

check_info "Running production build..."
if npm run build > /dev/null 2>&1; then
    check_pass "Production build successful"
    
    if [ -d "build" ]; then
        build_size=$(du -sh build 2>/dev/null | cut -f1)
        check_info "Build size: $build_size"
    fi
else
    check_fail "Production build failed"
fi

echo ""

# 5. Shopify Configuration
echo "5. Shopify App Configuration"
echo "----------------------------"

if [ -f "shopify.app.wishcraft.toml" ]; then
    check_pass "Shopify app configuration found"
    
    # Check scopes
    if grep -q 'scopes = "read_customers' shopify.app.wishcraft.toml; then
        check_pass "Access scopes configured"
    else
        check_fail "Access scopes not configured"
    fi
    
    # Check application URL
    if grep -q 'application_url = "https://wishcraft.app"' shopify.app.wishcraft.toml; then
        check_pass "Production URL configured"
    else
        check_warn "Using default application URL"
    fi
else
    check_fail "Shopify app configuration not found"
fi

echo ""

# 6. Performance Optimization
echo "6. Performance Optimization"
echo "---------------------------"

performance_files=(
    "app/lib/web-vitals.client.ts"
    "app/lib/performance.server.ts"
    "app/lib/caching.server.ts"
    "app/lib/image-optimization.server.ts"
)

for file in "${performance_files[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$(basename $file) exists"
    else
        check_warn "Missing performance file: $file"
    fi
done

echo ""

# 7. Documentation
echo "7. Documentation"
echo "----------------"

docs=(
    "README.md"
    "COMPLIANCE_CHECKLIST.md"
    ".env.example"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "$doc exists"
    else
        check_warn "Missing documentation: $doc"
    fi
done

echo ""

# 8. Final Summary
echo "======================================"
echo "Deployment Readiness Summary"
echo "======================================"

check_info "All critical checks passed!"
echo ""
echo "Pre-deployment checklist:"
echo "1. [ ] Update production database credentials"
echo "2. [ ] Configure production domain in COOKIE_DOMAIN"
echo "3. [ ] Set up SSL certificates"
echo "4. [ ] Configure CDN for static assets"
echo "5. [ ] Set up monitoring (Sentry, etc.)"
echo "6. [ ] Review and update privacy policy"
echo "7. [ ] Test webhook endpoints"
echo "8. [ ] Run penetration testing"
echo ""
echo "Deployment commands:"
echo "  npm run db:migrate      # Run database migrations"
echo "  npm run deploy:production  # Deploy to production"
echo "  npm run health:check    # Verify deployment"
echo ""
check_pass "Ready for deployment! 🚀"