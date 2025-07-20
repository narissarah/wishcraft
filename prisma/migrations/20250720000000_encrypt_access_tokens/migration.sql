-- Encrypt Access Tokens Migration
-- Adds encrypted token storage for security compliance

-- Add encrypted token fields to sessions table
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "accessTokenEncrypted" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "accessTokenIV" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "accessTokenTag" TEXT;

-- Create index for encrypted tokens
CREATE INDEX IF NOT EXISTS "sessions_encrypted_token_idx" ON "sessions"("accessTokenEncrypted") WHERE "accessTokenEncrypted" IS NOT NULL;

-- Add migration flag to track which tokens have been encrypted
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "tokenEncrypted" BOOLEAN DEFAULT false;

-- Security audit table for tracking token encryption
CREATE TABLE IF NOT EXISTS "security_audit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "security_audit_pkey" PRIMARY KEY ("id")
);

-- Add indexes for security audit
CREATE INDEX IF NOT EXISTS "security_audit_action_idx" ON "security_audit"("action");
CREATE INDEX IF NOT EXISTS "security_audit_timestamp_idx" ON "security_audit"("timestamp");

-- Update GDPR data retention from 7 years (2555 days) to 90 days
UPDATE "shops" SET "dataRetentionPeriod" = 90 WHERE "dataRetentionPeriod" = 2555;