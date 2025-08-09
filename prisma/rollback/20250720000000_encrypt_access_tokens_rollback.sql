-- Rollback Migration for 20250720000000_encrypt_access_tokens
-- WARNING: This will remove encryption fields - ensure you have backups of encrypted data

-- ============================================================================
-- PHASE 1: Remove Encryption Fields
-- ============================================================================

-- Drop index for encrypted tokens
DROP INDEX IF EXISTS "sessions_encrypted_token_idx";

-- Remove encryption fields from sessions table
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "accessTokenEncrypted";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "accessTokenIV";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "accessTokenTag";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "tokenEncrypted";

-- ============================================================================
-- PHASE 2: Drop Security Audit Table
-- ============================================================================

DROP TABLE IF EXISTS "security_audit" CASCADE;

-- ============================================================================
-- PHASE 3: Revert Data Retention Period
-- ============================================================================

-- Reset data retention to original 7 years (2555 days) if it was changed to 90
UPDATE "shops" SET "dataRetentionPeriod" = 2555 WHERE "dataRetentionPeriod" = 90;

-- ============================================================================
-- PHASE 4: Validation
-- ============================================================================

DO $$
BEGIN
    -- Verify encryption fields are removed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' 
        AND column_name IN ('accessTokenEncrypted', 'accessTokenIV', 'accessTokenTag', 'tokenEncrypted')
    ) THEN
        RAISE EXCEPTION 'Rollback failed: Encryption fields still exist';
    END IF;
    
    -- Verify security_audit table is removed
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'security_audit'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: security_audit table still exists';
    END IF;
    
    RAISE NOTICE 'Access token encryption rollback completed successfully';
END $$;