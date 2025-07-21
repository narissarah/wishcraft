-- Critical Schema Drift Fix Migration
-- Fixes major inconsistencies between schema.prisma and actual database
-- Created: 2025-01-20 to resolve audit findings

-- ============================================================================
-- PHASE 1: Fix Registry Purchase Relationship (CRITICAL)
-- ============================================================================

-- Step 1: Check if the current table structure matches migrations
DO $$ 
BEGIN
    -- If registryItemId doesn't exist, we need to fix the relationship
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registry_purchases' 
        AND column_name = 'registryItemId'
    ) THEN
        -- Add the correct registryItemId column
        ALTER TABLE "registry_purchases" ADD COLUMN "registryItemId" TEXT;
        
        -- Migrate data: Set registryItemId based on registryId (temporary fix)
        -- This assumes we want to link to the first item in each registry
        UPDATE "registry_purchases" 
        SET "registryItemId" = (
            SELECT "id" 
            FROM "registry_items" 
            WHERE "registryId" = "registry_purchases"."registryId" 
            LIMIT 1
        ) 
        WHERE "registryItemId" IS NULL;
        
        -- Drop the old foreign key constraint
        ALTER TABLE "registry_purchases" DROP CONSTRAINT IF EXISTS "registry_purchases_registryId_fkey";
        
        -- Add the new foreign key constraint
        ALTER TABLE "registry_purchases" ADD CONSTRAINT "registry_purchases_registryItemId_fkey" 
            FOREIGN KEY ("registryItemId") REFERENCES "registry_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        
        -- Update indexes: drop old registryId indexes
        DROP INDEX IF EXISTS "registry_purchases_registryId_idx";
        DROP INDEX IF EXISTS "registry_purchases_registryId_status_idx";
        DROP INDEX IF EXISTS "registry_purchases_registry_created_at_idx";
        
        -- Create new registryItemId indexes
        CREATE INDEX "registry_purchases_registryItemId_idx" ON "registry_purchases"("registryItemId");
        
        -- We can keep registryId column for now to avoid breaking existing queries
        -- Mark it as deprecated with a comment
        COMMENT ON COLUMN "registry_purchases"."registryId" IS 'DEPRECATED: Use registryItemId instead. Will be removed in future migration.';
    END IF;
END $$;

-- ============================================================================
-- PHASE 2: Create Missing Tables
-- ============================================================================

-- Create group_gift_contributions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "group_gift_contributions" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "contributorEmail" TEXT NOT NULL,
    "contributorName" TEXT,
    "contributorMessage" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "paymentIntentId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "showAmount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "group_gift_contributions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for group_gift_contributions
ALTER TABLE "group_gift_contributions" 
    ADD CONSTRAINT IF NOT EXISTS "group_gift_contributions_purchaseId_fkey" 
    FOREIGN KEY ("purchaseId") REFERENCES "registry_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create metafield_syncs table if it doesn't exist
CREATE TABLE IF NOT EXISTS "metafield_syncs" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "localId" TEXT,
    "metafieldId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,
    "value" TEXT,
    "valueType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "metafield_syncs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for metafield_syncs
ALTER TABLE "metafield_syncs" 
    ADD CONSTRAINT IF NOT EXISTS "metafield_syncs_shopId_fkey" 
    FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create registry_addresses table if it doesn't exist
CREATE TABLE IF NOT EXISTS "registry_addresses" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'shipping',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT,
    "country" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "phone" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "registry_addresses_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for registry_addresses
ALTER TABLE "registry_addresses" 
    ADD CONSTRAINT IF NOT EXISTS "registry_addresses_registryId_fkey" 
    FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create registry_invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "registry_invitations" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "message" TEXT,
    "inviteType" TEXT NOT NULL DEFAULT 'view',
    "sentAt" TIMESTAMP(3),
    "deliveryMethod" TEXT NOT NULL DEFAULT 'email',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "response" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "registry_invitations_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for registry_invitations
ALTER TABLE "registry_invitations" 
    ADD CONSTRAINT IF NOT EXISTS "registry_invitations_registryId_fkey" 
    FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- PHASE 3: Add Missing Session Security Fields
-- ============================================================================

-- Add missing session fields to match schema.prisma
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "accountOwner" BOOLEAN DEFAULT false;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "locale" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "collaborator" BOOLEAN DEFAULT false;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT false;

-- ============================================================================
-- PHASE 4: Add Missing Registry Purchase Fields
-- ============================================================================

-- Add missing fields to registry_purchases to match schema.prisma
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "purchaserType" TEXT DEFAULT 'customer';
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "purchaserId" TEXT;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "purchaserPhone" TEXT;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "giftWrapRequested" BOOLEAN DEFAULT false;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "isGroupGift" BOOLEAN DEFAULT false;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "groupGiftId" TEXT;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "shippingAddressId" TEXT;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'pending';
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT DEFAULT 'unfulfilled';
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "estimatedDelivery" TIMESTAMP(3);
ALTER TABLE "registry_purchases" ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- ============================================================================
-- PHASE 5: Create Missing Indexes
-- ============================================================================

