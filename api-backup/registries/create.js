import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    console.log('Registry creation endpoint called:', req.method, req.url);
    
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    const { shop, title, description, eventType, eventDate, visibility = 'public' } = req.body;
    
    if (!shop || !title) {
      return res.status(400).json({
        success: false,
        error: 'Shop and title are required'
      });
    }

    // Generate unique slug
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const registryId = `reg_${Math.random().toString(36).substring(2, 15)}`;

    // Create registry
    const registry = await prisma.registries.create({
      data: {
        id: registryId,
        title,
        description,
        slug,
        eventType: eventType || 'general',
        eventDate: eventDate ? new Date(eventDate) : null,
        visibility,
        shopId: shop,
        customerId: `cust_${Math.random().toString(36).substring(2, 15)}`,
        customerEmail: `guest@${shop}`,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Track analytics
    await prisma.analytics_events.create({
      data: {
        id: `evt_${Math.random().toString(36).substring(2, 15)}`,
        shopId: shop,
        event: 'registry_created',
        category: 'registry',
        registryId: registry.id,
        timestamp: new Date()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Registry created successfully',
      registry: {
        id: registry.id,
        title: registry.title,
        description: registry.description,
        slug: registry.slug,
        eventType: registry.eventType,
        eventDate: registry.eventDate,
        visibility: registry.visibility,
        shareUrl: `https://wishcraft-git6idvam-narissarahs-projects.vercel.app/registry/${registry.slug}`,
        createdAt: registry.createdAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registry creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create registry',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await prisma.$disconnect();
  }
}