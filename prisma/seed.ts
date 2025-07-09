import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding WishCraft database with comprehensive data...");

  // Clean up existing data in correct order (respecting foreign key constraints)
  await prisma.auditLog.deleteMany();
  await prisma.systemJob.deleteMany();
  await prisma.metafieldSync.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.registryActivity.deleteMany();
  await prisma.groupGiftContribution.deleteMany();
  await prisma.registryPurchase.deleteMany();
  await prisma.registryInvitation.deleteMany();
  await prisma.registryCollaborator.deleteMany();
  await prisma.registryAddress.deleteMany();
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
      phone: "+1-555-123-4567",
      address1: "123 Commerce Street",
      city: "San Francisco",
      province: "CA",
      country: "US",
      zip: "94102",
      currencyCode: "USD",
      timezone: "America/Los_Angeles"
    }
  });

  // Create shop settings
  await prisma.shopSettings.create({
    data: {
      shopId: shop.id,
      enablePasswordProtection: true,
      enableGiftMessages: true,
      enableSocialSharing: true,
      enableGroupGifting: true,
      enableAnalytics: true,
      enableEmailNotifications: true,
      fromEmail: "noreply@wishcraft-demo.myshopify.com",
      emailTemplateId: "template_123",
      primaryColor: "#007ace",
      accentColor: "#f3f3f3",
      fontFamily: "Inter",
      defaultRegistryVisibility: "public",
      maxItemsPerRegistry: 100,
      enableInventoryTracking: true,
      enableMultipleAddresses: true,
      defaultShippingZone: "US"
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
      eventLocation: "Napa Valley, CA",
      eventDetails: JSON.stringify({
        venue: "Meadowood Resort",
        time: "4:00 PM",
        dress_code: "Cocktail Attire",
        rsvp_deadline: "2024-07-01"
      }),
      visibility: "public",
      allowAnonymousGifts: true,
      requiresApproval: false,
      shopId: shop.id,
      customerId: "gid://shopify/Customer/6543210987654321",
      customerEmail: "sarah.smith@example.com",
      customerFirstName: "Sarah",
      customerLastName: "Smith",
      customerPhone: "+1-555-987-6543",
      views: 156,
      uniqueViews: 89,
      totalValue: 2847.95,
      purchasedValue: 1299.97,
      completionRate: 45.6,
      metadata: JSON.stringify({
        theme: "rustic",
        colors: ["sage", "ivory", "gold"],
        preferences: {
          gift_wrapping: true,
          delivery_instructions: "Please coordinate delivery with venue"
        }
      }),
      tags: "wedding,2024,napa,registry"
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
      eventLocation: "Seattle, WA",
      eventDetails: JSON.stringify({
        due_date: "2024-09-20",
        gender: "surprise",
        nursery_theme: "woodland",
        hospital: "Seattle Children's Hospital"
      }),
      visibility: "friends",
      allowAnonymousGifts: false,
      requiresApproval: true,
      shopId: shop.id,
      customerId: "gid://shopify/Customer/7890123456789012",
      customerEmail: "emily.johnson@example.com",
      customerFirstName: "Emily",
      customerLastName: "Johnson",
      customerPhone: "+1-555-234-5678",
      views: 73,
      uniqueViews: 45,
      totalValue: 1567.88,
      purchasedValue: 234.99,
      completionRate: 15.0,
      metadata: JSON.stringify({
        theme: "woodland",
        colors: ["forest_green", "cream", "brown"],
        size_preferences: {
          clothing: "0-12 months",
          diapers: "newborn"
        }
      }),
      tags: "baby,2024,seattle,woodland"
    }
  });

  console.log("📋 Created sample registries");

  // Create registry addresses
  const weddingAddress = await prisma.registryAddress.create({
    data: {
      registryId: weddingRegistry.id,
      type: "shipping",
      isDefault: true,
      label: "Home Address",
      firstName: "Sarah",
      lastName: "Smith",
      address1: "456 Elm Street",
      address2: "Apt 3B",
      city: "San Francisco",
      province: "CA",
      country: "US",
      zip: "94103",
      phone: "+1-555-987-6543",
      isVerified: true,
      verificationData: JSON.stringify({
        verified_at: "2024-01-15T10:30:00Z",
        service: "USPS",
        confidence: 0.98
      })
    }
  });

  const venueAddress = await prisma.registryAddress.create({
    data: {
      registryId: weddingRegistry.id,
      type: "event",
      isDefault: false,
      label: "Wedding Venue",
      firstName: "Sarah",
      lastName: "Smith",
      company: "Meadowood Resort",
      address1: "900 Meadowood Ln",
      city: "St Helena",
      province: "CA",
      country: "US",
      zip: "94574",
      phone: "+1-707-963-3646",
      isVerified: true
    }
  });

  // Create registry items with realistic product data
  const items = await Promise.all([
    // Wedding Registry Items
    prisma.registryItem.create({
      data: {
        registryId: weddingRegistry.id,
        productId: "gid://shopify/Product/1234567890123456",
        variantId: "gid://shopify/ProductVariant/1234567890123456",
        productHandle: "premium-coffee-maker",
        productTitle: "Premium Coffee Maker",
        variantTitle: "Stainless Steel - 12 Cup",
        productType: "Kitchen Appliances",
        vendor: "Breville",
        productImage: "https://cdn.shopify.com/products/coffee-maker-main.jpg",
        productImages: JSON.stringify([
          "https://cdn.shopify.com/products/coffee-maker-main.jpg",
          "https://cdn.shopify.com/products/coffee-maker-side.jpg",
          "https://cdn.shopify.com/products/coffee-maker-parts.jpg"
        ]),
        productUrl: "https://wishcraft-demo.myshopify.com/products/premium-coffee-maker",
        description: "Professional-grade coffee maker with programmable features and thermal carafe.",
        quantity: 1,
        quantityPurchased: 1,
        priority: "high",
        notes: "Perfect for our morning routine! We love good coffee.",
        personalNote: "This is exactly what we wanted for the kitchen.",
        price: 299.99,
        compareAtPrice: 349.99,
        currencyCode: "USD",
        allowGroupGifting: true,
        allowPartialGifting: false,
        inventoryTracked: true,
        inventoryQuantity: 15,
        status: "active",
        displayOrder: 1,
        metadata: JSON.stringify({
          features: ["programmable", "thermal_carafe", "auto_shutoff"],
          warranty: "2_years",
          color: "stainless_steel"
        })
      }
    }),

    prisma.registryItem.create({
      data: {
        registryId: weddingRegistry.id,
        productId: "gid://shopify/Product/2345678901234567",
        variantId: "gid://shopify/ProductVariant/2345678901234567",
        productHandle: "luxury-bed-sheets",
        productTitle: "Luxury Egyptian Cotton Sheet Set",
        variantTitle: "Queen Size - Ivory",
        productType: "Bedding",
        vendor: "Brooklinen",
        productImage: "https://cdn.shopify.com/products/sheets-main.jpg",
        productImages: JSON.stringify([
          "https://cdn.shopify.com/products/sheets-main.jpg",
          "https://cdn.shopify.com/products/sheets-detail.jpg"
        ]),
        productUrl: "https://wishcraft-demo.myshopify.com/products/luxury-bed-sheets",
        description: "800 thread count Egyptian cotton sheets with deep pockets.",
        quantity: 2,
        quantityPurchased: 0,
        priority: "medium",
        notes: "We'd love these in ivory or white to match our bedroom.",
        price: 199.99,
        compareAtPrice: 249.99,
        currencyCode: "USD",
        allowGroupGifting: true,
        allowPartialGifting: true,
        minGiftAmount: 50.00,
        inventoryTracked: true,
        inventoryQuantity: 8,
        status: "active",
        displayOrder: 2
      }
    }),

    prisma.registryItem.create({
      data: {
        registryId: weddingRegistry.id,
        productId: "gid://shopify/Product/3456789012345678",
        variantId: "gid://shopify/ProductVariant/3456789012345678",
        productHandle: "kitchen-knife-set",
        productTitle: "Professional Chef's Knife Set",
        variantTitle: "8-Piece Set with Block",
        productType: "Kitchen Tools",
        vendor: "Wüsthof",
        productImage: "https://cdn.shopify.com/products/knife-set-main.jpg",
        productUrl: "https://wishcraft-demo.myshopify.com/products/kitchen-knife-set",
        description: "German steel knife set with ergonomic handles and wooden block.",
        quantity: 1,
        quantityPurchased: 0,
        priority: "medium",
        notes: "For all our cooking adventures together!",
        price: 399.99,
        currencyCode: "USD",
        allowGroupGifting: true,
        allowPartialGifting: true,
        minGiftAmount: 100.00,
        inventoryTracked: true,
        inventoryQuantity: 3,
        status: "active",
        displayOrder: 3
      }
    }),

    // Baby Registry Items
    prisma.registryItem.create({
      data: {
        registryId: babyRegistry.id,
        productId: "gid://shopify/Product/4567890123456789",
        variantId: "gid://shopify/ProductVariant/4567890123456789",
        productHandle: "convertible-crib",
        productTitle: "Convertible 4-in-1 Crib",
        variantTitle: "Natural Wood",
        productType: "Baby Furniture",
        vendor: "DaVinci",
        productImage: "https://cdn.shopify.com/products/crib-main.jpg",
        description: "Converts from crib to toddler bed, daybed, and full-size bed.",
        quantity: 1,
        quantityPurchased: 0,
        priority: "high",
        notes: "Essential for the nursery! Natural wood to match our theme.",
        price: 349.99,
        currencyCode: "USD",
        allowGroupGifting: true,
        allowPartialGifting: true,
        minGiftAmount: 50.00,
        inventoryTracked: true,
        inventoryQuantity: 2,
        status: "active",
        displayOrder: 1
      }
    }),

    prisma.registryItem.create({
      data: {
        registryId: babyRegistry.id,
        productId: "gid://shopify/Product/5678901234567890",
        variantId: "gid://shopify/ProductVariant/5678901234567890",
        productHandle: "baby-monitor",
        productTitle: "Video Baby Monitor with App",
        variantTitle: "HD Camera with Night Vision",
        productType: "Baby Electronics",
        vendor: "Owlet",
        productImage: "https://cdn.shopify.com/products/monitor-main.jpg",
        description: "Smart baby monitor with HD video, two-way audio, and mobile app.",
        quantity: 1,
        quantityPurchased: 1,
        priority: "high",
        notes: "Peace of mind for new parents!",
        price: 199.99,
        currencyCode: "USD",
        allowGroupGifting: false,
        allowPartialGifting: false,
        inventoryTracked: true,
        inventoryQuantity: 12,
        status: "active",
        displayOrder: 2
      }
    })
  ]);

  console.log("🎁 Created registry items");

  // Create registry purchases
  const purchase1 = await prisma.registryPurchase.create({
    data: {
      registryItemId: items[0].id, // Coffee maker
      orderId: "gid://shopify/Order/1234567890",
      lineItemId: "gid://shopify/LineItem/1234567890",
      orderName: "#1001",
      quantity: 1,
      unitPrice: 299.99,
      totalAmount: 299.99,
      currencyCode: "USD",
      purchaserType: "customer",
      purchaserId: "gid://shopify/Customer/9876543210987654",
      purchaserEmail: "emma.johnson@example.com",
      purchaserName: "Emma Johnson",
      isGift: true,
      giftMessage: "Congratulations on your wedding! Wishing you a lifetime of happiness together. ❤️",
      giftWrapRequested: true,
      isGroupGift: false,
      shippingAddressId: weddingAddress.id,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "fulfilled",
      trackingNumber: "1Z999AA1234567890",
      trackingUrl: "https://ups.com/track?tracknum=1Z999AA1234567890"
    }
  });

  const groupPurchase = await prisma.registryPurchase.create({
    data: {
      registryItemId: items[1].id, // Bed sheets
      quantity: 2,
      unitPrice: 199.99,
      totalAmount: 399.98,
      currencyCode: "USD",
      purchaserType: "guest",
      purchaserEmail: "group.organizer@example.com",
      purchaserName: "Wedding Group",
      isGift: true,
      giftMessage: "From all your college friends! Can't wait to celebrate with you!",
      isGroupGift: true,
      groupGiftId: "group_gift_12345",
      shippingAddressId: weddingAddress.id,
      status: "pending",
      paymentStatus: "pending",
      fulfillmentStatus: "unfulfilled"
    }
  });

  // Create group gift contributions
  await Promise.all([
    prisma.groupGiftContribution.create({
      data: {
        purchaseId: groupPurchase.id,
        contributorEmail: "alice.williams@example.com",
        contributorName: "Alice Williams",
        contributorMessage: "So excited for you both!",
        amount: 100.00,
        currencyCode: "USD",
        paymentStatus: "paid",
        isAnonymous: false,
        showAmount: true
      }
    }),
    prisma.groupGiftContribution.create({
      data: {
        purchaseId: groupPurchase.id,
        contributorEmail: "bob.davis@example.com",
        contributorName: "Bob Davis",
        contributorMessage: "Congrats!",
        amount: 75.00,
        currencyCode: "USD",
        paymentStatus: "paid",
        isAnonymous: false,
        showAmount: false
      }
    }),
    prisma.groupGiftContribution.create({
      data: {
        purchaseId: groupPurchase.id,
        contributorEmail: "charlie.brown@example.com",
        contributorName: "Charlie Brown",
        amount: 50.00,
        currencyCode: "USD",
        paymentStatus: "pending",
        isAnonymous: true,
        showAmount: false
      }
    })
  ]);

  console.log("💳 Created purchases and group contributions");

  // Create collaborators
  await prisma.registryCollaborator.create({
    data: {
      registryId: weddingRegistry.id,
      email: "john.smith@example.com",
      name: "John Smith",
      role: "editor",
      permissions: JSON.stringify({
        can_add_items: true,
        can_remove_items: true,
        can_edit_registry: true,
        can_view_purchases: true,
        can_manage_addresses: true
      }),
      status: "active",
      acceptedAt: new Date("2024-01-10T14:30:00Z")
    }
  });

  // Create invitations
  await Promise.all([
    prisma.registryInvitation.create({
      data: {
        registryId: weddingRegistry.id,
        email: "mom.smith@example.com",
        name: "Mrs. Smith",
        message: "Come see what Sarah and John would love for their wedding!",
        inviteType: "view",
        sentAt: new Date("2024-01-15T10:00:00Z"),
        deliveryMethod: "email",
        deliveryStatus: "delivered",
        openedAt: new Date("2024-01-15T11:30:00Z"),
        clickedAt: new Date("2024-01-15T11:35:00Z"),
        respondedAt: new Date("2024-01-15T12:00:00Z"),
        response: "accepted"
      }
    }),
    prisma.registryInvitation.create({
      data: {
        registryId: weddingRegistry.id,
        email: "best.friend@example.com",
        name: "Jessica",
        message: "Check out our wedding registry!",
        inviteType: "collaborate",
        sentAt: new Date("2024-01-20T15:00:00Z"),
        deliveryMethod: "email",
        deliveryStatus: "sent",
        reminderSent: false
      }
    })
  ]);

  // Create activity logs
  const activities = [
    {
      registryId: weddingRegistry.id,
      type: "registry_created",
      description: "Registry was created",
      actorType: "owner",
      actorId: "gid://shopify/Customer/6543210987654321",
      actorEmail: "sarah.smith@example.com",
      actorName: "Sarah Smith",
      createdAt: new Date("2024-01-01T10:00:00Z")
    },
    {
      registryId: weddingRegistry.id,
      type: "item_added", 
      description: "Added Premium Coffee Maker to registry",
      actorType: "owner",
      actorEmail: "sarah.smith@example.com",
      itemId: items[0].id,
      createdAt: new Date("2024-01-02T14:30:00Z")
    },
    {
      registryId: weddingRegistry.id,
      type: "registry_viewed",
      description: "Registry was viewed",
      actorType: "guest",
      actorEmail: "emma.johnson@example.com",
      actorIp: "192.168.1.100",
      createdAt: new Date("2024-01-10T09:15:00Z")
    },
    {
      registryId: weddingRegistry.id,
      type: "item_purchased",
      description: "Premium Coffee Maker was purchased",
      actorType: "guest",
      actorEmail: "emma.johnson@example.com",
      itemId: items[0].id,
      metadata: JSON.stringify({
        purchase_amount: 299.99,
        gift_message: "Congratulations on your wedding!"
      }),
      createdAt: new Date("2024-01-12T16:45:00Z")
    }
  ];

  for (const activity of activities) {
    await prisma.registryActivity.create({ data: activity });
  }

  // Create analytics events
  const analyticsEvents = [
    {
      shopId: shop.id,
      event: "registry_created",
      category: "engagement",
      properties: JSON.stringify({
        event_type: "wedding",
        items_count: 3
      }),
      value: 2847.95,
      currency: "USD",
      registryId: weddingRegistry.id,
      userId: "gid://shopify/Customer/6543210987654321",
      source: "web",
      medium: "direct",
      timestamp: new Date("2024-01-01T10:00:00Z")
    },
    {
      shopId: shop.id,
      event: "registry_viewed",
      category: "engagement",
      registryId: weddingRegistry.id,
      source: "web",
      medium: "referral",
      campaign: "wedding_invitation",
      timestamp: new Date("2024-01-10T09:15:00Z")
    },
    {
      shopId: shop.id,
      event: "item_purchased",
      category: "conversion",
      properties: JSON.stringify({
        product_id: "gid://shopify/Product/1234567890123456",
        product_title: "Premium Coffee Maker"
      }),
      value: 299.99,
      currency: "USD",
      registryId: weddingRegistry.id,
      itemId: items[0].id,
      source: "web",
      medium: "referral",
      timestamp: new Date("2024-01-12T16:45:00Z")
    }
  ];

  for (const event of analyticsEvents) {
    await prisma.analyticsEvent.create({ data: event });
  }

  // Create metafield sync records
  await Promise.all([
    prisma.metafieldSync.create({
      data: {
        shopId: shop.id,
        namespace: "wishcraft.registry",
        key: "registry_id",
        ownerId: "gid://shopify/Customer/6543210987654321",
        ownerType: "Customer",
        localId: weddingRegistry.id,
        metafieldId: "gid://shopify/Metafield/123456789",
        status: "synced",
        lastSyncAt: new Date(),
        value: weddingRegistry.id,
        valueType: "single_line_text"
      }
    }),
    prisma.metafieldSync.create({
      data: {
        shopId: shop.id,
        namespace: "wishcraft.item",
        key: "registry_item_id",
        ownerId: "gid://shopify/Product/1234567890123456",
        ownerType: "Product",
        localId: items[0].id,
        status: "pending",
        value: items[0].id,
        valueType: "single_line_text",
        syncAttempts: 0
      }
    })
  ]);

  console.log("📊 Created analytics and metafield sync records");

  // Update registry statistics
  await prisma.registry.update({
    where: { id: weddingRegistry.id },
    data: {
      purchasedValue: 299.99,
      completionRate: (299.99 / 2847.95) * 100
    }
  });

  await prisma.registry.update({
    where: { id: babyRegistry.id },
    data: {
      purchasedValue: 199.99,
      completionRate: (199.99 / 1567.88) * 100
    }
  });

  console.log("✅ Database seeded successfully!");
  console.log(`🏪 Created shop: ${shop.name}`);
  console.log(`📋 Created ${await prisma.registry.count()} registries`);
  console.log(`🎁 Created ${await prisma.registryItem.count()} registry items`);
  console.log(`💳 Created ${await prisma.registryPurchase.count()} purchases`);
  console.log(`👥 Created ${await prisma.registryCollaborator.count()} collaborators`);
  console.log(`📧 Created ${await prisma.registryInvitation.count()} invitations`);
  console.log(`📍 Created ${await prisma.registryAddress.count()} addresses`);
  console.log(`📈 Created ${await prisma.analyticsEvent.count()} analytics events`);
  console.log(`🔄 Created ${await prisma.metafieldSync.count()} metafield sync records`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });