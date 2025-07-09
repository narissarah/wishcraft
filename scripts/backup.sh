#!/bin/bash

# WishCraft Backup Script
# Automated backup solution for WishCraft application

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wishcraft}"
DATABASE_URL="${DATABASE_URL:-}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
SHOPIFY_APP_URL="${SHOPIFY_APP_URL:-https://your-app.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
create_backup_directory() {
    log_info "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    
    if [ ! -w "$BACKUP_DIR" ]; then
        log_error "Backup directory $BACKUP_DIR is not writable"
        exit 1
    fi
}

# Backup database
backup_database() {
    log_info "Starting database backup..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL is not set"
        exit 1
    fi
    
    # Generate timestamp
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/database_backup_$TIMESTAMP.sql"
    
    # Check if pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump is not installed. Please install PostgreSQL client tools."
        exit 1
    fi
    
    # Perform backup
    log_info "Creating database backup: $BACKUP_FILE"
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
    
    # Compress backup
    log_info "Compressing backup..."
    gzip "$BACKUP_FILE"
    BACKUP_FILE="$BACKUP_FILE.gz"
    
    # Verify backup
    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        log_info "Database backup completed successfully: $BACKUP_FILE"
        echo "$BACKUP_FILE"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

# Backup application files
backup_application() {
    log_info "Starting application backup..."
    
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    APP_BACKUP_FILE="$BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz"
    
    # Get current directory
    CURRENT_DIR=$(pwd)
    
    # Create application backup
    log_info "Creating application backup: $APP_BACKUP_FILE"
    tar -czf "$APP_BACKUP_FILE" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=build \
        --exclude=.env \
        --exclude=.env.local \
        --exclude=backups \
        --exclude=logs \
        -C "$CURRENT_DIR" .
    
    # Verify backup
    if [ -f "$APP_BACKUP_FILE" ] && [ -s "$APP_BACKUP_FILE" ]; then
        log_info "Application backup completed successfully: $APP_BACKUP_FILE"
        echo "$APP_BACKUP_FILE"
    else
        log_error "Application backup failed"
        exit 1
    fi
}

# Backup environment configuration
backup_environment() {
    log_info "Starting environment backup..."
    
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    ENV_BACKUP_FILE="$BACKUP_DIR/env_backup_$TIMESTAMP.txt"
    
    # Create environment backup (excluding sensitive values)
    log_info "Creating environment backup: $ENV_BACKUP_FILE"
    
    cat > "$ENV_BACKUP_FILE" << EOF
# WishCraft Environment Backup - $(date)
# Sensitive values are masked for security

NODE_ENV=${NODE_ENV:-production}
SHOPIFY_APP_URL=${SHOPIFY_APP_URL:-[SET]}
SHOPIFY_API_KEY=[MASKED]
SHOPIFY_API_SECRET=[MASKED]
SHOPIFY_WEBHOOK_SECRET=[MASKED]
DATABASE_URL=[MASKED]
REDIS_URL=${REDIS_URL:-[NOT_SET]}
SENTRY_DSN=${SENTRY_DSN:-[NOT_SET]}
ENCRYPTION_KEY=[MASKED]
SESSION_SECRET=[MASKED]
ENABLE_AUDIT_LOGGING=${ENABLE_AUDIT_LOGGING:-true}
FORCE_HTTPS=${FORCE_HTTPS:-true}
RATE_LIMIT_ENABLED=${RATE_LIMIT_ENABLED:-true}
PERFORMANCE_MONITORING=${PERFORMANCE_MONITORING:-true}
BACKUP_RETENTION_DAYS=${RETENTION_DAYS}
EOF
    
    log_info "Environment backup completed: $ENV_BACKUP_FILE"
    echo "$ENV_BACKUP_FILE"
}

# Test backup integrity
test_backup_integrity() {
    local backup_file="$1"
    
    log_info "Testing backup integrity: $backup_file"
    
    if [[ "$backup_file" == *.gz ]]; then
        if gzip -t "$backup_file"; then
            log_info "Backup integrity check passed"
        else
            log_error "Backup integrity check failed"
            return 1
        fi
    elif [[ "$backup_file" == *.tar.gz ]]; then
        if tar -tzf "$backup_file" > /dev/null; then
            log_info "Backup integrity check passed"
        else
            log_error "Backup integrity check failed"
            return 1
        fi
    fi
}

# Clean old backups
clean_old_backups() {
    log_info "Cleaning old backups (retention: $RETENTION_DAYS days)..."
    
    # Clean database backups
    find "$BACKUP_DIR" -name "database_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # Clean application backups  
    find "$BACKUP_DIR" -name "app_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # Clean environment backups
    find "$BACKUP_DIR" -name "env_backup_*.txt" -type f -mtime +$RETENTION_DAYS -delete
    
    log_info "Old backup cleanup completed"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Log the notification
    if [ "$status" = "success" ]; then
        log_info "Backup notification: $message"
    else
        log_error "Backup notification: $message"
    fi
    
    # You can extend this to send email, Slack, etc.
    # Example: curl -X POST -H 'Content-type: application/json' \
    #   --data '{"text":"'"$message"'"}' \
    #   "$SLACK_WEBHOOK_URL"
}

# Main backup function
main() {
    log_info "Starting WishCraft backup process..."
    
    # Create backup directory
    create_backup_directory
    
    # Perform backups
    DB_BACKUP_FILE=$(backup_database)
    APP_BACKUP_FILE=$(backup_application)
    ENV_BACKUP_FILE=$(backup_environment)
    
    # Test backup integrity
    test_backup_integrity "$DB_BACKUP_FILE"
    test_backup_integrity "$APP_BACKUP_FILE"
    
    # Clean old backups
    clean_old_backups
    
    # Calculate sizes
    DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
    APP_SIZE=$(du -h "$APP_BACKUP_FILE" | cut -f1)
    
    # Send success notification
    send_notification "success" "WishCraft backup completed successfully - DB: $DB_SIZE, App: $APP_SIZE"
    
    log_info "🎉 Backup process completed successfully!"
    log_info "Database backup: $DB_BACKUP_FILE ($DB_SIZE)"
    log_info "Application backup: $APP_BACKUP_FILE ($APP_SIZE)"
    log_info "Environment backup: $ENV_BACKUP_FILE"
}

# Error handling
trap 'send_notification "error" "WishCraft backup failed"; exit 1' ERR

# Run main function
main "$@"