#!/bin/bash
# WishCraft Database Backup Script
# Automated backup with multiple destinations and retention policies

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_TYPE=${1:-full}
RETENTION_DAYS=${2:-30}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/wishcraft_backups"
BACKUP_NAME="wishcraft_${BACKUP_TYPE}_${TIMESTAMP}"

# Environment variables (should be set in production)
DB_URL=${DATABASE_URL}
S3_BUCKET=${BACKUP_S3_BUCKET:-"wishcraft-backups"}
S3_REGION=${BACKUP_S3_REGION:-"us-west-2"}
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-""}

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "${BLUE}🗄️ Starting WishCraft database backup...${NC}"
log "${BLUE}Type: ${BACKUP_TYPE}${NC}"
log "${BLUE}Retention: ${RETENTION_DAYS} days${NC}"

# Extract database connection details
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

export PGPASSWORD="$DB_PASS"

# Perform backup based on type
case "$BACKUP_TYPE" in
    "full")
        log "${YELLOW}📦 Creating full database backup...${NC}"
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --clean --if-exists --create \
            --format=custom --compress=9 \
            --file="$BACKUP_DIR/${BACKUP_NAME}.dump"
        ;;
    
    "schema")
        log "${YELLOW}📋 Creating schema-only backup...${NC}"
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --schema-only \
            --format=custom --compress=9 \
            --file="$BACKUP_DIR/${BACKUP_NAME}.dump"
        ;;
    
    "data")
        log "${YELLOW}📊 Creating data-only backup...${NC}"
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --data-only \
            --format=custom --compress=9 \
            --file="$BACKUP_DIR/${BACKUP_NAME}.dump"
        ;;
    
    *)
        log "${RED}❌ Invalid backup type: $BACKUP_TYPE${NC}"
        log "${YELLOW}Valid types: full, schema, data${NC}"
        exit 1
        ;;
esac

# Verify backup file
if [[ ! -f "$BACKUP_DIR/${BACKUP_NAME}.dump" ]]; then
    log "${RED}❌ Backup file not created${NC}"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.dump" | cut -f1)
log "${GREEN}✅ Backup created: ${BACKUP_NAME}.dump (${BACKUP_SIZE})${NC}"

# Encrypt backup if encryption key is provided
if [[ -n "$ENCRYPTION_KEY" ]]; then
    log "${YELLOW}🔒 Encrypting backup...${NC}"
    openssl enc -aes-256-cbc -salt -in "$BACKUP_DIR/${BACKUP_NAME}.dump" \
        -out "$BACKUP_DIR/${BACKUP_NAME}.dump.enc" \
        -k "$ENCRYPTION_KEY"
    
    # Remove unencrypted file
    rm "$BACKUP_DIR/${BACKUP_NAME}.dump"
    mv "$BACKUP_DIR/${BACKUP_NAME}.dump.enc" "$BACKUP_DIR/${BACKUP_NAME}.dump"
    log "${GREEN}✅ Backup encrypted${NC}"
fi

# Upload to S3
if command -v aws &> /dev/null && [[ -n "$S3_BUCKET" ]]; then
    log "${YELLOW}☁️ Uploading to S3...${NC}"
    
    aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.dump" \
        "s3://$S3_BUCKET/database-backups/${BACKUP_NAME}.dump" \
        --region "$S3_REGION" \
        --storage-class STANDARD_IA \
        --metadata "backup-type=$BACKUP_TYPE,timestamp=$TIMESTAMP"
    
    if [[ $? -eq 0 ]]; then
        log "${GREEN}✅ Backup uploaded to S3${NC}"
    else
        log "${RED}❌ Failed to upload to S3${NC}"
    fi
fi

# Upload to Google Cloud Storage (if configured)
if command -v gsutil &> /dev/null && [[ -n "${GCS_BUCKET:-}" ]]; then
    log "${YELLOW}☁️ Uploading to Google Cloud Storage...${NC}"
    
    gsutil cp "$BACKUP_DIR/${BACKUP_NAME}.dump" \
        "gs://$GCS_BUCKET/database-backups/${BACKUP_NAME}.dump"
    
    if [[ $? -eq 0 ]]; then
        log "${GREEN}✅ Backup uploaded to GCS${NC}"
    else
        log "${RED}❌ Failed to upload to GCS${NC}"
    fi
