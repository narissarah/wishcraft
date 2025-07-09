/*
  Warnings:

  - You are about to drop the `app_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `customerName` on the `registries` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `registries` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `registries` table. All the data in the column will be lost.
  - You are about to drop the column `requiresPassword` on the `registries` table. All the data in the column will be lost.
  - You are about to drop the column `shop` on the `registries` table. All the data in the column will be lost.
  - You are about to drop the column `purchased` on the `registry_items` table. All the data in the column will be lost.
  - Added the required column `shopId` to the `registries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "app_settings_shop_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "app_settings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "purchases";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "zip" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "enablePasswordProtection" BOOLEAN NOT NULL DEFAULT true,
    "enableGiftMessages" BOOLEAN NOT NULL DEFAULT true,
    "enableSocialSharing" BOOLEAN NOT NULL DEFAULT true,
    "enableGroupGifting" BOOLEAN NOT NULL DEFAULT true,
    "enableAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "enableEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "fromEmail" TEXT,
    "emailTemplateId" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#007ace',
    "accentColor" TEXT NOT NULL DEFAULT '#f3f3f3',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "defaultRegistryVisibility" TEXT NOT NULL DEFAULT 'public',
    "maxItemsPerRegistry" INTEGER NOT NULL DEFAULT 100,
    "enableInventoryTracking" BOOLEAN NOT NULL DEFAULT true,
    "enableMultipleAddresses" BOOLEAN NOT NULL DEFAULT true,
    "defaultShippingZone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shop_settings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registry_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryItemId" TEXT NOT NULL,
    "orderId" TEXT,
    "lineItemId" TEXT,
    "orderName" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "purchaserType" TEXT NOT NULL DEFAULT 'customer',
    "purchaserId" TEXT,
    "purchaserEmail" TEXT,
    "purchaserName" TEXT,
    "purchaserPhone" TEXT,
    "isGift" BOOLEAN NOT NULL DEFAULT true,
    "giftMessage" TEXT,
    "giftWrapRequested" BOOLEAN NOT NULL DEFAULT false,
    "isGroupGift" BOOLEAN NOT NULL DEFAULT false,
    "groupGiftId" TEXT,
    "shippingAddressId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'unfulfilled',
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "estimatedDelivery" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "registry_purchases_registryItemId_fkey" FOREIGN KEY ("registryItemId") REFERENCES "registry_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "registry_purchases_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "registry_addresses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "group_gift_contributions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "contributorEmail" TEXT NOT NULL,
    "contributorName" TEXT,
    "contributorMessage" TEXT,
    "amount" REAL NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "paymentIntentId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "showAmount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "group_gift_contributions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "registry_purchases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registry_collaborators" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "permissions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "lastAccessAt" DATETIME,
    "inviteToken" TEXT,
    "inviteExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "registry_collaborators_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registry_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "message" TEXT,
    "inviteType" TEXT NOT NULL DEFAULT 'view',
    "sentAt" DATETIME,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'email',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "openedAt" DATETIME,
    "clickedAt" DATETIME,
    "respondedAt" DATETIME,
    "response" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "registry_invitations_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registry_addresses" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "registry_addresses_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registry_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'guest',
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "actorIp" TEXT,
    "metadata" TEXT,
    "itemId" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registry_activities_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "properties" TEXT,
    "value" REAL,
    "currency" TEXT,
    "registryId" TEXT,
    "itemId" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    CONSTRAINT "analytics_events_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "metafield_syncs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "localId" TEXT,
    "metafieldId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncAt" DATETIME,
    "lastErrorAt" DATETIME,
    "errorMessage" TEXT,
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,
    "value" TEXT,
    "valueType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "metafield_syncs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "payload" TEXT,
    "result" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "shopId" TEXT,
    "registryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "oldValues" TEXT,
    "newValues" TEXT,
    "changes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_registries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "eventType" TEXT NOT NULL DEFAULT 'general',
    "eventDate" DATETIME,
    "eventLocation" TEXT,
    "eventDetails" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "accessCode" TEXT,
    "allowAnonymousGifts" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerFirstName" TEXT,
    "customerLastName" TEXT,
    "customerPhone" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "purchasedValue" REAL NOT NULL DEFAULT 0,
    "completionRate" REAL NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "registries_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_registries" ("createdAt", "customerEmail", "customerId", "description", "eventDate", "eventType", "id", "slug", "title", "updatedAt") SELECT "createdAt", "customerEmail", "customerId", "description", "eventDate", "eventType", "id", "slug", "title", "updatedAt" FROM "registries";
DROP TABLE "registries";
ALTER TABLE "new_registries" RENAME TO "registries";
CREATE UNIQUE INDEX "registries_slug_key" ON "registries"("slug");
CREATE INDEX "registries_shopId_idx" ON "registries"("shopId");
CREATE INDEX "registries_customerId_idx" ON "registries"("customerId");
CREATE INDEX "registries_eventType_idx" ON "registries"("eventType");
CREATE INDEX "registries_visibility_idx" ON "registries"("visibility");
CREATE INDEX "registries_status_idx" ON "registries"("status");
CREATE TABLE "new_registry_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productHandle" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "productType" TEXT,
    "vendor" TEXT,
    "productImage" TEXT,
    "productImages" TEXT,
    "productUrl" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quantityPurchased" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "personalNote" TEXT,
    "price" REAL NOT NULL,
    "compareAtPrice" REAL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "allowGroupGifting" BOOLEAN NOT NULL DEFAULT true,
    "allowPartialGifting" BOOLEAN NOT NULL DEFAULT true,
    "minGiftAmount" REAL,
    "inventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "inventoryQuantity" INTEGER,
    "lastInventorySync" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "displayOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "registry_items_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_registry_items" ("compareAtPrice", "createdAt", "id", "notes", "price", "priority", "productHandle", "productId", "productImage", "productTitle", "quantity", "registryId", "updatedAt", "variantId", "variantTitle") SELECT "compareAtPrice", "createdAt", "id", "notes", "price", "priority", "productHandle", "productId", "productImage", "productTitle", "quantity", "registryId", "updatedAt", "variantId", "variantTitle" FROM "registry_items";
DROP TABLE "registry_items";
ALTER TABLE "new_registry_items" RENAME TO "registry_items";
CREATE INDEX "registry_items_registryId_idx" ON "registry_items"("registryId");
CREATE INDEX "registry_items_productId_idx" ON "registry_items"("productId");
CREATE INDEX "registry_items_variantId_idx" ON "registry_items"("variantId");
CREATE INDEX "registry_items_status_idx" ON "registry_items"("status");
CREATE INDEX "registry_items_priority_idx" ON "registry_items"("priority");
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_sessions" ("accessToken", "expires", "id", "isOnline", "scope", "shop", "state", "userId") SELECT "accessToken", "expires", "id", "isOnline", "scope", "shop", "state", "userId" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "shops_domain_key" ON "shops"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "shop_settings_shopId_key" ON "shop_settings"("shopId");

-- CreateIndex
CREATE INDEX "registry_purchases_registryItemId_idx" ON "registry_purchases"("registryItemId");

-- CreateIndex
CREATE INDEX "registry_purchases_orderId_idx" ON "registry_purchases"("orderId");

-- CreateIndex
CREATE INDEX "registry_purchases_purchaserEmail_idx" ON "registry_purchases"("purchaserEmail");

-- CreateIndex
CREATE INDEX "registry_purchases_status_idx" ON "registry_purchases"("status");

-- CreateIndex
CREATE INDEX "registry_purchases_groupGiftId_idx" ON "registry_purchases"("groupGiftId");

-- CreateIndex
CREATE INDEX "group_gift_contributions_purchaseId_idx" ON "group_gift_contributions"("purchaseId");

-- CreateIndex
CREATE INDEX "group_gift_contributions_contributorEmail_idx" ON "group_gift_contributions"("contributorEmail");

-- CreateIndex
CREATE INDEX "group_gift_contributions_paymentStatus_idx" ON "group_gift_contributions"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "registry_collaborators_inviteToken_key" ON "registry_collaborators"("inviteToken");

-- CreateIndex
CREATE INDEX "registry_collaborators_email_idx" ON "registry_collaborators"("email");

-- CreateIndex
CREATE INDEX "registry_collaborators_status_idx" ON "registry_collaborators"("status");

-- CreateIndex
CREATE UNIQUE INDEX "registry_collaborators_registryId_email_key" ON "registry_collaborators"("registryId", "email");

-- CreateIndex
CREATE INDEX "registry_invitations_registryId_idx" ON "registry_invitations"("registryId");

-- CreateIndex
CREATE INDEX "registry_invitations_email_idx" ON "registry_invitations"("email");

-- CreateIndex
CREATE INDEX "registry_invitations_deliveryStatus_idx" ON "registry_invitations"("deliveryStatus");

-- CreateIndex
CREATE INDEX "registry_addresses_registryId_idx" ON "registry_addresses"("registryId");

-- CreateIndex
CREATE INDEX "registry_addresses_type_idx" ON "registry_addresses"("type");

-- CreateIndex
CREATE INDEX "registry_activities_registryId_idx" ON "registry_activities"("registryId");

-- CreateIndex
CREATE INDEX "registry_activities_type_idx" ON "registry_activities"("type");

-- CreateIndex
CREATE INDEX "registry_activities_actorEmail_idx" ON "registry_activities"("actorEmail");

-- CreateIndex
CREATE INDEX "registry_activities_createdAt_idx" ON "registry_activities"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_shopId_idx" ON "analytics_events"("shopId");

-- CreateIndex
CREATE INDEX "analytics_events_event_idx" ON "analytics_events"("event");

-- CreateIndex
CREATE INDEX "analytics_events_category_idx" ON "analytics_events"("category");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_registryId_idx" ON "analytics_events"("registryId");

-- CreateIndex
CREATE INDEX "metafield_syncs_status_idx" ON "metafield_syncs"("status");

-- CreateIndex
CREATE INDEX "metafield_syncs_lastSyncAt_idx" ON "metafield_syncs"("lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "metafield_syncs_shopId_namespace_key_ownerId_key" ON "metafield_syncs"("shopId", "namespace", "key", "ownerId");

-- CreateIndex
CREATE INDEX "system_jobs_status_idx" ON "system_jobs"("status");

-- CreateIndex
CREATE INDEX "system_jobs_type_idx" ON "system_jobs"("type");

-- CreateIndex
CREATE INDEX "system_jobs_priority_idx" ON "system_jobs"("priority");

-- CreateIndex
CREATE INDEX "system_jobs_runAt_idx" ON "system_jobs"("runAt");

-- CreateIndex
CREATE INDEX "audit_logs_shopId_idx" ON "audit_logs"("shopId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
