/**
 * Notifications Tests
 * Tests for the real-time notification system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  notificationManager,
  NotificationTemplates,
  NotificationType,
  NotificationPriority,
  scheduleNotificationChecks,
} from '../app/lib/notifications.server';
import { testUtils } from './setup';

// Mock dependencies
vi.mock('../app/lib/db.server', () => ({
  db: testUtils.getMockPrismaClient(),
}));

vi.mock('../app/lib/logger.server', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../app/lib/cache-manager.server', () => ({
  cacheManager: {
    generateKey: vi.fn((...args) => args.join(':')),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  CacheKeys: {
    WEBHOOK: 'webhook',
  },
}));

describe('NotificationManager', () => {
  const mockPrismaClient = testUtils.getMockPrismaClient();

  beforeEach(() => {
    testUtils.resetMocks();
    vi.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification successfully', async () => {
      const notification = {
        type: NotificationType.REGISTRY_PURCHASE,
        priority: NotificationPriority.HIGH,
        title: 'New Registry Purchase! 🎁',
        message: 'John Doe purchased 1 × Test Item from your registry',
        shopId: 'test-shop',
        customerId: 'test-customer',
        registryId: 'test-registry',
        metadata: {
          purchaserName: 'John Doe',
          itemName: 'Test Item',
          quantity: 1,
        },
        actionUrl: '/app/registries/test-registry',
        actionLabel: 'View Registry',
      };

      const mockSystemJob = {
        id: 'test-job-id',
        type: 'notification',
        status: 'completed',
        payload: JSON.stringify(notification),
        shopId: notification.shopId,
        completedAt: new Date(),
        createdAt: new Date(),
      };

      mockPrismaClient.systemJob.create.mockResolvedValue(mockSystemJob);

      await notificationManager.sendNotification(notification);

      expect(mockPrismaClient.systemJob.create).toHaveBeenCalledWith({
        data: {
          type: 'notification',
          status: 'completed',
          payload: expect.stringContaining('"type":"registry_purchase"'),
          shopId: notification.shopId,
          completedAt: expect.any(Date),
        },
      });
    });

    it('should handle notification sending errors', async () => {
      const notification = {
        type: NotificationType.REGISTRY_PURCHASE,
        priority: NotificationPriority.HIGH,
        title: 'Test Notification',
        message: 'Test message',
        shopId: 'test-shop',
        customerId: 'test-customer',
      };

      mockPrismaClient.systemJob.create.mockRejectedValue(new Error('Database error'));

      await expect(notificationManager.sendNotification(notification)).rejects.toThrow('Database error');
    });

    it('should emit notification event', async () => {
      const notification = {
        type: NotificationType.REGISTRY_PURCHASE,
        priority: NotificationPriority.HIGH,
        title: 'Test Notification',
        message: 'Test message',
        shopId: 'test-shop',
        customerId: 'test-customer',
      };

      const mockSystemJob = {
        id: 'test-job-id',
        type: 'notification',
        status: 'completed',
        payload: JSON.stringify(notification),
        shopId: notification.shopId,
        completedAt: new Date(),
        createdAt: new Date(),
      };

      mockPrismaClient.systemJob.create.mockResolvedValue(mockSystemJob);

      const emitSpy = vi.spyOn(notificationManager, 'emit');

      await notificationManager.sendNotification(notification);

      expect(emitSpy).toHaveBeenCalledWith('notification', expect.objectContaining({
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        shopId: notification.shopId,
        customerId: notification.customerId,
      }));
    });
  });

  describe('getRecentNotifications', () => {
    it('should return cached notifications if available', async () => {
      const shopId = 'test-shop';
      const customerId = 'test-customer';
      const limit = 5;

      const cachedNotifications = [
        {
          id: 'notif_1',
          type: NotificationType.REGISTRY_PURCHASE,
          priority: NotificationPriority.HIGH,
          title: 'Test Notification 1',
          message: 'Test message 1',
          shopId,
          customerId,
          createdAt: new Date(),
        },
        {
          id: 'notif_2',
          type: NotificationType.ITEM_ADDED,
          priority: NotificationPriority.MEDIUM,
          title: 'Test Notification 2',
          message: 'Test message 2',
          shopId,
          customerId,
          createdAt: new Date(),
        },
      ];

      const { cacheManager } = await import('../app/lib/cache-manager.server');
      vi.mocked(cacheManager.get).mockResolvedValue(cachedNotifications);

      const result = await notificationManager.getRecentNotifications(shopId, customerId, limit);

      expect(result).toEqual(cachedNotifications.slice(0, limit));
      expect(mockPrismaClient.systemJob.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      const shopId = 'test-shop';
      const customerId = 'test-customer';
      const limit = 5;

      const { cacheManager } = await import('../app/lib/cache-manager.server');
      vi.mocked(cacheManager.get).mockResolvedValue(null);

      const mockSystemJobs = [
        {
          id: 'job_1',
          type: 'notification',
          payload: JSON.stringify({
            id: 'notif_1',
            type: NotificationType.REGISTRY_PURCHASE,
            priority: NotificationPriority.HIGH,
            title: 'Test Notification 1',
            message: 'Test message 1',
            shopId,
            customerId,
            createdAt: new Date(),
          }),
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.systemJob.findMany.mockResolvedValue(mockSystemJobs);

      const result = await notificationManager.getRecentNotifications(shopId, customerId, limit);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('notif_1');
      expect(mockPrismaClient.systemJob.findMany).toHaveBeenCalledWith({
        where: {
          type: 'notification',
          shopId,
          payload: {
            contains: `"customerId":"${customerId}"`,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    });

    it('should handle database query without customerId', async () => {
      const shopId = 'test-shop';
      const limit = 5;

      const { cacheManager } = await import('../app/lib/cache-manager.server');
      vi.mocked(cacheManager.get).mockResolvedValue(null);

      mockPrismaClient.systemJob.findMany.mockResolvedValue([]);

      await notificationManager.getRecentNotifications(shopId, undefined, limit);

      expect(mockPrismaClient.systemJob.findMany).toHaveBeenCalledWith({
        where: {
          type: 'notification',
          shopId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    });

    it('should handle malformed notification payloads', async () => {
      const shopId = 'test-shop';
      const limit = 5;

      const { cacheManager } = await import('../app/lib/cache-manager.server');
      vi.mocked(cacheManager.get).mockResolvedValue(null);

      const mockSystemJobs = [
        {
          id: 'job_1',
          type: 'notification',
          payload: 'invalid json',
          createdAt: new Date(),
        },
        {
          id: 'job_2',
          type: 'notification',
          payload: null,
          createdAt: new Date(),
        },
        {
          id: 'job_3',
          type: 'notification',
          payload: JSON.stringify({
            id: 'notif_1',
            type: NotificationType.REGISTRY_PURCHASE,
            title: 'Valid Notification',
            message: 'Valid message',
            shopId,
            createdAt: new Date(),
          }),
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.systemJob.findMany.mockResolvedValue(mockSystemJobs);

      const result = await notificationManager.getRecentNotifications(shopId, undefined, limit);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('notif_1');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read in cache', async () => {
      const notificationId = 'notif_123';
      const { cacheManager } = await import('../app/lib/cache-manager.server');

      const mockNotifications = [
        {
          id: notificationId,
          type: NotificationType.REGISTRY_PURCHASE,
          title: 'Test Notification',
          message: 'Test message',
          shopId: 'test-shop',
          customerId: 'test-customer',
          createdAt: new Date(),
          readAt: null,
        },
      ];

      vi.mocked(cacheManager.get).mockResolvedValue(mockNotifications);

      await notificationManager.markAsRead(notificationId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            id: notificationId,
            readAt: expect.any(Date),
          }),
        ]),
        3600
      );
    });
  });
});

describe('NotificationTemplates', () => {
  describe('registryPurchase', () => {
    it('should create registry purchase notification template', () => {
      const template = NotificationTemplates.registryPurchase('John Doe', 'Test Product', 2);

      expect(template).toEqual({
        type: NotificationType.REGISTRY_PURCHASE,
        priority: NotificationPriority.HIGH,
        title: 'New Registry Purchase! 🎁',
        message: 'John Doe purchased 2 × Test Product from your registry',
      });
    });
  });

  describe('registryShared', () => {
    it('should create registry shared notification template', () => {
      const template = NotificationTemplates.registryShared('Jane Smith', 'Facebook');

      expect(template).toEqual({
        type: NotificationType.REGISTRY_SHARED,
        priority: NotificationPriority.MEDIUM,
        title: 'Registry Shared',
        message: 'Jane Smith shared your registry on Facebook',
      });
    });
  });

  describe('itemAdded', () => {
    it('should create item added notification template', () => {
      const template = NotificationTemplates.itemAdded('Test Product');

      expect(template).toEqual({
        type: NotificationType.ITEM_ADDED,
        priority: NotificationPriority.LOW,
        title: 'Item Added',
        message: 'Test Product was added to your registry',
      });
    });
  });

  describe('outOfStock', () => {
    it('should create out of stock notification template', () => {
      const template = NotificationTemplates.outOfStock('Test Product');

      expect(template).toEqual({
        type: NotificationType.OUT_OF_STOCK,
        priority: NotificationPriority.HIGH,
        title: 'Item Out of Stock ⚠️',
        message: 'Test Product is now out of stock',
      });
    });
  });

  describe('backInStock', () => {
    it('should create back in stock notification template', () => {
      const template = NotificationTemplates.backInStock('Test Product');

      expect(template).toEqual({
        type: NotificationType.BACK_IN_STOCK,
        priority: NotificationPriority.MEDIUM,
        title: 'Item Back in Stock ✅',
        message: 'Test Product is now available again',
      });
    });
  });

  describe('priceChange', () => {
    it('should create price drop notification template', () => {
      const template = NotificationTemplates.priceChange('Test Product', 100, 80, 'USD');

      expect(template).toEqual({
        type: NotificationType.PRICE_CHANGE,
        priority: NotificationPriority.MEDIUM,
        title: 'Price Drop! 💰',
        message: 'Test Product price changed from USD100 to USD80',
      });
    });

    it('should create price increase notification template', () => {
      const template = NotificationTemplates.priceChange('Test Product', 80, 100, 'USD');

      expect(template).toEqual({
        type: NotificationType.PRICE_CHANGE,
        priority: NotificationPriority.MEDIUM,
        title: 'Price Change',
        message: 'Test Product price changed from USD80 to USD100',
      });
    });
  });

  describe('registryExpiring', () => {
    it('should create registry expiring notification template', () => {
      const template = NotificationTemplates.registryExpiring(3);

      expect(template).toEqual({
        type: NotificationType.REGISTRY_EXPIRING,
        priority: NotificationPriority.URGENT,
        title: 'Registry Expiring Soon! ⏰',
        message: 'Your registry will expire in 3 days',
      });
    });
  });

  describe('giftMessage', () => {
    it('should create gift message notification template', () => {
      const template = NotificationTemplates.giftMessage('John Doe');

      expect(template).toEqual({
        type: NotificationType.GIFT_MESSAGE,
        priority: NotificationPriority.MEDIUM,
        title: 'New Gift Message 💌',
        message: 'You received a gift message from John Doe',
      });
    });
  });
});

describe('scheduleNotificationChecks', () => {
  const mockPrismaClient = testUtils.getMockPrismaClient();

  beforeEach(() => {
    testUtils.resetMocks();
    vi.clearAllMocks();
  });

  it('should check for expiring registries and send notifications', async () => {
    const shopId = 'test-shop';
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const mockExpiringRegistries = [
      {
        id: 'registry_1',
        customerId: 'customer_1',
        eventDate: sevenDaysFromNow,
        title: 'Wedding Registry',
      },
      {
        id: 'registry_2',
        customerId: 'customer_2',
        eventDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
        title: 'Birthday Registry',
      },
    ];

    mockPrismaClient.registry.findMany.mockResolvedValue(mockExpiringRegistries);
    mockPrismaClient.registryItem.findMany.mockResolvedValue([]);

    const sendNotificationSpy = vi.spyOn(notificationManager, 'sendNotification');

    await scheduleNotificationChecks(shopId);

    expect(sendNotificationSpy).toHaveBeenCalledTimes(2);
    expect(sendNotificationSpy).toHaveBeenCalledWith({
      type: NotificationType.REGISTRY_EXPIRING,
      priority: NotificationPriority.URGENT,
      title: 'Registry Expiring Soon! ⏰',
      message: 'Your registry will expire in 7 days',
      shopId,
      customerId: 'customer_1',
      registryId: 'registry_1',
      actionUrl: '/app/registries/registry_1',
      actionLabel: 'View Registry',
    });
  });

  it('should check for out of stock items and send notifications', async () => {
    const shopId = 'test-shop';

    const mockOutOfStockItems = [
      {
        productTitle: 'Test Product 1',
        productId: 'product_1',
        variantId: 'variant_1',
        registryId: 'registry_1',
        registry: {
          customerId: 'customer_1',
        },
      },
      {
        productTitle: 'Test Product 2',
        productId: 'product_2',
        variantId: 'variant_2',
        registryId: 'registry_2',
        registry: {
          customerId: 'customer_2',
        },
      },
    ];

    mockPrismaClient.registry.findMany.mockResolvedValue([]);
    mockPrismaClient.registryItem.findMany.mockResolvedValue(mockOutOfStockItems);

    const sendNotificationSpy = vi.spyOn(notificationManager, 'sendNotification');

    await scheduleNotificationChecks(shopId);

    expect(sendNotificationSpy).toHaveBeenCalledTimes(2);
    expect(sendNotificationSpy).toHaveBeenCalledWith({
      type: NotificationType.OUT_OF_STOCK,
      priority: NotificationPriority.HIGH,
      title: 'Item Out of Stock ⚠️',
      message: 'Test Product 1 is now out of stock',
      shopId,
      customerId: 'customer_1',
      registryId: 'registry_1',
      metadata: {
        productId: 'product_1',
        variantId: 'variant_1',
      },
    });
  });

  it('should handle registries without event dates', async () => {
    const shopId = 'test-shop';

    const mockRegistriesWithoutEventDate = [
      {
        id: 'registry_1',
        customerId: 'customer_1',
        eventDate: null,
        title: 'General Registry',
      },
    ];

    mockPrismaClient.registry.findMany.mockResolvedValue(mockRegistriesWithoutEventDate);
    mockPrismaClient.registryItem.findMany.mockResolvedValue([]);

    const sendNotificationSpy = vi.spyOn(notificationManager, 'sendNotification');

    await scheduleNotificationChecks(shopId);

    expect(sendNotificationSpy).not.toHaveBeenCalled();
  });
});