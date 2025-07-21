-- Fix Session Security Constraint
-- Updates constraint to match current encrypted-only schema

-- Drop the old constraint that references non-existent accessToken field
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "check_session_security";

-- Add correct constraint for encrypted-only sessions
ALTER TABLE "sessions" 
ADD CONSTRAINT "check_session_security_encrypted" 
CHECK (
    (
        "tokenEncrypted" = true 
        AND "accessTokenEncrypted" IS NOT NULL 
        AND "accessTokenIV" IS NOT NULL 
        AND "accessTokenTag" IS NOT NULL
    )
    OR 
    (
        "tokenEncrypted" = false 
        AND "accessTokenEncrypted" IS NULL 
        AND "accessTokenIV" IS NULL 
        AND "accessTokenTag" IS NULL
    )
);

-- Ensure all existing sessions have proper encryption state
UPDATE "sessions" 
SET "tokenEncrypted" = true 
WHERE "accessTokenEncrypted" IS NOT NULL 
AND "tokenEncrypted" = false;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT "check_session_security_encrypted" ON "sessions" 
IS 'Ensures session token encryption is consistent - either all encrypted fields are present or all are null';