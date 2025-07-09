-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT
);

-- CreateTable
CREATE TABLE "registries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" DATETIME,
    "eventType" TEXT NOT NULL DEFAULT 'general',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "requiresPassword" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "registry_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "productHandle" TEXT NOT NULL,
    "productImage" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchased" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "price" REAL NOT NULL,
    "compareAtPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "registry_items_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registryItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "purchaserName" TEXT,
    "purchaserEmail" TEXT,
    "giftMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enableEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "fromEmail" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#007ace',
    "accentColor" TEXT NOT NULL DEFAULT '#f3f3f3',
    "enablePasswordProtection" BOOLEAN NOT NULL DEFAULT true,
    "enableGiftMessages" BOOLEAN NOT NULL DEFAULT true,
    "enableSocialSharing" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "registries_slug_key" ON "registries"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_shop_key" ON "app_settings"("shop");
