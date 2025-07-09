import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { shopifyApi } from '~/lib/shopify-api.server';
import { GraphqlClient } from '@shopify/shopify-api';
import type { Session } from '@shopify/shopify-api';

// Mock the Shopify GraphQL client
vi.mock('@shopify/shopify-api', () => ({
  GraphqlClient: vi.fn()
}));

describe('Shopify GraphQL API Integration', () => {
  let mockClient: any;
  let mockSession: Session;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      request: vi.fn()
    };

    mockSession = {
      shop: 'test-shop.myshopify.com',
      accessToken: 'test-token',
      state: 'test-state',
      isOnline: true,
      scope: 'read_products,write_orders',
      expires: new Date('2025-01-01'),
      onlineAccessInfo: {
        expires_in: 86399,
        associated_user_scope: 'read_products',
        associated_user: {
          id: 123456,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          locale: 'en',
          collaborator: false,
          email_verified: true
        }
      }
    } as Session;

    vi.mocked(GraphqlClient).mockReturnValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Product Queries', () => {
    it('should fetch products with proper GraphQL query', async () => {
      const mockProducts = {
        data: {
          products: {
            edges: [
              {
                node: {
                  id: 'gid://shopify/Product/123',
                  title: 'Test Product',
                  handle: 'test-product',
                  description: 'A test product',
                  featuredImage: {
                    url: 'https://example.com/image.jpg',
                    altText: 'Test Product'
                  },
                  priceRange: {
                    minVariantPrice: {
                      amount: '19.99',
                      currencyCode: 'USD'
                    }
                  },
                  variants: {
                    edges: [
                      {
                        node: {
                          id: 'gid://shopify/ProductVariant/456',
                          title: 'Default',
                          price: '19.99',
                          availableForSale: true,
                          inventoryQuantity: 10
                        }
                      }
                    ]
                  }
                }
              }
            ],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          }
        }
      };

      mockClient.request.mockResolvedValue(mockProducts);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.getProducts({ first: 10 });

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('query GetProducts'),
        expect.objectContaining({
          variables: { first: 10 }
        })
      );
      expect(result).toEqual(mockProducts.data.products);
    });

    it('should handle pagination correctly', async () => {
      const mockFirstPage = {
        data: {
          products: {
            edges: Array(10).fill({
              node: { id: 'gid://shopify/Product/1' }
            }),
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: false,
              endCursor: 'cursor_1'
            }
          }
        }
      };

      const mockSecondPage = {
        data: {
          products: {
            edges: Array(5).fill({
              node: { id: 'gid://shopify/Product/2' }
            }),
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: true,
              endCursor: 'cursor_2'
            }
          }
        }
      };

      mockClient.request
        .mockResolvedValueOnce(mockFirstPage)
        .mockResolvedValueOnce(mockSecondPage);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      
      // First page
      const result1 = await api.getProducts({ first: 10 });
      expect(result1.pageInfo.hasNextPage).toBe(true);
      
      // Second page
      const result2 = await api.getProducts({ first: 10, after: 'cursor_1' });
      expect(result2.pageInfo.hasNextPage).toBe(false);
      
      expect(mockClient.request).toHaveBeenCalledTimes(2);
    });

    it('should search products by query', async () => {
      const mockSearchResults = {
        data: {
          products: {
            edges: [
              {
                node: {
                  id: 'gid://shopify/Product/789',
                  title: 'Wedding Dress',
                  handle: 'wedding-dress'
                }
              }
            ]
          }
        }
      };

      mockClient.request.mockResolvedValue(mockSearchResults);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.getProducts({ 
        first: 10, 
        query: 'title:*wedding*' 
      });

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          variables: expect.objectContaining({
            query: 'title:*wedding*'
          })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockClient.request.mockRejectedValue(new Error('GraphQL Error'));

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      
      await expect(api.getProducts({ first: 10 })).rejects.toThrow('Failed to fetch products');
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = {
        response: {
          errors: [{ message: 'Throttled' }],
          extensions: {
            cost: {
              requestedQueryCost: 1000,
              actualQueryCost: 900,
              throttleStatus: {
                maximumAvailable: 1000,
                currentlyAvailable: 100,
                restoreRate: 50
              }
            }
          }
        }
      };

      mockClient.request.mockRejectedValue(rateLimitError);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      
      await expect(api.getProducts({ first: 100 })).rejects.toThrow('Rate limited');
    });
  });

  describe('Inventory Queries', () => {
    it('should fetch inventory levels for products', async () => {
      const mockInventory = {
        data: {
          productVariants: {
            edges: [
              {
                node: {
                  id: 'gid://shopify/ProductVariant/123',
                  inventoryItem: {
                    id: 'gid://shopify/InventoryItem/456',
                    inventoryLevels: {
                      edges: [
                        {
                          node: {
                            location: {
                              id: 'gid://shopify/Location/789',
                              name: 'Main Warehouse'
                            },
                            quantities: [
                              {
                                name: 'available',
                                quantity: 50
                              },
                              {
                                name: 'incoming',
                                quantity: 20
                              },
                              {
                                name: 'committed',
                                quantity: 5
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      };

      mockClient.request.mockResolvedValue(mockInventory);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.getInventoryLevels(['gid://shopify/ProductVariant/123']);

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('inventoryItem'),
        expect.objectContaining({
          variables: expect.objectContaining({
            ids: ['gid://shopify/ProductVariant/123']
          })
        })
      );
      expect(result).toBeDefined();
    });

    it('should handle multiple variant IDs', async () => {
      const variantIds = [
        'gid://shopify/ProductVariant/123',
        'gid://shopify/ProductVariant/456',
        'gid://shopify/ProductVariant/789'
      ];

      mockClient.request.mockResolvedValue({ data: { productVariants: { edges: [] } } });

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      await api.getInventoryLevels(variantIds);

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          variables: { ids: variantIds }
        })
      );
    });
  });

  describe('Order Mutations', () => {
    it('should create order with proper mutation', async () => {
      const mockOrderResponse = {
        data: {
          orderCreate: {
            order: {
              id: 'gid://shopify/Order/123',
              name: '#1001',
              totalPrice: {
                amount: '99.99',
                currencyCode: 'USD'
              },
              customer: {
                id: 'gid://shopify/Customer/456',
                email: 'customer@example.com'
              }
            },
            userErrors: []
          }
        }
      };

      mockClient.request.mockResolvedValue(mockOrderResponse);

      const orderData = {
        email: 'customer@example.com',
        lineItems: [
          {
            variantId: 'gid://shopify/ProductVariant/789',
            quantity: 2
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          address1: '123 Main St',
          city: 'Anytown',
          province: 'CA',
          zip: '12345',
          country: 'US'
        }
      };

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.createOrder(orderData);

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('mutation CreateOrder'),
        expect.objectContaining({
          variables: { order: orderData }
        })
      );
      expect(result).toEqual(mockOrderResponse.data.orderCreate.order);
    });

    it('should handle order creation errors', async () => {
      const mockErrorResponse = {
        data: {
          orderCreate: {
            order: null,
            userErrors: [
              {
                field: ['lineItems', '0', 'variantId'],
                message: 'Product variant not found'
              }
            ]
          }
        }
      };

      mockClient.request.mockResolvedValue(mockErrorResponse);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      
      await expect(api.createOrder({
        email: 'test@example.com',
        lineItems: [{ variantId: 'invalid', quantity: 1 }]
      })).rejects.toThrow('Product variant not found');
    });

    it('should include metafields in order creation', async () => {
      const mockOrderResponse = {
        data: {
          orderCreate: {
            order: { id: 'gid://shopify/Order/123' },
            userErrors: []
          }
        }
      };

      mockClient.request.mockResolvedValue(mockOrderResponse);

      const orderData = {
        email: 'test@example.com',
        lineItems: [{ variantId: 'gid://shopify/ProductVariant/123', quantity: 1 }],
        metafields: [
          {
            namespace: 'wishcraft',
            key: 'registry_id',
            value: 'reg_123',
            type: 'single_line_text_field'
          }
        ]
      };

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      await api.createOrder(orderData);

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          variables: {
            order: expect.objectContaining({
              metafields: expect.arrayContaining([
                expect.objectContaining({
                  namespace: 'wishcraft',
                  key: 'registry_id'
                })
              ])
            })
          }
        })
      );
    });
  });

  describe('Customer Queries', () => {
    it('should fetch customer by ID', async () => {
      const mockCustomer = {
        data: {
          customer: {
            id: 'gid://shopify/Customer/123',
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe',
            orders: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Order/456',
                    name: '#1001'
                  }
                }
              ]
            }
          }
        }
      };

      mockClient.request.mockResolvedValue(mockCustomer);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.getCustomer('gid://shopify/Customer/123');

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('query GetCustomer'),
        expect.objectContaining({
          variables: { id: 'gid://shopify/Customer/123' }
        })
      );
      expect(result).toEqual(mockCustomer.data.customer);
    });

    it('should search customers by email', async () => {
      const mockSearchResults = {
        data: {
          customers: {
            edges: [
              {
                node: {
                  id: 'gid://shopify/Customer/789',
                  email: 'test@example.com'
                }
              }
            ]
          }
        }
      };

      mockClient.request.mockResolvedValue(mockSearchResults);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.searchCustomers('email:test@example.com');

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('query SearchCustomers'),
        expect.objectContaining({
          variables: expect.objectContaining({
            query: 'email:test@example.com'
          })
        })
      );
    });
  });

  describe('Metafield Operations', () => {
    it('should create metafields for resources', async () => {
      const mockMetafieldResponse = {
        data: {
          metafieldsSet: {
            metafields: [
              {
                id: 'gid://shopify/Metafield/123',
                namespace: 'wishcraft',
                key: 'registry_data',
                value: '{"registryId":"reg_123"}',
                type: 'json'
              }
            ],
            userErrors: []
          }
        }
      };

      mockClient.request.mockResolvedValue(mockMetafieldResponse);

      const metafieldData = {
        ownerId: 'gid://shopify/Customer/456',
        namespace: 'wishcraft',
        key: 'registry_data',
        value: JSON.stringify({ registryId: 'reg_123' }),
        type: 'json'
      };

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.setMetafield(metafieldData);

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.stringContaining('mutation SetMetafields'),
        expect.objectContaining({
          variables: {
            metafields: [metafieldData]
          }
        })
      );
      expect(result).toEqual(mockMetafieldResponse.data.metafieldsSet.metafields[0]);
    });

    it('should handle metafield validation errors', async () => {
      const mockErrorResponse = {
        data: {
          metafieldsSet: {
            metafields: [],
            userErrors: [
              {
                field: ['metafields', '0', 'value'],
                message: 'Value is not valid JSON'
              }
            ]
          }
        }
      };

      mockClient.request.mockResolvedValue(mockErrorResponse);

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      
      await expect(api.setMetafield({
        ownerId: 'gid://shopify/Customer/123',
        namespace: 'wishcraft',
        key: 'data',
        value: 'invalid json',
        type: 'json'
      })).rejects.toThrow('Value is not valid JSON');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockClient.request.mockRejectedValue(new Error('Network error'));

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      
      await expect(api.getProducts({ first: 10 })).rejects.toThrow('Failed to fetch products');
    });

    it('should handle malformed responses', async () => {
      mockClient.request.mockResolvedValue({ data: null });

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      
      await expect(api.getProducts({ first: 10 })).rejects.toThrow('Invalid response');
    });

    it('should retry on transient errors', async () => {
      mockClient.request
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          data: {
            products: {
              edges: [],
              pageInfo: { hasNextPage: false }
            }
          }
        });

      const api = new shopifyApi.ShopifyGraphQLAPI(mockSession);
      const result = await api.getProducts({ first: 10 });

      expect(mockClient.request).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });
  });
});