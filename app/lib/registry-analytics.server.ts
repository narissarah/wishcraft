import { db } from "~/lib/db.server";
import { startOfDay, startOfWeek, startOfMonth, subDays, subMonths } from "date-fns";

// ============================================================================
// REGISTRY ANALYTICS SERVICE
// ============================================================================

export interface RegistryAnalytics {
  overview: {
    totalViews: number;
    uniqueVisitors: number;
    totalItems: number;
    itemsPurchased: number;
    completionRate: number;
    totalValue: number;
    purchasedValue: number;
  };
  engagement: {
    shareCount: number;
    collaboratorCount: number;
    averageTimeOnPage: number;
    bounceRate: number;
    conversionRate: number;
  };
  timeline: {
    views: TimelineData[];
    purchases: TimelineData[];
    shares: TimelineData[];
  };
  topItems: Array<{
    itemId: string;
    productTitle: string;
    views: number;
    purchases: number;
    wishlists: number;
    conversionRate: number;
  }>;
  sources: Array<{
    source: string;
    visits: number;
    conversions: number;
    percentage: number;
  }>;
  purchasers: Array<{
    name: string;
    email: string;
    itemCount: number;
    totalSpent: number;
    lastPurchase: Date;
  }>;
}

export interface TimelineData {
  date: string;
  value: number;
}

export interface AnalyticsFilters {
  dateRange: 'today' | 'week' | 'month' | '3months' | 'year' | 'all';
  startDate?: Date;
  endDate?: Date;
}

export interface ItemAnalytics {
  itemId: string;
  views: number;
  addedToCart: number;
  purchased: number;
  revenue: number;
  conversionRate: number;
  popularTimes: Array<{
    hour: number;
    views: number;
  }>;
  purchaseHistory: Array<{
    date: Date;
    purchaserName: string;
    quantity: number;
    amount: number;
  }>;
}

