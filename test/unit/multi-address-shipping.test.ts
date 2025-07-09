import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  splitOrderByShippingAddress,
  getShippingRatesForGroup,
  createMultiAddressOrders,
  coordinateDeliveries,
  sendShippingNotifications,
  type ShippingAddress,
  type RegistryItemWithShipping
} from '~/lib/multi-address-shipping.server';
import { db } from '~/lib/db.server';
import { shopifyApi } from '~/lib/shopify-api.server';
import { sendEmail } from '~/lib/email.server';

// Mock dependencies
vi.mock('~/lib/db.server', () => ({
  db: {
    registry: {
      findUnique: vi.fn()
    },
    registryActivity: {
      create: vi.fn()
    }
  }
}));

vi.mock('~/lib/shopify-api.server', () => ({
  shopifyApi: {
    request: vi.fn()
  }
}));

vi.mock('~/lib/email.server', () => ({
  sendEmail: vi.fn()
}));

describe('Multi-Address Shipping', () => {
  const mockRegistryOwnerAddress: ShippingAddress = {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Registry St',
    city: 'Registry City',
    province: 'CA',
    zip: '12345',
    country: 'US',
    email: 'owner@example.com'
  };

  const mockBuyerAddress: ShippingAddress = {
    firstName: 'Jane',
    lastName: 'Smith',
    address1: '456 Buyer Ave',
    city: 'Buyer Town',
    province: 'NY',
    zip: '54321',
    country: 'US',
    email: 'buyer@example.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('splitOrderByShippingAddress', () => {
    it('should group items by shipping preference', async () => {
      const items: RegistryItemWithShipping[] = [
        {
          id: 'item_1',
          productId: 'prod_1',
          productVariantId: 'var_1',
          productTitle: 'Item 1',
          quantity: 1,
          price: 50,
          requiresShipping: true,
          shippingPreference: 'recipient'
        },
        {
          id: 'item_2',
          productId: 'prod_2',
          productVariantId: 'var_2',
          productTitle: 'Item 2',
          quantity: 1,
          price: 75,
          requiresShipping: true,
          shippingPreference: 'giver'
        },
        {
          id: 'item_3',
          productId: 'prod_3',
          productVariantId: 'var_3',
          productTitle: 'Item 3',
          quantity: 1,
          price: 100,
          requiresShipping: true,
          shippingPreference: 'recipient'
        }
      ];

      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          deliveryProfiles: {
            edges: []
          }
        }
      });

      const result = await splitOrderByShippingAddress(
        'reg_123',
        items,
        mockRegistryOwnerAddress,
        mockBuyerAddress
      );

      expect(result).toHaveLength(2);
      
      // Group 1: Items for recipient
      const recipientGroup = result.find(g => g.items.some(i => i.shippingPreference === 'recipient'));
      expect(recipientGroup).toBeDefined();
      expect(recipientGroup!.items).toHaveLength(2);
      expect(recipientGroup!.address).toEqual(expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe'
      }));
      expect(recipientGroup!.totalValue).toBe(150); // 50 + 100

      // Group 2: Items for giver
      const giverGroup = result.find(g => g.items.some(i => i.shippingPreference === 'giver'));
      expect(giverGroup).toBeDefined();
      expect(giverGroup!.items).toHaveLength(1);
      expect(giverGroup!.address).toEqual(expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Smith'
      }));
      expect(giverGroup!.totalValue).toBe(75);
    });

    it('should handle custom shipping addresses', async () => {
      const customAddress: ShippingAddress = {
        firstName: 'Custom',
        lastName: 'Address',
        address1: '789 Custom Ln',
        city: 'Custom City',
        province: 'TX',
        zip: '99999',
        country: 'US'
      };

      const items: RegistryItemWithShipping[] = [
        {
          id: 'item_1',
          productId: 'prod_1',
          productVariantId: 'var_1',
          productTitle: 'Custom Ship Item',
          quantity: 1,
          price: 200,
          requiresShipping: true,
          shippingPreference: 'custom',
          customShippingAddress: customAddress
        }
      ];

      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          deliveryProfiles: {
            edges: []
          }
        }
      });

      const result = await splitOrderByShippingAddress(
        'reg_123',
        items,
        mockRegistryOwnerAddress,
        mockBuyerAddress
      );

      expect(result).toHaveLength(1);
      expect(result[0].address).toEqual(customAddress);
    });

    it('should reject custom shipping without address', async () => {
      const items: RegistryItemWithShipping[] = [
        {
          id: 'item_1',
          productId: 'prod_1',
          productVariantId: 'var_1',
          productTitle: 'Invalid Item',
          quantity: 1,
          price: 100,
          requiresShipping: true,
          shippingPreference: 'custom'
          // Missing customShippingAddress
        }
      ];

      await expect(splitOrderByShippingAddress(
        'reg_123',
        items,
        mockRegistryOwnerAddress,
        mockBuyerAddress
      )).rejects.toThrow('Custom shipping address required for item item_1');
    });

    it('should calculate total weight correctly', async () => {
      const items: RegistryItemWithShipping[] = [
        {
          id: 'item_1',
          productId: 'prod_1',
          productVariantId: 'var_1',
          productTitle: 'Heavy Item',
          quantity: 2,
          price: 50,
          weight: 2.5, // 2.5 kg
          requiresShipping: true,
          shippingPreference: 'recipient'
        },
        {
          id: 'item_2',
          productId: 'prod_2',
          productVariantId: 'var_2',
          productTitle: 'Light Item',
          quantity: 3,
          price: 25,
          weight: 0.5, // 0.5 kg
          requiresShipping: true,
          shippingPreference: 'recipient'
        }
      ];

      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          deliveryProfiles: {
            edges: []
          }
        }
      });

      const result = await splitOrderByShippingAddress(
        'reg_123',
        items,
        mockRegistryOwnerAddress,
        mockBuyerAddress
      );

      expect(result[0].totalWeight).toBe(6.5); // (2.5 * 2) + (0.5 * 3)
    });
  });

  describe('getShippingRatesForGroup', () => {
    it('should return shipping rates from Shopify', async () => {
      const mockShopifyResponse = {
        data: {
          deliveryProfiles: {
            edges: [{
              node: {
                id: 'profile_1',
                name: 'Default',
                locationGroups: {
                  edges: [{
                    node: {
                      countries: [{ code: 'US', provinces: [] }],
                      zones: {
                        edges: [{
                          node: {
                            id: 'zone_1',
                            name: 'United States',
                            methodDefinitions: {
                              edges: [
                                {
                                  node: {
                                    id: 'method_1',
                                    name: 'Standard Shipping',
                                    rateDefinition: {
                                      price: { amount: '9.99', currencyCode: 'USD' }
                                    }
                                  }
                                },
                                {
                                  node: {
                                    id: 'method_2',
                                    name: 'Express Shipping',
                                    rateDefinition: {
                                      price: { amount: '19.99', currencyCode: 'USD' }
                                    }
                                  }
                                }
                              ]
                            }
                          }
                        }]
                      }
                    }
                  }]
                }
              }
            }]
          }
        }
      };

      vi.mocked(shopifyApi.request).mockResolvedValue(mockShopifyResponse);

      const items: RegistryItemWithShipping[] = [{
        id: 'item_1',
        productId: 'prod_1',
        productVariantId: 'var_1',
        productTitle: 'Test Item',
        quantity: 1,
        price: 50,
        requiresShipping: true,
        shippingPreference: 'recipient'
      }];

      const rates = await getShippingRatesForGroup(
        mockRegistryOwnerAddress,
        items,
        1.5
      );

      expect(rates).toHaveLength(2);
      expect(rates[0]).toEqual(expect.objectContaining({
        id: 'method_1',
        title: 'Standard Shipping (United States)',
        price: 9.99
      }));
      expect(rates[1]).toEqual(expect.objectContaining({
        id: 'method_2',
        title: 'Express Shipping (United States)',
        price: 19.99
      }));
    });

    it('should provide fallback rates if Shopify returns empty', async () => {
      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          deliveryProfiles: {
            edges: []
          }
        }
      });

      const items: RegistryItemWithShipping[] = [{
        id: 'item_1',
        productId: 'prod_1',
        productVariantId: 'var_1',
        productTitle: 'Test Item',
        quantity: 1,
        price: 50,
        requiresShipping: true,
        shippingPreference: 'recipient'
      }];

      const rates = await getShippingRatesForGroup(
        mockRegistryOwnerAddress,
        items,
        1.0
      );

      expect(rates).toHaveLength(2);
      expect(rates[0]).toEqual(expect.objectContaining({
        id: 'standard',
        title: 'Standard Shipping',
        price: 9.99,
        deliveryDays: 5
      }));
      expect(rates[1]).toEqual(expect.objectContaining({
        id: 'expedited',
        title: 'Expedited Shipping',
        price: 19.99,
        deliveryDays: 2
      }));
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(shopifyApi.request).mockRejectedValue(new Error('API Error'));

      const items: RegistryItemWithShipping[] = [{
        id: 'item_1',
        productId: 'prod_1',
        productVariantId: 'var_1',
        productTitle: 'Test Item',
        quantity: 1,
        price: 50,
        requiresShipping: true,
        shippingPreference: 'recipient'
      }];

      const rates = await getShippingRatesForGroup(
        mockRegistryOwnerAddress,
        items,
        1.0
      );

      expect(rates).toHaveLength(1);
      expect(rates[0].id).toBe('standard');
    });

    it('should calculate estimated delivery dates', async () => {
      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          deliveryProfiles: {
            edges: []
          }
        }
      });

      const items: RegistryItemWithShipping[] = [{
        id: 'item_1',
        productId: 'prod_1',
        productVariantId: 'var_1',
        productTitle: 'Test Item',
        quantity: 1,
        price: 50,
        requiresShipping: true,
        shippingPreference: 'recipient'
      }];

      const rates = await getShippingRatesForGroup(
        mockRegistryOwnerAddress,
        items,
        1.0
      );

      const standardRate = rates.find(r => r.title.includes('Standard'));
      const expeditedRate = rates.find(r => r.title.includes('Expedited'));

      expect(standardRate?.estimatedDelivery).toBeDefined();
      expect(expeditedRate?.estimatedDelivery).toBeDefined();
      
      // Expedited should arrive before standard
      if (standardRate?.estimatedDelivery && expeditedRate?.estimatedDelivery) {
        expect(expeditedRate.estimatedDelivery.getTime()).toBeLessThan(
          standardRate.estimatedDelivery.getTime()
        );
      }
    });
  });

  describe('createMultiAddressOrders', () => {
    const mockShippingGroups = [
      {
        id: 'group_0',
        address: mockRegistryOwnerAddress,
        items: [{
          id: 'item_1',
          productId: 'prod_1',
          productVariantId: 'var_1',
          productTitle: 'Item 1',
          quantity: 1,
          price: 50,
          requiresShipping: true,
          shippingPreference: 'recipient' as const
        }],
        totalWeight: 1.0,
        totalValue: 50,
        shippingRates: [],
        selectedShippingRate: {
          id: 'standard',
          title: 'Standard Shipping',
          price: 9.99
        }
      }
    ];

    it('should create separate orders for each shipping group', async () => {
      const mockOrder = {
        id: 'order_123',
        name: '#1001',
        totalPrice: { amount: '59.99', currencyCode: 'USD' }
      };

      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          orderCreate: {
            order: mockOrder,
            userErrors: []
          }
        }
      });

      const buyerInfo = {
        email: 'buyer@example.com',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const paymentInfo = {
        totalAmount: 59.99,
        currency: 'USD',
        paymentMethod: 'card'
      };

      const result = await createMultiAddressOrders(
        'reg_123',
        mockShippingGroups,
        buyerInfo,
        paymentInfo
      );

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]).toEqual(mockOrder);
      expect(result.trackingInfo).toHaveLength(1);
      expect(result.trackingInfo[0]).toEqual(expect.objectContaining({
        orderId: 'order_123',
        orderNumber: '#1001',
        shippingAddress: mockRegistryOwnerAddress,
        status: 'pending'
      }));
    });

    it('should handle multiple shipping groups', async () => {
      const multipleGroups = [
        ...mockShippingGroups,
        {
          id: 'group_1',
          address: mockBuyerAddress,
          items: [{
            id: 'item_2',
            productId: 'prod_2',
            productVariantId: 'var_2',
            productTitle: 'Item 2',
            quantity: 1,
            price: 75,
            requiresShipping: true,
            shippingPreference: 'giver' as const
          }],
          totalWeight: 1.5,
          totalValue: 75,
          shippingRates: [],
          selectedShippingRate: {
            id: 'express',
            title: 'Express Shipping',
            price: 19.99
          }
        }
      ];

      vi.mocked(shopifyApi.request)
        .mockResolvedValueOnce({
          data: {
            orderCreate: {
              order: { id: 'order_1', name: '#1001' },
              userErrors: []
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            orderCreate: {
              order: { id: 'order_2', name: '#1002' },
              userErrors: []
            }
          }
        });

      const buyerInfo = {
        email: 'buyer@example.com',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const paymentInfo = {
        totalAmount: 174.97,
        currency: 'USD',
        paymentMethod: 'card'
      };

      const result = await createMultiAddressOrders(
        'reg_123',
        multipleGroups,
        buyerInfo,
        paymentInfo
      );

      expect(result.orders).toHaveLength(2);
      expect(result.trackingInfo).toHaveLength(2);
      expect(shopifyApi.request).toHaveBeenCalledTimes(2);
    });

    it('should include gift messages in orders', async () => {
      const groupWithGiftMessage = [{
        ...mockShippingGroups[0],
        items: [{
          ...mockShippingGroups[0].items[0],
          giftMessage: 'Happy Birthday!'
        }]
      }];

      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          orderCreate: {
            order: { id: 'order_123', name: '#1001' },
            userErrors: []
          }
        }
      });

      const buyerInfo = {
        email: 'buyer@example.com',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const paymentInfo = {
        totalAmount: 59.99,
        currency: 'USD',
        paymentMethod: 'card'
      };

      await createMultiAddressOrders(
        'reg_123',
        groupWithGiftMessage,
        buyerInfo,
        paymentInfo
      );

      expect(shopifyApi.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          variables: {
            order: expect.objectContaining({
              lineItems: expect.arrayContaining([
                expect.objectContaining({
                  customAttributes: expect.arrayContaining([
                    {
                      key: 'gift_message',
                      value: 'Happy Birthday!'
                    }
                  ])
                })
              ])
            })
          }
        })
      );
    });

    it('should handle order creation errors', async () => {
      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          orderCreate: {
            order: null,
            userErrors: [{ message: 'Insufficient inventory' }]
          }
        }
      });

      const buyerInfo = {
        email: 'buyer@example.com',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const paymentInfo = {
        totalAmount: 59.99,
        currency: 'USD',
        paymentMethod: 'card'
      };

      await expect(createMultiAddressOrders(
        'reg_123',
        mockShippingGroups,
        buyerInfo,
        paymentInfo
      )).rejects.toThrow('Order creation failed: Insufficient inventory');
    });
  });

  describe('coordinateDeliveries', () => {
    it('should coordinate synchronized delivery', async () => {
      const ordersInfo = {
        orders: [
          { id: 'order_1', name: '#1001' },
          { id: 'order_2', name: '#1002' }
        ],
        trackingInfo: [
          {
            orderId: 'order_1',
            orderNumber: '#1001',
            estimatedDelivery: new Date('2024-12-20')
          },
          {
            orderId: 'order_2',
            orderNumber: '#1002',
            estimatedDelivery: new Date('2024-12-18')
          }
        ]
      };

      const coordinationPrefs = {
        synchronizeDelivery: true,
        specialInstructions: 'Please deliver all packages on the same day'
      };

      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          orderUpdate: {
            order: { id: 'order_1' },
            userErrors: []
          }
        }
      });

      const result = await coordinateDeliveries(ordersInfo, coordinationPrefs);

      expect(result).toBe(true);
      expect(shopifyApi.request).toHaveBeenCalledTimes(2); // Once for each order
    });

    it('should skip coordination if not requested', async () => {
      const ordersInfo = {
        orders: [],
        trackingInfo: []
      };

      const coordinationPrefs = {
        synchronizeDelivery: false
      };

      const result = await coordinateDeliveries(ordersInfo, coordinationPrefs);

      expect(result).toBe(true);
      expect(shopifyApi.request).not.toHaveBeenCalled();
    });
  });

  describe('sendShippingNotifications', () => {
    it('should send notifications to registry owner and recipients', async () => {
      const mockRegistry = {
        id: 'reg_123',
        title: 'Wedding Registry',
        customerEmail: 'owner@example.com',
        customerFirstName: 'John'
      };

      vi.mocked(db.registry.findUnique).mockResolvedValue(mockRegistry as any);

      const orders = [
        { id: 'order_1', name: '#1001' }
      ];

      const trackingInfo = [
        {
          orderNumber: '#1001',
          shippingAddress: {
            ...mockRegistryOwnerAddress,
            email: 'recipient@example.com'
          },
          items: [{
            productTitle: 'Wedding Gift',
            quantity: 1
          }],
          estimatedDelivery: new Date('2024-12-25')
        }
      ];

      await sendShippingNotifications(
        'reg_123',
        orders,
        trackingInfo,
        ['recipient@example.com']
      );

      expect(sendEmail).toHaveBeenCalledTimes(2);
      
      // Notification to registry owner
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'owner@example.com',
        subject: 'Your gifts are on the way!',
        template: 'multi-address-shipping-notification'
      }));

      // Notification to recipient
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Gift delivery notification',
        template: 'individual-shipment-notification'
      }));
    });

    it('should handle missing registry gracefully', async () => {
      vi.mocked(db.registry.findUnique).mockResolvedValue(null);

      await expect(sendShippingNotifications(
        'non_existent',
        [],
        [],
        []
      )).rejects.toThrow('Registry not found');
    });
  });
});