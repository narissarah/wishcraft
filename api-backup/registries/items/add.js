import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    console.log('Add registry item endpoint called:', req.method, req.url);
    
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    const { 
      registryId, 
      productId, 
      variantId,
      quantity = 1, 
      priority = 'medium',
      notes,
      personalNote
    } = req.body;
    
    if (!registryId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Registry ID and Product ID are required'
      });
    }

    // Check if registry exists and is active
    const registry = await prisma.registries.findUnique({
      where: { id: registryId },
      select: { id: true, status: true, shopId: true }
    });

    if (!registry) {
      return res.status(404).json({
        success: false,
        error: 'Registry not found'
      });
    }

    if (registry.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot add items to inactive registry'
      });
    }

    // Get product details (mock data for now - would fetch from Shopify in production)
    const productData = {
      productHandle: `product-${productId}`,
      productTitle: `Sample Product ${productId}`,
      variantTitle: variantId ? `Variant ${variantId}` : null,
      productType: 'General',
      vendor: 'Sample Vendor',
      productImage: 'https://via.placeholder.com/300x300',
      productUrl: `https://${registry.shopId}.myshopify.com/products/product-${productId}`,
      price: 29.99,
      currencyCode: 'USD'
    };

    const itemId = `item_${Math.random().toString(36).substring(2, 15)}`;

    // Create registry item
    const registryItem = await prisma.registry_items.create({
      data: {
        id: itemId,
        registryId,
        productId,
        variantId,
        productHandle: productData.productHandle,
        productTitle: productData.productTitle,
        variantTitle: productData.variantTitle,
        productType: productData.productType,
        vendor: productData.vendor,
        productImage: productData.productImage,
        productUrl: productData.productUrl,
        quantity: parseInt(quantity),
        priority,
        notes,
        personalNote,
        price: productData.price,
        currencyCode: productData.currencyCode,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Update registry total value
    await prisma.registries.update({
      where: { id: registryId },
      data: {
        totalValue: {
          increment: productData.price * parseInt(quantity)
        },
        updatedAt: new Date()
      }
    });

    // Track analytics
    await prisma.analytics_events.create({
      data: {
        id: `evt_${Math.random().toString(36).substring(2, 15)}`,
        shopId: registry.shopId,
        event: 'item_added_to_registry',
        category: 'registry',
        registryId: registryId,
        itemId: itemId,
        value: productData.price * parseInt(quantity),
        timestamp: new Date()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Item added to registry successfully',
      item: {
        id: registryItem.id,
        productId: registryItem.productId,
        productTitle: registryItem.productTitle,
        productImage: registryItem.productImage,
        quantity: registryItem.quantity,
        priority: registryItem.priority,
        price: registryItem.price,
        currencyCode: registryItem.currencyCode,
        notes: registryItem.notes,
        personalNote: registryItem.personalNote,
        createdAt: registryItem.createdAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Add registry item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item to registry',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await prisma.$disconnect();
  }
}