export class RegistryAnalyticsService {
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;
  }

  /**
   * Get comprehensive analytics for a registry
   */
  async getRegistryAnalytics(
    registryId: string, 
    filters: AnalyticsFilters = { dateRange: 'all' }
  ): Promise<RegistryAnalytics> {
    try {
      const dateFilter = this.getDateFilter(filters);

      // Get registry with all related data
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId },
        include: {
          items: {
            include: {
              purchases: true,
              product: true
            }
          },
          activities: {
            where: dateFilter ? { createdAt: dateFilter } : undefined
          },
          shares: {
            where: dateFilter ? { sharedAt: dateFilter } : undefined
          },
          collaborators: {
            where: { status: 'active' }
          }
        }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      // Calculate overview metrics
      const overview = await this.calculateOverviewMetrics(registry, dateFilter);
      
      // Calculate engagement metrics
      const engagement = await this.calculateEngagementMetrics(registry, dateFilter);
      
      // Generate timeline data
      const timeline = await this.generateTimelineData(registry, filters);
      
      // Get top performing items
      const topItems = await this.getTopItems(registry);
      
      // Analyze traffic sources
      const sources = await this.analyzeTrafficSources(registry, dateFilter);
      
      // Get purchaser information
      const purchasers = await this.getPurchaserInfo(registry);

      return {
        overview,
        engagement,
        timeline,
        topItems,
        sources,
        purchasers
      };
    } catch (error) {
      console.error('Error getting registry analytics:', error);
      throw new Error('Failed to generate analytics');
    }
  }

  /**
   * Calculate overview metrics
   */
  private async calculateOverviewMetrics(
    registry: any, 
    dateFilter: any
  ): Promise<RegistryAnalytics['overview']> {
    // Count total views
    const viewActivities = registry.activities.filter(
      (a: any) => a.type === 'registry_viewed' || a.type === 'shared_link_viewed'
    );
    const totalViews = viewActivities.length;

    // Count unique visitors
    const uniqueVisitorIds = new Set(
      viewActivities.map((a: any) => a.actorId).filter(Boolean)
    );
    const uniqueVisitors = uniqueVisitorIds.size;

    // Item metrics
    const totalItems = registry.items.length;
    const itemsPurchased = registry.items.filter(
      (item: any) => item.quantityPurchased > 0
    ).length;
    const completionRate = totalItems > 0 
      ? Math.round((itemsPurchased / totalItems) * 100) 
      : 0;

    // Value calculations
    const totalValue = registry.items.reduce(
      (sum: number, item: any) => sum + (item.price * item.quantity), 
      0
    );
    const purchasedValue = registry.items.reduce(
      (sum: number, item: any) => sum + (item.price * item.quantityPurchased), 
      0
    );

    return {
      totalViews,
      uniqueVisitors,
      totalItems,
      itemsPurchased,
      completionRate,
      totalValue,
      purchasedValue
    };
  }

  /**
   * Calculate engagement metrics
   */
  private async calculateEngagementMetrics(
    registry: any,
    dateFilter: any
  ): Promise<RegistryAnalytics['engagement']> {
    // Share count
    const shareCount = registry.shares.length;

    // Collaborator count
    const collaboratorCount = registry.collaborators.length;

    // Average time on page (mock calculation - would need real session tracking)
    const averageTimeOnPage = 180; // 3 minutes average

    // Bounce rate (mock - would need real session tracking)
    const bounceRate = 25; // 25% bounce rate

    // Conversion rate (purchases / views)
    const totalViews = registry.activities.filter(
      (a: any) => a.type === 'registry_viewed'
    ).length;
    const totalPurchases = registry.items.reduce(
      (sum: number, item: any) => sum + item.purchases.length, 
      0
    );
    const conversionRate = totalViews > 0 
      ? Math.round((totalPurchases / totalViews) * 100) 
      : 0;

    return {
      shareCount,
      collaboratorCount,
      averageTimeOnPage,
      bounceRate,
      conversionRate
    };
  }

  /**
   * Generate timeline data for charts
   */
  private async generateTimelineData(
    registry: any,
    filters: AnalyticsFilters
  ): Promise<RegistryAnalytics['timeline']> {
    const days = this.getDaysInRange(filters);
    
    // Initialize timeline arrays
    const viewsTimeline: TimelineData[] = [];
    const purchasesTimeline: TimelineData[] = [];
    const sharesTimeline: TimelineData[] = [];

    // Group activities by date
    for (const day of days) {
      const dayStart = startOfDay(new Date(day));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Count views for this day
      const dayViews = registry.activities.filter((a: any) => {
        const activityDate = new Date(a.createdAt);
        return (a.type === 'registry_viewed' || a.type === 'shared_link_viewed') &&
               activityDate >= dayStart && activityDate < dayEnd;
      }).length;

      // Count purchases for this day
      const dayPurchases = registry.items.reduce((sum: number, item: any) => {
        const itemPurchases = item.purchases.filter((p: any) => {
          const purchaseDate = new Date(p.createdAt);
          return purchaseDate >= dayStart && purchaseDate < dayEnd;
        }).length;
        return sum + itemPurchases;
      }, 0);

      // Count shares for this day
      const dayShares = registry.shares.filter((s: any) => {
        const shareDate = new Date(s.sharedAt);
        return shareDate >= dayStart && shareDate < dayEnd;
      }).length;

      viewsTimeline.push({ date: day, value: dayViews });
      purchasesTimeline.push({ date: day, value: dayPurchases });
      sharesTimeline.push({ date: day, value: dayShares });
    }

    return {
      views: viewsTimeline,
      purchases: purchasesTimeline,
      shares: sharesTimeline
    };
  }

  /**
   * Get top performing items
   */
  private async getTopItems(registry: any): Promise<RegistryAnalytics['topItems']> {
    const itemAnalytics = await Promise.all(
      registry.items.map(async (item: any) => {
        // Count item-specific views (would need item-level tracking)
        const itemViews = registry.activities.filter(
          (a: any) => a.type === 'item_viewed' && 
                      a.metadata?.includes(item.id)
        ).length || 10; // Mock data

        // Count purchases
        const purchases = item.quantityPurchased;

        // Count how many other wishlists have this product
        const wishlists = await db.registryItem.count({
          where: {
            productId: item.productId,
            registry: { shopId: this.shopId }
          }
        });

        // Calculate conversion rate
        const conversionRate = itemViews > 0 
          ? Math.round((purchases / itemViews) * 100) 
          : 0;

        return {
          itemId: item.id,
          productTitle: item.productTitle || 'Unknown Product',
          views: itemViews,
          purchases,
          wishlists,
          conversionRate
        };
      })
    );

    // Sort by purchases and take top 10
    return itemAnalytics
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 10);
  }

  /**
   * Analyze traffic sources
   */
  private async analyzeTrafficSources(
    registry: any,
    dateFilter: any
  ): Promise<RegistryAnalytics['sources']> {
    // Group activities by source
    const sourceMap = new Map<string, { visits: number; conversions: number }>();
    
    registry.activities.forEach((activity: any) => {
      if (activity.type === 'registry_viewed' || activity.type === 'shared_link_viewed') {
        const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};
        const source = metadata.referrer || 
                      (activity.type === 'shared_link_viewed' ? 'shared_link' : 'direct');
        
        if (!sourceMap.has(source)) {
          sourceMap.set(source, { visits: 0, conversions: 0 });
        }
        
        const stats = sourceMap.get(source)!;
        stats.visits++;
        
        // Check if this visitor made a purchase (simplified)
        if (registry.items.some((item: any) => 
          item.purchases.some((p: any) => p.purchaserEmail === activity.actorEmail)
        )) {
          stats.conversions++;
        }
      }
    });

    // Convert to array and calculate percentages
    const totalVisits = Array.from(sourceMap.values())
      .reduce((sum, stats) => sum + stats.visits, 0);
    
    return Array.from(sourceMap.entries())
      .map(([source, stats]) => ({
        source: this.formatSourceName(source),
        visits: stats.visits,
        conversions: stats.conversions,
        percentage: totalVisits > 0 
          ? Math.round((stats.visits / totalVisits) * 100) 
          : 0
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  }

  /**
   * Get purchaser information
   */
  private async getPurchaserInfo(registry: any): Promise<RegistryAnalytics['purchasers']> {
    const purchaserMap = new Map<string, any>();

    // Aggregate purchases by purchaser
    registry.items.forEach((item: any) => {
      item.purchases.forEach((purchase: any) => {
        const key = purchase.purchaserEmail || 'anonymous';
        
        if (!purchaserMap.has(key)) {
          purchaserMap.set(key, {
            name: purchase.purchaserName || 'Anonymous',
            email: purchase.purchaserEmail || 'N/A',
            itemCount: 0,
            totalSpent: 0,
            lastPurchase: purchase.createdAt
          });
        }
        
        const purchaser = purchaserMap.get(key);
        purchaser.itemCount += purchase.quantity;
        purchaser.totalSpent += purchase.price * purchase.quantity;
        
        if (new Date(purchase.createdAt) > new Date(purchaser.lastPurchase)) {
          purchaser.lastPurchase = purchase.createdAt;
        }
      });
    });

    return Array.from(purchaserMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20);
  }

  /**
   * Track registry view event
   */
  async trackRegistryView(
    registryId: string,
    viewerInfo: {
      customerId?: string;
      customerEmail?: string;
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'registry_viewed',
          description: 'Registry viewed',
          actorType: viewerInfo.customerId ? 'customer' : 'guest',
          actorId: viewerInfo.customerId || viewerInfo.sessionId || viewerInfo.ipAddress || 'anonymous',
          actorEmail: viewerInfo.customerEmail,
          actorName: null,
          metadata: JSON.stringify({
            ipAddress: viewerInfo.ipAddress,
            userAgent: viewerInfo.userAgent,
            referrer: viewerInfo.referrer,
            sessionId: viewerInfo.sessionId,
            timestamp: new Date().toISOString()
          })
        }
      });

      // Update registry view count
      await db.registry.update({
        where: { id: registryId },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error tracking registry view:', error);
    }
  }

  /**
   * Track item interaction
   */
  async trackItemInteraction(
    registryId: string,
    itemId: string,
    interactionType: 'viewed' | 'clicked' | 'added_to_cart' | 'purchased',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await db.registryActivity.create({
        data: {
          registryId,
          type: `item_${interactionType}`,
          description: `Registry item ${interactionType}`,
          actorType: metadata?.customerId ? 'customer' : 'guest',
          actorId: metadata?.customerId || metadata?.sessionId || 'anonymous',
          actorEmail: metadata?.customerEmail,
          actorName: metadata?.customerName,
          metadata: JSON.stringify({
            itemId,
            ...metadata,
            timestamp: new Date().toISOString()
          })
        }
      });

      // Update item statistics if needed
      if (interactionType === 'viewed') {
        await db.registryItem.update({
          where: { id: itemId },
          data: {
            viewCount: { increment: 1 }
          }
        });
      }
    } catch (error) {
      console.error('Error tracking item interaction:', error);
    }
  }

  /**
   * Get popular items across all registries
   */
  async getPopularItems(limit: number = 20): Promise<Array<{
    productId: string;
    productTitle: string;
    registryCount: number;
    totalQuantity: number;
    averagePrice: number;
  }>> {
    try {
      const popularItems = await db.registryItem.groupBy({
        by: ['productId', 'productTitle'],
        where: {
          registry: { shopId: this.shopId }
        },
        _count: { productId: true },
        _sum: { quantity: true },
        _avg: { price: true }
      });

      return popularItems
        .map(item => ({
          productId: item.productId,
          productTitle: item.productTitle || 'Unknown Product',
          registryCount: item._count.productId,
          totalQuantity: item._sum.quantity || 0,
          averagePrice: item._avg.price || 0
        }))
        .sort((a, b) => b.registryCount - a.registryCount)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting popular items:', error);
      return [];
    }
  }

  /**
   * Generate analytics report
   */
  async generateAnalyticsReport(
    registryId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const analytics = await this.getRegistryAnalytics(registryId);
      
      if (format === 'json') {
        return JSON.stringify(analytics, null, 2);
      }
      
      // CSV format
      const csvRows = [
        ['Metric', 'Value'],
        ['Total Views', analytics.overview.totalViews],
        ['Unique Visitors', analytics.overview.uniqueVisitors],
        ['Total Items', analytics.overview.totalItems],
        ['Items Purchased', analytics.overview.itemsPurchased],
        ['Completion Rate', `${analytics.overview.completionRate}%`],
        ['Total Value', analytics.overview.totalValue],
        ['Purchased Value', analytics.overview.purchasedValue],
        ['Shares', analytics.engagement.shareCount],
        ['Collaborators', analytics.engagement.collaboratorCount],
        ['Conversion Rate', `${analytics.engagement.conversionRate}%`]
      ];
      
      return csvRows.map(row => row.join(',')).join('\n');
    } catch (error) {
      console.error('Error generating analytics report:', error);
      throw new Error('Failed to generate report');
    }
  }

  /**
   * Get date filter based on range
   */
  private getDateFilter(filters: AnalyticsFilters): any {
    const now = new Date();
    let startDate: Date;

    switch (filters.dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case '3months':
        startDate = subMonths(now, 3);
        break;
      case 'year':
        startDate = subMonths(now, 12);
        break;
      case 'all':
      default:
        return undefined;
    }

    return {
      gte: filters.startDate || startDate,
      lte: filters.endDate || now
    };
  }

  /**
   * Get array of dates in range
   */
  private getDaysInRange(filters: AnalyticsFilters): string[] {
    const now = new Date();
    let days = 30; // Default to 30 days

    switch (filters.dateRange) {
      case 'today':
        days = 1;
        break;
      case 'week':
        days = 7;
        break;
      case 'month':
        days = 30;
        break;
      case '3months':
        days = 90;
        break;
      case 'year':
        days = 365;
        break;
    }

    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }

  /**
   * Format source name for display
   */
  private formatSourceName(source: string): string {
    const sourceNames: Record<string, string> = {
      'direct': 'Direct Traffic',
      'shared_link': 'Shared Links',
      'facebook.com': 'Facebook',
      'twitter.com': 'Twitter',
      'instagram.com': 'Instagram',
      'google.com': 'Google Search',
      'email': 'Email'
    };

    // Check if source contains known domain
    for (const [domain, name] of Object.entries(sourceNames)) {
      if (source.includes(domain)) {
        return name;
      }
    }

    return sourceNames[source] || source;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create RegistryAnalyticsService instance
 */
export function createRegistryAnalyticsService(shopId: string): RegistryAnalyticsService {
  return new RegistryAnalyticsService(shopId);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Get trend direction
 */
export function getTrendDirection(current: number, previous: number): 'up' | 'down' | 'neutral' {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'neutral';
}