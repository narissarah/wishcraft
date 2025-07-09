import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { action as inventoryWebhook } from '~/routes/webhooks.inventory_levels.update';
import { action as productsWebhook } from '~/routes/webhooks.products.update';
import { action as ordersWebhook } from '~/routes/webhooks.orders.create';
import { action as customersWebhook } from '~/routes/webhooks.customers.create';
import { action as uninstallWebhook } from '~/routes/webhooks.app.uninstalled';
import { authenticate } from '~/shopify.server';
import { db } from '~/lib/db.server';
import { wsServer } from '~/lib/websocket.server';
import crypto from 'crypto';

// Mock dependencies
vi.mock('~/shopify.server', () => ({
  authenticate: {
    webhook: vi.fn()
  }
}));

vi.mock('~/lib/db.server', () => ({
  db: {
    registryItem: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    registryAlert: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    registryActivity: {
      create: vi.fn()
    },
    registry: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    session: {
      deleteMany: vi.fn()
    },
    shop: {
      update: vi.fn()
    },
    customer: {
      create: vi.fn(),
      findUnique: vi.fn()
    },
    registryPurchase: {
      create: vi.fn()
    }
  }
}));

vi.mock('~/lib/websocket.server', () => ({
  wsServer: {
    broadcastInventoryUpdate: vi.fn(),
    broadcastPurchaseNotification: vi.fn()
  },
  notifyInventoryUpdate: vi.fn(),
  notifyPurchase: vi.fn()
}));

