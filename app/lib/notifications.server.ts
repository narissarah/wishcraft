/**
 * Real-time Notifications System
 * Implements WebSocket and SSE for instant updates
 */

import { EventEmitter } from 'events';
import { db } from './db.server';
import { log } from './logger.server';
import { cache, cacheKeys } from './cache-unified.server';

/**
 * Notification types
 */
export enum NotificationType {
  REGISTRY_PURCHASE = 'registry_purchase',
  REGISTRY_SHARED = 'registry_shared',
  ITEM_ADDED = 'item_added',
  ITEM_REMOVED = 'item_removed',
  ITEM_PURCHASED = 'item_purchased',
  GIFT_MESSAGE = 'gift_message',
  PRICE_CHANGE = 'price_change',
  OUT_OF_STOCK = 'out_of_stock',
  BACK_IN_STOCK = 'back_in_stock',
  REGISTRY_EXPIRING = 'registry_expiring',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  shopId: string;
  customerId?: string;
  registryId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Notification manager - Central event bus
 */
class NotificationManager extends EventEmitter {
  private static instance: NotificationManager;
  private connections: Map<string, Set<Response>> = new Map();
  
  private constructor() {
    super();
    this.setMaxListeners(1000); // Support many concurrent connections
  }
  
  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }
  
  /**
   * Send notification to specific shop/customer
   */
  async sendNotification(notification: Omit<Notification, 'id' | 'createdAt'>) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date();
    
    const fullNotification: Notification = {
      ...notification,
      id,
      createdAt,
    };
    
