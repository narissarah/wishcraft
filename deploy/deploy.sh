#!/bin/bash
# WishCraft Production Deployment Script
# Follows Shopify hosting best practices

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
PLATFORM=${2:-railway}
DRY_RUN=${3:-false}

echo -e "${BLUE}🚀 WishCraft Production Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Platform: ${PLATFORM}${NC}"
echo "=================================="

# Function to log with timestamp
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log "${RED}❌ $1 is required but not installed${NC}"
        exit 1
    fi
}

# Function to check environment variable
check_env_var() {
    if [[ -z "${!1:-}" ]]; then
        log "${RED}❌ Environment variable $1 is required${NC}"
        return 1
    fi
}

# Pre-deployment checks
log "${YELLOW}🔍 Running pre-deployment checks...${NC}"

# Check required commands
check_command "node"
check_command "npm"
check_command "git"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"
if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
    log "${RED}❌ Node.js version $NODE_VERSION is not supported. Minimum required: $REQUIRED_VERSION${NC}"
    exit 1
fi

# Check Git status
if [[ -n $(git status --porcelain) ]]; then
    log "${YELLOW}⚠️  Working directory is not clean. Uncommitted changes detected.${NC}"
    if [[ "$DRY_RUN" == "false" ]]; then
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Check required environment variables for production
if [[ "$ENVIRONMENT" == "production" ]]; then
    log "${YELLOW}🔐 Checking required environment variables...${NC}"
    
    required_vars=(
        "SHOPIFY_API_KEY"
        "SHOPIFY_API_SECRET" 
        "SCOPES"
        "HOST"
        "DATABASE_URL"
        "SESSION_SECRET"
        "ENCRYPTION_KEY"
        "WEBHOOK_SECRET"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! check_env_var "$var"; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -ne 0 ]]; then
        log "${RED}❌ Missing required environment variables: ${missing_vars[*]}${NC}"
        log "${YELLOW}💡 Create a .env.production file or set them in your deployment platform${NC}"
        exit 1
    fi
fi

# Install dependencies
log "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --production=false

# Run type checking
log "${YELLOW}🔍 Running TypeScript type checking...${NC}"
if ! npm run typecheck; then
    log "${RED}❌ TypeScript type checking failed${NC}"
    if [[ "$DRY_RUN" == "false" ]]; then
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Run linting
log "${YELLOW}🔍 Running ESLint...${NC}"
if ! npm run lint; then
    log "${YELLOW}⚠️  Linting issues detected${NC}"
fi

# Run tests
log "${YELLOW}🧪 Running test suite...${NC}"
if ! npm run test:unit; then
    log "${RED}❌ Unit tests failed${NC}"
    if [[ "$DRY_RUN" == "false" ]]; then
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Run security audit
log "${YELLOW}🔒 Running security audit...${NC}"
if ! npm audit --audit-level=high; then
    log "${YELLOW}⚠️  Security vulnerabilities detected${NC}"
    if [[ "$DRY_RUN" == "false" ]]; then
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Check performance budgets
log "${YELLOW}🎯 Checking performance budgets...${NC}"
if ! npm run performance:budget; then
    log "${YELLOW}⚠️  Performance budget violations detected${NC}"
fi

# Build application
log "${YELLOW}🏗️  Building application...${NC}"
export NODE_ENV=production
if ! npm run build; then
    log "${RED}❌ Build failed${NC}"
    exit 1
fi

# Check bundle size
log "${YELLOW}📏 Checking bundle size...${NC}"
if ! npm run size; then
    log "${YELLOW}⚠️  Bundle size exceeded limits${NC}"
fi

# Database migrations (if not dry run)
if [[ "$DRY_RUN" == "false" && "$ENVIRONMENT" == "production" ]]; then
    log "${YELLOW}🗄️  Running database migrations...${NC}"
    if ! npm run db:migrate; then
        log "${RED}❌ Database migration failed${NC}"
        exit 1
    fi
fi

# Platform-specific deployment
if [[ "$DRY_RUN" == "false" ]]; then
    case "$PLATFORM" in
        "railway")
            log "${YELLOW}🚂 Deploying to Railway...${NC}"
            if command -v railway &> /dev/null; then
                railway deploy --environment="$ENVIRONMENT"
            else
                log "${RED}❌ Railway CLI not found. Install with: npm install -g @railway/cli${NC}"
                exit 1
            fi
            ;;
        "render")
            log "${YELLOW}🎨 Deploying to Render...${NC}"
            if command -v render &> /dev/null; then
                render deploy --environment="$ENVIRONMENT"
            else
                log "${YELLOW}💡 Using Git-based deployment to Render${NC}"
                git push render main
            fi
            ;;
        "docker")
            log "${YELLOW}🐳 Building and deploying Docker container...${NC}"
            docker build -t wishcraft:latest .
            docker tag wishcraft:latest wishcraft:$ENVIRONMENT
            log "${GREEN}✅ Docker image built: wishcraft:$ENVIRONMENT${NC}"
            ;;
        *)
            log "${RED}❌ Unsupported platform: $PLATFORM${NC}"
            exit 1
            ;;
    esac