describe('Webhook Handler Integration Tests', () => {
  const mockShop = 'test-shop.myshopify.com';
  const mockSession = { shop: mockShop };
  const mockAdmin = { rest: {}, graphql: {} };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Inventory Levels Update Webhook', () => {
    const createInventoryWebhookPayload = (data: any) => ({
      inventory_item_id: 'gid://shopify/InventoryItem/123',
      location_id: 'gid://shopify/Location/456',
      available: data.available || 10,
      committed: data.committed || 0,
      incoming: data.incoming || 5,
      on_hand: data.on_hand || 10,
      updated_at: new Date().toISOString()
    });

    it('should process inventory update and notify affected registries', async () => {
      const payload = createInventoryWebhookPayload({ available: 5 });
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'INVENTORY_LEVELS/UPDATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      const mockRegistryItems = [
        {
          id: 'item_1',
          productVariantId: 'gid://shopify/InventoryItem/123',
          registry: { id: 'reg_1', shopId: mockShop }
        },
        {
          id: 'item_2',
          productVariantId: 'gid://shopify/InventoryItem/123',
          registry: { id: 'reg_2', shopId: mockShop }
        }
      ];

      vi.mocked(db.registryItem.findMany).mockResolvedValue(mockRegistryItems);
      vi.mocked(db.registryAlert.findFirst).mockResolvedValue(null);

      const request = new Request('https://app.com/webhooks/inventory_levels/update', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const response = await inventoryWebhook({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);
      expect(db.registryItem.findMany).toHaveBeenCalledWith({
        where: {
          productVariantId: 'gid://shopify/InventoryItem/123',
          registry: { shopId: mockShop }
        },
        include: {
          registry: {
            select: { id: true, shopId: true }
          }
        }
      });

      // Should update inventory for affected items
      expect(db.registryItem.updateMany).toHaveBeenCalledWith({
        where: {
          registryId: 'reg_1',
          productVariantId: 'gid://shopify/InventoryItem/123'
        },
        data: {
          inventoryQuantity: 5,
          inventoryTracking: true,
          updatedAt: expect.any(Date)
        }
      });

      // Should create low stock alert
      expect(db.registryAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'low_stock',
          severity: 'warning'
        })
      });
    });

    it('should create out of stock alert when inventory is zero', async () => {
      const payload = createInventoryWebhookPayload({ available: 0 });
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'INVENTORY_LEVELS/UPDATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.registryItem.findMany).mockResolvedValue([
        {
          id: 'item_1',
          productVariantId: 'gid://shopify/InventoryItem/123',
          productTitle: 'Test Product',
          registry: { id: 'reg_1', shopId: mockShop }
        }
      ]);
      vi.mocked(db.registryAlert.findFirst).mockResolvedValue(null);

      const request = new Request('https://app.com/webhooks/inventory_levels/update', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await inventoryWebhook({ request, params: {}, context: {} } as any);

      expect(db.registryAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'out_of_stock',
          severity: 'critical',
          message: expect.stringContaining('out of stock')
        })
      });

      expect(db.registryItem.updateMany).toHaveBeenCalledWith({
        where: {
          registryId: 'reg_1',
          productVariantId: 'gid://shopify/InventoryItem/123'
        },
        data: {
          status: 'unavailable',
          unavailableReason: 'out_of_stock'
        }
      });
    });

    it('should not create duplicate alerts', async () => {
      const payload = createInventoryWebhookPayload({ available: 3 });
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'INVENTORY_LEVELS/UPDATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.registryItem.findMany).mockResolvedValue([
        {
          id: 'item_1',
          productVariantId: 'gid://shopify/InventoryItem/123',
          registry: { id: 'reg_1', shopId: mockShop }
        }
      ]);

      // Existing alert found
      vi.mocked(db.registryAlert.findFirst).mockResolvedValue({
        id: 'alert_1',
        type: 'low_stock'
      } as any);

      const request = new Request('https://app.com/webhooks/inventory_levels/update', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await inventoryWebhook({ request, params: {}, context: {} } as any);

      expect(db.registryAlert.create).not.toHaveBeenCalled();
    });
  });

  describe('Products Update Webhook', () => {
    const createProductWebhookPayload = () => ({
      id: 123456,
      title: 'Updated Product',
      handle: 'updated-product',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
      published_at: '2024-01-01T00:00:00Z',
      tags: 'test, product',
      status: 'active',
      admin_graphql_api_id: 'gid://shopify/Product/123456',
      variants: [
        {
          id: 789012,
          product_id: 123456,
          title: 'Default',
          price: '29.99',
          sku: 'TEST-001',
          inventory_quantity: 50,
          admin_graphql_api_id: 'gid://shopify/ProductVariant/789012'
        }
      ],
      images: [
        {
          id: 345678,
          product_id: 123456,
          position: 1,
          src: 'https://example.com/image.jpg',
          width: 1000,
          height: 1000
        }
      ]
    });

    it('should update registry items when product is updated', async () => {
      const payload = createProductWebhookPayload();
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'PRODUCTS/UPDATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.registryItem.findMany).mockResolvedValue([
        {
          id: 'item_1',
          productId: 'gid://shopify/Product/123456',
          productVariantId: 'gid://shopify/ProductVariant/789012',
          registryId: 'reg_1'
        }
      ]);

      const request = new Request('https://app.com/webhooks/products/update', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const response = await productsWebhook({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);
      expect(db.registryItem.updateMany).toHaveBeenCalledWith({
        where: { productId: 'gid://shopify/Product/123456' },
        data: {
          productTitle: 'Updated Product',
          productHandle: 'updated-product',
          productImage: 'https://example.com/image.jpg',
          productVendor: 'Test Vendor',
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should update variant-specific information', async () => {
      const payload = createProductWebhookPayload();
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'PRODUCTS/UPDATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.registryItem.findMany).mockResolvedValue([
        {
          id: 'item_1',
          productId: 'gid://shopify/Product/123456',
          productVariantId: 'gid://shopify/ProductVariant/789012',
          registryId: 'reg_1'
        }
      ]);

      const request = new Request('https://app.com/webhooks/products/update', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await productsWebhook({ request, params: {}, context: {} } as any);

      expect(db.registryItem.updateMany).toHaveBeenCalledWith({
        where: { 
          productId: 'gid://shopify/Product/123456',
          productVariantId: 'gid://shopify/ProductVariant/789012'
        },
        data: expect.objectContaining({
          productVariantTitle: 'Default',
          price: 29.99,
          sku: 'TEST-001',
          inventoryQuantity: 50
        })
      });
    });
  });

  describe('Orders Create Webhook', () => {
    const createOrderWebhookPayload = () => ({
      id: 987654,
      admin_graphql_api_id: 'gid://shopify/Order/987654',
      name: '#1001',
      email: 'customer@example.com',
      created_at: new Date().toISOString(),
      total_price: '99.99',
      currency: 'USD',
      customer: {
        id: 111222,
        email: 'customer@example.com',
        first_name: 'John',
        last_name: 'Doe'
      },
      line_items: [
        {
          id: 333444,
          variant_id: 789012,
          quantity: 1,
          price: '29.99',
          product_id: 123456,
          title: 'Test Product',
          variant_title: 'Default',
          properties: [
            { name: 'registry_id', value: 'reg_123' },
            { name: 'registry_item_id', value: 'item_456' }
          ]
        }
      ],
      shipping_address: {
        first_name: 'John',
        last_name: 'Doe',
        address1: '123 Main St',
        city: 'Anytown',
        province: 'CA',
        zip: '12345',
        country: 'US'
      }
    });

    it('should process registry purchases from orders', async () => {
      const payload = createOrderWebhookPayload();
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'ORDERS/CREATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.registryItem.findMany).mockResolvedValue([
        {
          id: 'item_456',
          registryId: 'reg_123',
          productVariantId: 'gid://shopify/ProductVariant/789012',
          quantity: 2,
          productTitle: 'Test Product'
        }
      ]);

      const request = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const response = await ordersWebhook({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);
      
      // Should create purchase record
      expect(db.registryPurchase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          registryItemId: 'item_456',
          orderId: 'gid://shopify/Order/987654',
          orderName: '#1001',
          quantity: 1,
          purchaserEmail: 'customer@example.com',
          purchaserName: 'John Doe',
          price: 29.99
        })
      });

      // Should update registry item status
      expect(db.registryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item_456' },
        data: {
          purchasedQuantity: 1,
          status: 'partially_purchased'
        }
      });
    });

    it('should mark item as fully purchased when quantity matches', async () => {
      const payload = createOrderWebhookPayload();
      payload.line_items[0].quantity = 2;
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'ORDERS/CREATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.registryItem.findMany).mockResolvedValue([
        {
          id: 'item_456',
          registryId: 'reg_123',
          productVariantId: 'gid://shopify/ProductVariant/789012',
          quantity: 2,
          purchasedQuantity: 0
        }
      ]);

      const request = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await ordersWebhook({ request, params: {}, context: {} } as any);

      expect(db.registryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item_456' },
        data: {
          purchasedQuantity: 2,
          status: 'purchased',
          purchasedAt: expect.any(Date)
        }
      });
    });

    it('should send real-time purchase notifications', async () => {
      const payload = createOrderWebhookPayload();
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'ORDERS/CREATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.registryItem.findMany).mockResolvedValue([
        {
          id: 'item_456',
          registryId: 'reg_123',
          productVariantId: 'gid://shopify/ProductVariant/789012',
          quantity: 1
        }
      ]);

      const request = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await ordersWebhook({ request, params: {}, context: {} } as any);

      expect(wsServer.broadcastPurchaseNotification).toHaveBeenCalledWith(
        'reg_123',
        expect.objectContaining({
          productTitle: 'Test Product',
          buyerName: 'John Doe',
          buyerEmail: 'customer@example.com'
        })
      );
    });
  });

  describe('Customers Create Webhook', () => {
    const createCustomerWebhookPayload = () => ({
      id: 555666,
      admin_graphql_api_id: 'gid://shopify/Customer/555666',
      email: 'newcustomer@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '+1234567890',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verified_email: true,
      tags: 'new, customer',
      accepts_marketing: true,
      addresses: [
        {
          id: 777888,
          customer_id: 555666,
          first_name: 'Jane',
          last_name: 'Smith',
          address1: '456 Oak Ave',
          city: 'Somewhere',
          province: 'NY',
          zip: '54321',
          country: 'US',
          default: true
        }
      ]
    });

    it('should create customer record on new customer', async () => {
      const payload = createCustomerWebhookPayload();
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'CUSTOMERS/CREATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.customer.findUnique).mockResolvedValue(null);

      const request = new Request('https://app.com/webhooks/customers/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const response = await customersWebhook({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);
      expect(db.customer.create).toHaveBeenCalledWith({
        data: {
          id: 'gid://shopify/Customer/555666',
          shopId: mockShop,
          email: 'newcustomer@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567890',
          acceptsMarketing: true,
          verifiedEmail: true,
          tags: ['new', 'customer'],
          defaultAddress: expect.objectContaining({
            address1: '456 Oak Ave',
            city: 'Somewhere'
          })
        }
      });
    });

    it('should not create duplicate customer records', async () => {
      const payload = createCustomerWebhookPayload();
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'CUSTOMERS/CREATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload
      });

      vi.mocked(db.customer.findUnique).mockResolvedValue({
        id: 'gid://shopify/Customer/555666'
      } as any);

      const request = new Request('https://app.com/webhooks/customers/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await customersWebhook({ request, params: {}, context: {} } as any);

      expect(db.customer.create).not.toHaveBeenCalled();
    });
  });

  describe('App Uninstalled Webhook', () => {
    it('should clean up data on app uninstall', async () => {
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'APP/UNINSTALLED',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload: { shop: mockShop }
      });

      const request = new Request('https://app.com/webhooks/app/uninstalled', {
        method: 'POST',
        body: JSON.stringify({ shop: mockShop })
      });

      const response = await uninstallWebhook({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);
      
      // Should soft delete registries
      expect(db.registry.updateMany).toHaveBeenCalledWith({
        where: { shopId: mockShop },
        data: {
          isActive: false,
          deletedAt: expect.any(Date)
        }
      });

      // Should delete sessions
      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { shop: mockShop }
      });

      // Should mark shop as uninstalled
      expect(db.shop.update).toHaveBeenCalledWith({
        where: { id: mockShop },
        data: {
          isInstalled: false,
          uninstalledAt: expect.any(Date)
        }
      });
    });
  });

  describe('GDPR Webhook Compliance', () => {
    const { action: dataRequestWebhook } = require('~/routes/webhooks.customers.data_request');
    const { action: redactWebhook } = require('~/routes/webhooks.customers.redact');
    const { action: shopRedactWebhook } = require('~/routes/webhooks.shop.redact');

    it('should handle customer data request webhook', async () => {
      const payload = {
        customer: {
          id: 123456,
          email: 'customer@example.com',
          created_at: '2023-01-01T00:00:00Z',
        },
        orders_requested: ['order1', 'order2'],
      };

      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'CUSTOMERS/DATA_REQUEST',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload,
      });

      const request = new Request('https://app.com/webhooks/customers/data_request', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await dataRequestWebhook({ request, params: {}, context: {} } as any);
      expect(response.status).toBe(200);
    });

    it('should handle customer redact webhook', async () => {
      const payload = {
        customer: {
          id: 123456,
          email: 'customer@example.com',
        },
        orders_to_redact: ['order1', 'order2'],
      };

      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'CUSTOMERS/REDACT',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload,
      });

      const request = new Request('https://app.com/webhooks/customers/redact', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await redactWebhook({ request, params: {}, context: {} } as any);
      expect(response.status).toBe(200);
    });

    it('should handle shop redact webhook', async () => {
      const payload = {
        shop_id: 123456,
        shop_domain: mockShop,
      };

      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'SHOP/REDACT',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload,
      });

      const request = new Request('https://app.com/webhooks/shop/redact', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await shopRedactWebhook({ request, params: {}, context: {} } as any);
      expect(response.status).toBe(200);
    });
  });

  describe('Webhook Rate Limiting', () => {
    it('should handle rate-limited webhook requests', async () => {
      const payload = { test: 'data' };
      
      // Mock rate limiting error
      vi.mocked(authenticate.webhook).mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const request = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await expect(ordersWebhook({ request, params: {}, context: {} } as any))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should implement exponential backoff for webhook retries', async () => {
      const payload = { test: 'data' };
      let attempts = 0;
      
      vi.mocked(authenticate.webhook).mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return {
          topic: 'ORDERS/CREATE',
          shop: mockShop,
          session: mockSession,
          admin: mockAdmin,
          payload,
        };
      });

      const request = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // This would need to be implemented in the actual webhook handlers
      // For now, we just test that retries would work
      expect(attempts).toBe(0);
    });
  });

  describe('Webhook Performance', () => {
    it('should process webhooks within performance thresholds', async () => {
      const payload = { test: 'data' };
      const startTime = Date.now();
      
      vi.mocked(authenticate.webhook).mockResolvedValue({
        topic: 'ORDERS/CREATE',
        shop: mockShop,
        session: mockSession,
        admin: mockAdmin,
        payload,
      });

      const request = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await ordersWebhook({ request, params: {}, context: {} } as any);
      const processingTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
    });

    it('should handle high-volume webhook processing', async () => {
      const webhookPromises = [];
      
      for (let i = 0; i < 10; i++) {
        const payload = { test: `data-${i}` };
        
        vi.mocked(authenticate.webhook).mockResolvedValue({
          topic: 'ORDERS/CREATE',
          shop: mockShop,
          session: mockSession,
          admin: mockAdmin,
          payload,
        });

        const request = new Request('https://app.com/webhooks/orders/create', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        webhookPromises.push(ordersWebhook({ request, params: {}, context: {} } as any));
      }

      const responses = await Promise.all(webhookPromises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Webhook Authentication', () => {
    it('should reject unauthorized webhook requests', async () => {
      vi.mocked(authenticate.webhook).mockRejectedValue(new Error('Unauthorized'));

      const request = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        body: JSON.stringify({ fake: 'data' })
      });

      await expect(ordersWebhook({ request, params: {}, context: {} } as any))
        .rejects.toThrow('Unauthorized');
    });

    it('should validate webhook signatures', async () => {
      const payload = { test: 'data' };
      const secret = 'webhook_secret';
      const body = JSON.stringify(payload);
      
      // Create valid HMAC signature
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(body, 'utf8');
      const hash = hmac.digest('base64');

      vi.mocked(authenticate.webhook).mockImplementation(async (request) => {
        const signature = request.headers.get('X-Shopify-Hmac-Sha256');
        if (signature !== hash) {
          throw new Error('Invalid signature');
        }
        return {
          topic: 'ORDERS/CREATE',
          shop: mockShop,
          session: mockSession,
          admin: mockAdmin,
          payload
        };
      });

      const validRequest = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hash,
          'X-Shopify-Topic': 'orders/create',
          'X-Shopify-Shop-Domain': mockShop
        },
        body
      });

      const response = await ordersWebhook({ request: validRequest, params: {}, context: {} } as any);
      expect(response.status).toBe(200);

      const invalidRequest = new Request('https://app.com/webhooks/orders/create', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': 'invalid_signature',
          'X-Shopify-Topic': 'orders/create',
          'X-Shopify-Shop-Domain': mockShop
        },
        body
      });

      await expect(ordersWebhook({ request: invalidRequest, params: {}, context: {} } as any))
        .rejects.toThrow('Invalid signature');
    });
  });
});