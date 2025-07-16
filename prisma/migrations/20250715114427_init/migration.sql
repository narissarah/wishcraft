-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "enablePasswordProtection" BOOLEAN NOT NULL DEFAULT true,
    "enableGiftMessages" BOOLEAN NOT NULL DEFAULT true,
    "enableSocialSharing" BOOLEAN NOT NULL DEFAULT true,
    "enableEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "primaryColor" TEXT NOT NULL DEFAULT '#007ace',
    "accentColor" TEXT NOT NULL DEFAULT '#f3f3f3',
    "defaultRegistryVisibility" TEXT NOT NULL DEFAULT 'public',
    "maxItemsPerRegistry" INTEGER NOT NULL DEFAULT 100,
    "enableInventoryTracking" BOOLEAN NOT NULL DEFAULT true,
    "appActive" BOOLEAN NOT NULL DEFAULT true,
    "appUninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "eventType" TEXT NOT NULL DEFAULT 'general',
    "eventDate" TIMESTAMP(3),
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "accessCode" TEXT,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerFirstName" TEXT,
    "customerLastName" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_items" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productHandle" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "productImage" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quantityPurchased" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "compareAtPrice" DOUBLE PRECISION,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "inventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "inventoryQuantity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_purchases" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "orderId" TEXT,
    "lineItemId" TEXT,
    "orderName" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "purchaserEmail" TEXT,
    "purchaserName" TEXT,
    "isGift" BOOLEAN NOT NULL DEFAULT true,
    "giftMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "payload" TEXT,
    "result" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "shopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_shop_userId_idx" ON "sessions"("shop", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "shops_domain_key" ON "shops"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "shop_settings_shopId_key" ON "shop_settings"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "registries_slug_key" ON "registries"("slug");

-- CreateIndex
CREATE INDEX "registries_shopId_idx" ON "registries"("shopId");

-- CreateIndex
CREATE INDEX "registries_customerId_idx" ON "registries"("customerId");

-- CreateIndex
CREATE INDEX "registries_status_idx" ON "registries"("status");

-- CreateIndex
CREATE INDEX "registries_shopId_status_idx" ON "registries"("shopId", "status");

-- CreateIndex
CREATE INDEX "registries_customerId_eventDate_idx" ON "registries"("customerId", "eventDate");

-- CreateIndex
CREATE INDEX "registry_items_registryId_idx" ON "registry_items"("registryId");

-- CreateIndex
CREATE INDEX "registry_items_productId_idx" ON "registry_items"("productId");

-- CreateIndex
CREATE INDEX "registry_items_status_idx" ON "registry_items"("status");

-- CreateIndex
CREATE INDEX "registry_items_registryId_status_idx" ON "registry_items"("registryId", "status");

-- CreateIndex
CREATE INDEX "registry_items_productId_inventoryTracked_idx" ON "registry_items"("productId", "inventoryTracked");

-- CreateIndex
CREATE INDEX "registry_purchases_registryId_idx" ON "registry_purchases"("registryId");

-- CreateIndex
CREATE INDEX "registry_purchases_orderId_idx" ON "registry_purchases"("orderId");

-- CreateIndex
CREATE INDEX "registry_purchases_status_idx" ON "registry_purchases"("status");

-- CreateIndex
CREATE INDEX "registry_purchases_registryId_status_idx" ON "registry_purchases"("registryId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_shopId_idx" ON "audit_logs"("shopId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_shopId_timestamp_idx" ON "audit_logs"("shopId", "timestamp");

-- CreateIndex
CREATE INDEX "system_jobs_status_idx" ON "system_jobs"("status");

-- CreateIndex
CREATE INDEX "system_jobs_type_idx" ON "system_jobs"("type");

-- CreateIndex
CREATE INDEX "system_jobs_runAt_idx" ON "system_jobs"("runAt");

-- CreateIndex
CREATE INDEX "system_jobs_status_priority_runAt_idx" ON "system_jobs"("status", "priority", "runAt");

-- AddForeignKey
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registries" ADD CONSTRAINT "registries_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_items" ADD CONSTRAINT "registry_items_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_purchases" ADD CONSTRAINT "registry_purchases_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
