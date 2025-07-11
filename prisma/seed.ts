import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding WishCraft database with comprehensive data...");

  // Clean up existing data in correct order (respecting foreign key constraints)
  await prisma.auditLog.deleteMany();
  await prisma.systemJob.deleteMany();
  await prisma.registryPurchase.deleteMany();
  await prisma.registryItem.deleteMany();
  await prisma.registry.deleteMany();
  await prisma.shopSettings.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.session.deleteMany();

  console.log("🗑️  Cleaned up existing data");

  // Create sample shop
  const shop = await prisma.shop.create({
    data: {
      id: "gid://shopify/Shop/1234567890",
      domain: "wishcraft-demo.myshopify.com",
      name: "WishCraft Demo Store",
      email: "admin@wishcraft-demo.myshopify.com",
      currencyCode: "USD"
    }
  });

  // Create shop settings
  await prisma.shopSettings.create({
    data: {
      shopId: shop.id,
      enablePasswordProtection: true,
      enableGiftMessages: true,
      enableSocialSharing: true,
      enableEmailNotifications: true,
      primaryColor: "#007ace",
      accentColor: "#f3f3f3",
      defaultRegistryVisibility: "public",
      maxItemsPerRegistry: 100,
      enableInventoryTracking: true
    }
  });

  console.log("🏪 Created shop and settings");

  // Create sample registries
  const weddingRegistry = await prisma.registry.create({
    data: {
      title: "Sarah & John's Wedding Registry",
      description: "Help us celebrate our special day! We're so grateful for your love and support as we start this new chapter together.",
      slug: "sarah-john-wedding-2024",
      status: "active",
      eventType: "wedding",
      eventDate: new Date("2024-08-15"),
      visibility: "public",
      shopId: shop.id,
      customerId: "gid://shopify/Customer/6543210987654321",
      customerEmail: "sarah.smith@example.com",
      customerFirstName: "Sarah",
      customerLastName: "Smith",
      views: 156,
      totalValue: 2847.95,
      purchasedValue: 1299.97
    }
  });

  const babyRegistry = await prisma.registry.create({
    data: {
      title: "Baby Johnson's Nursery",
      description: "We're expecting our little bundle of joy! Help us prepare for our new arrival.",
      slug: "baby-johnson-2024",
      status: "active",
      eventType: "baby",
      eventDate: new Date("2024-09-20"),
      visibility: "public",
      shopId: shop.id,
      customerId: "gid://shopify/Customer/7890123456789012",
      customerEmail: "emily.johnson@example.com",
      customerFirstName: "Emily",
      customerLastName: "Johnson",
      views: 73,
      totalValue: 1567.88,
      purchasedValue: 234.99
    }
  });

  console.log("📋 Created sample registries");

  // Create sample registry items
  await prisma.registryItem.create({
    data: {
      registryId: weddingRegistry.id,
      productId: "gid://shopify/Product/1234567890",
      productHandle: "kitchenaid-mixer",
      productTitle: "KitchenAid Professional Stand Mixer",
      quantity: 1,
      priority: "high",
      notes: "Perfect for baking together!",
      price: 399.99,
      currencyCode: "USD"
    }
  });

  await prisma.registryItem.create({
    data: {
      registryId: babyRegistry.id,
      productId: "gid://shopify/Product/9876543210",
      productHandle: "baby-crib",
      productTitle: "Convertible Baby Crib",
      quantity: 1,
      priority: "high",
      notes: "Woodland theme preferred",
      price: 299.99,
      currencyCode: "USD"
    }
  });

  console.log("🎁 Created sample registry items");
  
  console.log("✅ Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
