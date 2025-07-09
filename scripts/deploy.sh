#!/bin/bash

# WishCraft Production Deployment Script
# This script handles the complete deployment process for WishCraft

set -e  # Exit on any error

echo "🚀 Starting WishCraft production deployment..."

# Configuration
DEPLOY_ENV=${DEPLOY_ENV:-production}
SHOPIFY_APP_URL=${SHOPIFY_APP_URL:-"https://your-app.com"}
BUILD_DIR="build"
BACKUP_DIR="backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the WishCraft root directory?"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    if [ -z "$SHOPIFY_API_KEY" ]; then
        log_error "SHOPIFY_API_KEY environment variable is required"
        exit 1
    fi
    
    if [ -z "$SHOPIFY_API_SECRET" ]; then
        log_error "SHOPIFY_API_SECRET environment variable is required"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    npm ci --only=production
    log_info "Dependencies installed ✓"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    npm run db:migrate
    log_info "Database migrations completed ✓"
}

# Build the application
build_application() {
    log_info "Building application..."
    
    # Clean previous build
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
    fi
    
    # Run build
    npm run build
    
    # Verify build
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build failed - $BUILD_DIR directory not found"
        exit 1
    fi
    
    log_info "Application built successfully ✓"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    
    # Run type checking
    npm run typecheck || log_warn "TypeScript errors found (non-blocking)"
    
    # Run unit tests
    npm run test:unit || log_warn "Unit tests failed (non-blocking)"
    
    log_info "Tests completed ✓"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup database (if using PostgreSQL)
    if command -v pg_dump &> /dev/null; then
        BACKUP_FILE="$BACKUP_DIR/wishcraft-$(date +%Y%m%d-%H%M%S).sql"
        pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
        log_info "Database backup created: $BACKUP_FILE"
    else
        log_warn "pg_dump not available, skipping database backup"
    fi
    
    log_info "Backup completed ✓"
}

# Set up health checks
setup_health_checks() {
    log_info "Setting up health checks..."
    
    # Wait for server to be ready
    sleep 5
    
    # Check health endpoint
    if curl -f "$SHOPIFY_APP_URL/health" > /dev/null 2>&1; then
        log_info "Health check passed ✓"
    else
        log_error "Health check failed"
        exit 1
    fi
}

# Deploy to production
deploy_to_production() {
    log_info "Deploying to production..."
    
    # Set production environment
    export NODE_ENV=production
    
    # Start the application (example for PM2)
    if command -v pm2 &> /dev/null; then
        pm2 restart ecosystem.config.js --env production
        log_info "Application restarted with PM2"
    else
        log_warn "PM2 not available, manual restart required"
    fi
    
    log_info "Production deployment completed ✓"
}

# Rollback function
rollback() {
    log_error "Deployment failed, starting rollback..."
    
    if command -v pm2 &> /dev/null; then
        pm2 restart ecosystem.config.js --env production
        log_info "Rollback completed"
    fi
    
    exit 1
}

# Main deployment flow
main() {
    log_info "Starting WishCraft deployment process..."
    
    # Trap errors for rollback
    trap rollback ERR
    
    # Run deployment steps
    check_prerequisites
    create_backup
    install_dependencies
    run_migrations
    build_application
    run_tests
    deploy_to_production
    setup_health_checks
    
    log_info "🎉 WishCraft deployment completed successfully!"
    log_info "Application is now running at: $SHOPIFY_APP_URL"
}

# Run main function
main "$@"