else
    log "${GREEN}✅ Dry run completed successfully${NC}"
    log "${BLUE}💡 Run without --dry-run to perform actual deployment${NC}"
fi

# Post-deployment health checks (if not dry run)
if [[ "$DRY_RUN" == "false" ]]; then
    log "${YELLOW}🏥 Running post-deployment health checks...${NC}"
    
    # Wait for deployment to be ready
    sleep 30
    
    # Health check URLs
    if [[ -n "${HOST:-}" ]]; then
        HEALTH_URL="https://$HOST/health"
        
        # Check application health
        for i in {1..10}; do
            if curl -f -s "$HEALTH_URL" > /dev/null; then
                log "${GREEN}✅ Application health check passed${NC}"
                break
            else
                log "${YELLOW}⏳ Waiting for application to be ready (attempt $i/10)...${NC}"
                sleep 30
            fi
            
            if [[ $i -eq 10 ]]; then
                log "${RED}❌ Application health check failed after 10 attempts${NC}"
                exit 1
            fi
        done
        
        # Check database connectivity
        DB_HEALTH_URL="https://$HOST/health/db"
        if curl -f -s "$DB_HEALTH_URL" > /dev/null; then
            log "${GREEN}✅ Database health check passed${NC}"
        else
            log "${RED}❌ Database health check failed${NC}"
            exit 1
        fi
        
        # Check Shopify API connectivity
        SHOPIFY_HEALTH_URL="https://$HOST/health/shopify"
        if curl -f -s "$SHOPIFY_HEALTH_URL" > /dev/null; then
            log "${GREEN}✅ Shopify API health check passed${NC}"
        else
            log "${YELLOW}⚠️  Shopify API health check failed${NC}"
        fi
    fi
fi

# Send deployment notification
if [[ "$DRY_RUN" == "false" && -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    log "${YELLOW}📢 Sending deployment notification...${NC}"
    
    COMMIT_SHA=$(git rev-parse HEAD)
    COMMIT_MSG=$(git log -1 --pretty=%B)
    DEPLOYED_BY=$(git config user.name)
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{
            \"text\": \"🚀 WishCraft deployed to $ENVIRONMENT\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                    {\"title\": \"Platform\", \"value\": \"$PLATFORM\", \"short\": true},
                    {\"title\": \"Commit\", \"value\": \"${COMMIT_SHA:0:7}\", \"short\": true},
                    {\"title\": \"Deployed by\", \"value\": \"$DEPLOYED_BY\", \"short\": true},
                    {\"title\": \"Message\", \"value\": \"$COMMIT_MSG\", \"short\": false}
                ]
            }]
        }" \
        "$SLACK_WEBHOOK_URL"
fi

# Performance monitoring setup
if [[ "$DRY_RUN" == "false" && "$ENVIRONMENT" == "production" ]]; then
    log "${YELLOW}📊 Setting up performance monitoring...${NC}"
    
    # Send deployment event to monitoring services
    if [[ -n "${DATADOG_API_KEY:-}" ]]; then
        curl -X POST "https://api.datadoghq.com/api/v1/events" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: $DATADOG_API_KEY" \
            -d "{
                \"title\": \"WishCraft Deployment\",
                \"text\": \"Deployed to $ENVIRONMENT on $PLATFORM\",
                \"tags\": [\"environment:$ENVIRONMENT\", \"platform:$PLATFORM\", \"version:${COMMIT_SHA:0:7}\"]
            }"
    fi
    
    # Start performance monitoring alert
    npm run performance:alerts &
fi

log "${GREEN}🎉 Deployment completed successfully!${NC}"
log "${BLUE}📊 Monitor your application at: https://$HOST${NC}"
log "${BLUE}📈 Performance dashboard: https://$HOST/admin/performance${NC}"

# Cleanup
log "${YELLOW}🧹 Cleaning up...${NC}"
if [[ -f ".env.production.backup" ]]; then
    rm ".env.production.backup"
fi

echo "=================================="
log "${GREEN}✅ WishCraft is now live in $ENVIRONMENT!${NC}"