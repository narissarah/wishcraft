import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    console.log('Registry list endpoint called:', req.method, req.url);
    
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    const { shop, page = 1, limit = 10, status = 'active' } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get registries with item counts
    const [registries, totalCount] = await Promise.all([
      prisma.registries.findMany({
        where: {
          shopId: shop,
          status
        },
        include: {
          _count: {
            select: {
              registry_items: true,
              registry_activities: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.registries.count({
        where: {
          shopId: shop,
          status
        }
      })
    ]);

    // Format response
    const formattedRegistries = registries.map(registry => ({
      id: registry.id,
      title: registry.title,
      description: registry.description,
      slug: registry.slug,
      eventType: registry.eventType,
      eventDate: registry.eventDate,
      visibility: registry.visibility,
      status: registry.status,
      itemCount: registry._count.registry_items,
      activityCount: registry._count.registry_activities,
      totalValue: registry.totalValue,
      purchasedValue: registry.purchasedValue,
      completionRate: registry.completionRate,
      views: registry.views,
      shareUrl: `https://wishcraft-git6idvam-narissarahs-projects.vercel.app/registry/${registry.slug}`,
      createdAt: registry.createdAt,
      updatedAt: registry.updatedAt
    }));

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      registries: formattedRegistries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registry list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch registries',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await prisma.$disconnect();
  }
}