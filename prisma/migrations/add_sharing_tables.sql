-- Add sharing-related tables to support social media and email sharing

-- Registry shares tracking table
CREATE TABLE IF NOT EXISTS "RegistryShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sharedBy" TEXT,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "RegistryShare_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "RegistryShare_registryId_idx" ON "RegistryShare"("registryId");
CREATE INDEX IF NOT EXISTS "RegistryShare_platform_idx" ON "RegistryShare"("platform");
CREATE INDEX IF NOT EXISTS "RegistryShare_sharedAt_idx" ON "RegistryShare"("sharedAt");
CREATE INDEX IF NOT EXISTS "RegistryShare_sharedBy_idx" ON "RegistryShare"("sharedBy");

-- Add sharing-related fields to RegistryInvitation table if they don't exist
ALTER TABLE "RegistryInvitation" ADD COLUMN IF NOT EXISTS "useCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RegistryInvitation" ADD COLUMN IF NOT EXISTS "maxUses" INTEGER;
ALTER TABLE "RegistryInvitation" ADD COLUMN IF NOT EXISTS "allowGuests" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RegistryInvitation" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "RegistryInvitation" ADD COLUMN IF NOT EXISTS "metadata" TEXT;