    try {
      // Store in database
      await db.systemJob.create({
        data: {
          type: 'notification',
          status: 'completed',
          payload: JSON.stringify(fullNotification),
          shopId: notification.shopId,
          completedAt: new Date(),
        },
      });
      
      // Cache recent notifications
      const cacheKey = cacheKeys.notification(notification.customerId || notification.shopId);
      
      const cached = await cache.get<Notification[]>(cacheKey) || [];
      cached.unshift(fullNotification);
      
      // Keep only last 100 notifications in cache
      if (cached.length > 100) {
        cached.length = 100;
      }
      
      await cache.set(cacheKey, cached, { ttl: 3600 * 1000, tags: [`shop:${notification.shopId}`] }); // 1 hour cache
      
      // Emit to connected clients
      this.emit('notification', fullNotification);
      
      // Send to SSE connections
      this.broadcastToShop(notification.shopId, fullNotification);
      
      if (notification.customerId) {
        this.broadcastToCustomer(notification.customerId, fullNotification);
      }
      
      log.info('Notification sent', {
        notificationId: id,
        type: notification.type,
        shopId: notification.shopId,
      });
      
    } catch (error) {
      log.error('Failed to send notification', error);
      throw error;
    }
  }
  
  /**
   * Broadcast to shop connections
   */
  private broadcastToShop(shopId: string, notification: Notification) {
    const connections = this.connections.get(`shop:${shopId}`);
    if (connections) {
      const data = `data: ${JSON.stringify(notification)}\n\n`;
      connections.forEach(connection => {
        try {
          connection.write(data);
        } catch (error) {
          // Remove dead connections
          connections.delete(connection);
        }
      });
    }
  }
  
  /**
   * Broadcast to customer connections
   */
  private broadcastToCustomer(customerId: string, notification: Notification) {
    const connections = this.connections.get(`customer:${customerId}`);
    if (connections) {
      const data = `data: ${JSON.stringify(notification)}\n\n`;
      connections.forEach(connection => {
        try {
          connection.write(data);
        } catch (error) {
          // Remove dead connections
          connections.delete(connection);
        }
      });
    }
  }
  
  /**
   * Register SSE connection
   */
  registerConnection(key: string, response: Response) {
    if (!this.connections.has(key)) {
      this.connections.set(key, new Set());
    }
    this.connections.get(key)!.add(response);
  }
  
  /**
   * Remove SSE connection
   */
  removeConnection(key: string, response: Response) {
    const connections = this.connections.get(key);
    if (connections) {
      connections.delete(response);
      if (connections.size === 0) {
        this.connections.delete(key);
      }
    }
  }
  
  /**
   * Get recent notifications
   */
  async getRecentNotifications(
    shopId: string,
    customerId?: string,
    limit: number = 20
  ): Promise<Notification[]> {
    // Try cache first
    const cacheKey = cacheKeys.notification(customerId || shopId);
    
    const cached = await cache.get<Notification[]>(cacheKey);
    if (cached) {
      return cached.slice(0, limit);
    }
    
    // Fetch from database
    const notifications = await db.systemJob.findMany({
      where: {
        type: 'notification',
        shopId,
        ...(customerId && {
          payload: {
            contains: `"customerId":"${customerId}"`,
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    
    const parsed = notifications
      .map(n => {
        try {
          return JSON.parse(n.payload || '{}') as Notification;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Notification[];
    
    // Update cache
    await cache.set(cacheKey, parsed, { ttl: 3600 * 1000, tags: [`shop:${shopId}`] });
    
    return parsed;
  }
  
  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    // Update in cache
    const allKeys = Array.from(this.connections.keys());
    for (const key of allKeys) {
      const [type, id] = key.split(':');
      const cacheKey = cacheKeys.notification(type === 'customer' ? id : (type === 'shop' ? id : 'all'));
      
      const cached = await cache.get<Notification[]>(cacheKey);
      if (cached) {
        const notification = cached.find(n => n.id === notificationId);
        if (notification) {
          notification.readAt = new Date();
          await cache.set(cacheKey, cached, { ttl: 3600 * 1000, tags: [`shop:${type === 'shop' ? id : ''}`, `customer:${type === 'customer' ? id : ''}`] });
        }
      }
    }
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();

/**
 * Notification templates
 */
export const NotificationTemplates = {
  registryPurchase: (
    purchaserName: string,
    itemName: string,
    quantity: number
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.REGISTRY_PURCHASE,
    priority: NotificationPriority.HIGH,
    title: 'New Registry Purchase! 🎁',
    message: `${purchaserName} purchased ${quantity} × ${itemName} from your registry`,
  }),
  
  registryShared: (
    sharedBy: string,
    platform: string
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.REGISTRY_SHARED,
    priority: NotificationPriority.MEDIUM,
    title: 'Registry Shared',
    message: `${sharedBy} shared your registry on ${platform}`,
  }),
  
  itemAdded: (
    itemName: string
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.ITEM_ADDED,
    priority: NotificationPriority.LOW,
    title: 'Item Added',
    message: `${itemName} was added to your registry`,
  }),
  
  outOfStock: (
    itemName: string
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.OUT_OF_STOCK,
    priority: NotificationPriority.HIGH,
    title: 'Item Out of Stock ⚠️',
    message: `${itemName} is now out of stock`,
  }),
  
  backInStock: (
    itemName: string
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.BACK_IN_STOCK,
    priority: NotificationPriority.MEDIUM,
    title: 'Item Back in Stock ✅',
    message: `${itemName} is now available again`,
  }),
  
  priceChange: (
    itemName: string,
    oldPrice: number,
    newPrice: number,
    currency: string
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.PRICE_CHANGE,
    priority: NotificationPriority.MEDIUM,
    title: newPrice < oldPrice ? 'Price Drop! 💰' : 'Price Change',
    message: `${itemName} price changed from ${currency}${oldPrice} to ${currency}${newPrice}`,
  }),
  
  registryExpiring: (
    daysLeft: number
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.REGISTRY_EXPIRING,
    priority: NotificationPriority.URGENT,
    title: 'Registry Expiring Soon! ⏰',
    message: `Your registry will expire in ${daysLeft} days`,
  }),
  
  giftMessage: (
    fromName: string
  ): Pick<Notification, 'type' | 'priority' | 'title' | 'message'> => ({
    type: NotificationType.GIFT_MESSAGE,
    priority: NotificationPriority.MEDIUM,
    title: 'New Gift Message 💌',
    message: `You received a gift message from ${fromName}`,
  }),
};

/**
 * Schedule notification checks
 */
export async function scheduleNotificationChecks(shopId: string) {
  // Check for expiring registries
  const expiringRegistries = await db.registry.findMany({
    where: {
      shopId,
      status: 'active',
      eventDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    },
  });
  
  for (const registry of expiringRegistries) {
    if (registry.eventDate) {
      const daysLeft = Math.ceil(
        (registry.eventDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      
      await notificationManager.sendNotification({
        ...NotificationTemplates.registryExpiring(daysLeft),
        shopId,
        customerId: registry.customerId,
        registryId: registry.id,
        actionUrl: `/app/registries/${registry.id}`,
        actionLabel: 'View Registry',
      });
    }
  }
  
  // Check for out of stock items
  const registryItems = await db.registryItem.findMany({
    where: {
      registry: {
        shopId,
        status: 'active',
      },
      inventoryTracked: true,
      inventoryQuantity: 0,
      status: 'active',
    },
    include: {
      registry: true,
    },
  });
  
  for (const item of registryItems) {
    await notificationManager.sendNotification({
      ...NotificationTemplates.outOfStock(item.productTitle),
      shopId,
      customerId: item.registry.customerId,
      registryId: item.registryId,
      metadata: {
        productId: item.productId,
        variantId: item.variantId,
      },
    });
  }
}