-- Indexes for group_gift_contributions
CREATE INDEX IF NOT EXISTS "group_gift_contributions_purchaseId_idx" ON "group_gift_contributions"("purchaseId");
CREATE INDEX IF NOT EXISTS "group_gift_contributions_contributorEmail_idx" ON "group_gift_contributions"("contributorEmail");
CREATE INDEX IF NOT EXISTS "group_gift_contributions_paymentStatus_idx" ON "group_gift_contributions"("paymentStatus");

-- Indexes for metafield_syncs
CREATE INDEX IF NOT EXISTS "metafield_syncs_shopId_idx" ON "metafield_syncs"("shopId");
CREATE INDEX IF NOT EXISTS "metafield_syncs_status_idx" ON "metafield_syncs"("status");
CREATE INDEX IF NOT EXISTS "metafield_syncs_lastSyncAt_idx" ON "metafield_syncs"("lastSyncAt");
CREATE UNIQUE INDEX IF NOT EXISTS "metafield_syncs_shopId_namespace_key_ownerId_key" 
    ON "metafield_syncs"("shopId", "namespace", "key", "ownerId");

-- Indexes for registry_addresses
CREATE INDEX IF NOT EXISTS "registry_addresses_registryId_idx" ON "registry_addresses"("registryId");
CREATE INDEX IF NOT EXISTS "registry_addresses_type_idx" ON "registry_addresses"("type");

-- Indexes for registry_invitations
CREATE INDEX IF NOT EXISTS "registry_invitations_registryId_idx" ON "registry_invitations"("registryId");
CREATE INDEX IF NOT EXISTS "registry_invitations_email_idx" ON "registry_invitations"("email");
CREATE INDEX IF NOT EXISTS "registry_invitations_deliveryStatus_idx" ON "registry_invitations"("deliveryStatus");

-- Additional indexes for new registry_purchases fields
CREATE INDEX IF NOT EXISTS "registry_purchases_groupGiftId_idx" ON "registry_purchases"("groupGiftId") WHERE "groupGiftId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "registry_purchases_purchaserEmail_idx" ON "registry_purchases"("purchaserEmail") WHERE "purchaserEmail" IS NOT NULL;

-- ============================================================================
-- PHASE 6: Add Missing Unique Constraints
-- ============================================================================

-- Add unique constraints mentioned in schema.prisma
ALTER TABLE "registry_collaborators" 
    ADD CONSTRAINT IF NOT EXISTS "registry_collaborators_registryId_email_key" 
    UNIQUE ("registryId", "email");

ALTER TABLE "registry_collaborators" 
    ADD CONSTRAINT IF NOT EXISTS "registry_collaborators_inviteToken_key" 
    UNIQUE ("inviteToken");

-- ============================================================================
-- PHASE 7: Data Integrity Fixes
-- ============================================================================

-- Update any NULL registryItemId values that weren't caught earlier
UPDATE "registry_purchases" 
SET "registryItemId" = (
    SELECT "id" 
    FROM "registry_items" 
    WHERE "registry_items"."registryId" = "registry_purchases"."registryId" 
    ORDER BY "registry_items"."createdAt" ASC 
    LIMIT 1
) 
WHERE "registryItemId" IS NULL 
AND "registryId" IS NOT NULL;

-- Set NOT NULL constraint on registryItemId after data migration
ALTER TABLE "registry_purchases" ALTER COLUMN "registryItemId" SET NOT NULL;

-- ============================================================================
-- PHASE 8: Add Comments for Documentation
-- ============================================================================

COMMENT ON TABLE "group_gift_contributions" IS 'Tracks individual contributions to group gifts for registry items';
COMMENT ON TABLE "metafield_syncs" IS 'Manages synchronization of metafields between app and Shopify';
COMMENT ON TABLE "registry_addresses" IS 'Shipping and billing addresses associated with registries';
COMMENT ON TABLE "registry_invitations" IS 'Tracks registry sharing invitations sent to users';

COMMENT ON COLUMN "registry_purchases"."registryItemId" IS 'Primary foreign key to registry_items table';
COMMENT ON COLUMN "registry_purchases"."registryId" IS 'DEPRECATED: Legacy field, use registryItemId instead';

-- ============================================================================
-- PHASE 9: Validation
-- ============================================================================

-- Verify all tables exist
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
BEGIN
    -- Check for required tables
    FOR table_name IN SELECT unnest(ARRAY[
        'group_gift_contributions',
        'metafield_syncs', 
        'registry_addresses',
        'registry_invitations'
    ]) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = table_name
        ) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Migration failed: Missing tables: %', array_to_string(missing_tables, ', ');
    END IF;
    
    RAISE NOTICE 'Schema drift fix migration completed successfully';
END $$;