fi

# Create backup metadata
cat > "$BACKUP_DIR/${BACKUP_NAME}.metadata.json" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "backup_type": "$BACKUP_TYPE",
    "timestamp": "$TIMESTAMP",
    "database": "$DB_NAME",
    "size": "$BACKUP_SIZE",
    "encrypted": $([ -n "$ENCRYPTION_KEY" ] && echo "true" || echo "false"),
    "retention_days": $RETENTION_DAYS,
    "created_by": "backup-script",
    "environment": "${NODE_ENV:-production}"
}
EOF

# Upload metadata
if command -v aws &> /dev/null && [[ -n "$S3_BUCKET" ]]; then
    aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.metadata.json" \
        "s3://$S3_BUCKET/database-backups/${BACKUP_NAME}.metadata.json" \
        --region "$S3_REGION"
fi

# Cleanup old backups
log "${YELLOW}🧹 Cleaning up old backups...${NC}"

# Local cleanup
find "$BACKUP_DIR" -name "wishcraft_*.dump" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "wishcraft_*.metadata.json" -type f -mtime +$RETENTION_DAYS -delete

# S3 cleanup
if command -v aws &> /dev/null && [[ -n "$S3_BUCKET" ]]; then
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
    
    aws s3 ls "s3://$S3_BUCKET/database-backups/" --recursive | \
    awk '$1 < "'$CUTOFF_DATE'" {print $4}' | \
    while read -r file; do
        if [[ -n "$file" ]]; then
            aws s3 rm "s3://$S3_BUCKET/$file"
            log "${YELLOW}🗑️ Deleted old backup: $file${NC}"
        fi
    done
fi

# Send notification
if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    log "${YELLOW}📢 Sending notification...${NC}"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{
            \"text\": \"🗄️ Database backup completed\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Type\", \"value\": \"$BACKUP_TYPE\", \"short\": true},
                    {\"title\": \"Size\", \"value\": \"$BACKUP_SIZE\", \"short\": true},
                    {\"title\": \"Timestamp\", \"value\": \"$TIMESTAMP\", \"short\": true},
                    {\"title\": \"Retention\", \"value\": \"$RETENTION_DAYS days\", \"short\": true}
                ]
            }]
        }" \
        "${SLACK_WEBHOOK_URL}"
fi

# Verify backup integrity
log "${YELLOW}🔍 Verifying backup integrity...${NC}"

if [[ "$BACKUP_TYPE" == "full" || "$BACKUP_TYPE" == "schema" ]]; then
    # Test restore (dry run) to verify backup integrity
    TEMP_DB="wishcraft_backup_test_${TIMESTAMP}"
    
    if createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEMP_DB" 2>/dev/null; then
        if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB" \
            --verbose --exit-on-error "$BACKUP_DIR/${BACKUP_NAME}.dump" &>/dev/null; then
            log "${GREEN}✅ Backup integrity verified${NC}"
        else
            log "${RED}❌ Backup integrity check failed${NC}"
        fi
        
        # Clean up test database
        dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEMP_DB" 2>/dev/null || true
    fi
fi

# Performance metrics
END_TIME=$(date +%s)
DURATION=$((END_TIME - $(date -d "$TIMESTAMP" +%s)))

log "${GREEN}🎉 Backup completed successfully!${NC}"
log "${BLUE}📊 Summary:${NC}"
log "${BLUE}   - Type: $BACKUP_TYPE${NC}"
log "${BLUE}   - Size: $BACKUP_SIZE${NC}"
log "${BLUE}   - Duration: ${DURATION}s${NC}"
log "${BLUE}   - File: ${BACKUP_NAME}.dump${NC}"

# Cleanup
rm -f "$BACKUP_DIR/${BACKUP_NAME}.metadata.json"

unset PGPASSWORD