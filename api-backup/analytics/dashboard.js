import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    console.log('Analytics dashboard endpoint called:', req.method, req.url);
    
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    const { shop, period = '30d' } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required'
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get analytics data
    const [
      totalRegistries,
      activeRegistries,
      totalItems,
      totalViews,
      recentEvents,
      registryStats
    ] = await Promise.all([
      // Total registries count
      prisma.registries.count({
        where: { shopId: shop }
      }),
      
      // Active registries count
      prisma.registries.count({
        where: { 
          shopId: shop,
          status: 'active'
        }
      }),
      
      // Total items across all registries
      prisma.registry_items.count({
        where: {
          registries: {
            shopId: shop
          }
        }
      }),
      
      // Total views
      prisma.registries.aggregate({
        where: { shopId: shop },
        _sum: { views: true }
      }),
      
      // Recent events
      prisma.analytics_events.findMany({
        where: {
          shopId: shop,
          timestamp: {
            gte: startDate
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 10
      }),
      
      // Registry performance stats
      prisma.registries.findMany({
        where: {
          shopId: shop,
          createdAt: {
            gte: startDate
          }
        },
        select: {
          id: true,
          title: true,
          views: true,
          totalValue: true,
          purchasedValue: true,
          completionRate: true,
          createdAt: true,
          _count: {
            select: {
              registry_items: true
            }
          }
        },
        orderBy: {
          views: 'desc'
        },
        take: 5
      })
    ]);

    // Calculate metrics
    const totalViewsCount = totalViews._sum.views || 0;
    const averageItemsPerRegistry = totalRegistries > 0 ? Math.round(totalItems / totalRegistries) : 0;
    const averageViewsPerRegistry = totalRegistries > 0 ? Math.round(totalViewsCount / totalRegistries) : 0;

    // Group events by category for chart data
    const eventsByCategory = {};
    recentEvents.forEach(event => {
      if (!eventsByCategory[event.category]) {
        eventsByCategory[event.category] = 0;
      }
      eventsByCategory[event.category]++;
    });

    const dashboardData = {
      overview: {
        totalRegistries,
        activeRegistries,
        totalItems,
        totalViews: totalViewsCount,
        averageItemsPerRegistry,
        averageViewsPerRegistry
      },
      
      trends: {
        period,
        registriesCreated: registryStats.length,
        eventsByCategory
      },
      
      topRegistries: registryStats.map(registry => ({
        id: registry.id,
        title: registry.title,
        views: registry.views,
        itemCount: registry._count.registry_items,
        totalValue: registry.totalValue,
        completionRate: registry.completionRate,
        createdAt: registry.createdAt
      })),
      
      recentActivity: recentEvents.slice(0, 5).map(event => ({
        event: event.event,
        category: event.category,
        timestamp: event.timestamp,
        value: event.value
      }))
    };

    res.status(200).json({
      success: true,
      analytics: dashboardData,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await prisma.$disconnect();
  }
}