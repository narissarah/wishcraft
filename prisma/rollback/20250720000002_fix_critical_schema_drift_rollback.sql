-- Rollback Migration for 20250720000002_fix_critical_schema_drift
-- WARNING: This will revert the registryItemId relationship back to registryId
-- Data loss may occur if purchases have been created with registryItemId

-- ============================================================================
-- PHASE 1: Revert Registry Purchase Relationship
-- ============================================================================

DO $$ 
BEGIN
    -- Check if we need to rollback
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registry_purchases' 
        AND column_name = 'registryItemId'
    ) THEN
        -- Step 1: Add back registryId column if it was removed
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'registry_purchases' 
            AND column_name = 'registryId'
        ) THEN
            ALTER TABLE "registry_purchases" ADD COLUMN "registryId" TEXT;
        END IF;
        
        -- Step 2: Populate registryId from registryItemId
        UPDATE "registry_purchases" rp
        SET "registryId" = ri."registryId"
        FROM "registry_items" ri
        WHERE rp."registryItemId" = ri."id"
        AND rp."registryId" IS NULL;
        
        -- Step 3: Drop the new foreign key constraint
        ALTER TABLE "registry_purchases" DROP CONSTRAINT IF EXISTS "registry_purchases_registryItemId_fkey";
        
        -- Step 4: Re-add the old foreign key constraint
        ALTER TABLE "registry_purchases" ADD CONSTRAINT "registry_purchases_registryId_fkey" 
            FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        
        -- Step 5: Drop new indexes
        DROP INDEX IF EXISTS "registry_purchases_registryItemId_idx";
        
        -- Step 6: Recreate old indexes
        CREATE INDEX IF NOT EXISTS "registry_purchases_registryId_idx" ON "registry_purchases"("registryId");
        
        -- Step 7: Remove the registryItemId column
        ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "registryItemId";
        
        -- Step 8: Remove comment from registryId
        COMMENT ON COLUMN "registry_purchases"."registryId" IS NULL;
    END IF;
END $$;

-- ============================================================================
-- PHASE 2: Drop Tables Created by Migration
-- ============================================================================

DROP TABLE IF EXISTS "group_gift_contributions" CASCADE;
DROP TABLE IF EXISTS "metafield_syncs" CASCADE;
DROP TABLE IF EXISTS "registry_addresses" CASCADE;
DROP TABLE IF EXISTS "registry_invitations" CASCADE;

-- ============================================================================
-- PHASE 3: Remove Session Security Fields
-- ============================================================================

ALTER TABLE "sessions" DROP COLUMN IF EXISTS "firstName";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "lastName";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "email";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "accountOwner";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "locale";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "collaborator";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "emailVerified";

-- ============================================================================
-- PHASE 4: Remove Registry Purchase Fields
-- ============================================================================

ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "purchaserType";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "purchaserId";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "purchaserPhone";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "giftWrapRequested";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "isGroupGift";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "groupGiftId";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "shippingAddressId";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "paymentStatus";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "fulfillmentStatus";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "trackingNumber";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "trackingUrl";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "estimatedDelivery";
ALTER TABLE "registry_purchases" DROP COLUMN IF EXISTS "metadata";

-- ============================================================================
-- PHASE 5: Remove Unique Constraints
-- ============================================================================

ALTER TABLE "registry_collaborators" DROP CONSTRAINT IF EXISTS "registry_collaborators_registryId_email_key";
ALTER TABLE "registry_collaborators" DROP CONSTRAINT IF EXISTS "registry_collaborators_inviteToken_key";

-- ============================================================================
-- PHASE 6: Validation
-- ============================================================================

DO $$
BEGIN
    -- Verify rollback completed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registry_purchases' 
        AND column_name = 'registryItemId'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: registryItemId still exists';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registry_purchases' 
        AND column_name = 'registryId'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: registryId not restored';
    END IF;
    
    RAISE NOTICE 'Schema drift rollback completed successfully';
END $$;