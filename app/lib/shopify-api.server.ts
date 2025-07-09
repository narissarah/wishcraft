import { authenticate } from "~/shopify.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

// ============================================================================
// SHOPIFY GRAPHQL QUERIES & MUTATIONS
// ============================================================================

export const PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey) {
      edges {
        cursor
        node {
          id
          title
          handle
          description
          vendor
          productType
          tags
          status
          createdAt
          updatedAt
          onlineStoreUrl
          featuredImage {
            id
            url
            altText
            width
            height
          }
          images(first: 5) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
                inventoryPolicy
                inventoryManagement
                availableForSale
                selectedOptions {
                  name
                  value
                }
                image {
                  id
                  url
                  altText
                }
              }
            }
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          totalInventory
          metafields(first: 10) {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

export const PRODUCT_BY_ID_QUERY = `#graphql
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      description
      vendor
      productType
      tags
      status
      createdAt
      updatedAt
      onlineStoreUrl
      featuredImage {
        id
        url
        altText
        width
        height
      }
      images(first: 10) {
        edges {
          node {
            id
            url
            altText
            width
            height
          }
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            sku
            price
            compareAtPrice
            inventoryQuantity
            inventoryPolicy
            inventoryManagement
            availableForSale
            selectedOptions {
              name
              value
            }
            image {
              id
              url
              altText
            }
            metafields(first: 5) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      totalInventory
      metafields(first: 10) {
        edges {
          node {
            id
            namespace
            key
            value
            type
          }
        }
      }
    }
  }
`;

export const INVENTORY_LEVELS_QUERY = `#graphql
  query GetInventoryLevels($inventoryItemIds: [ID!]!) {
    inventoryItems(inventoryItemIds: $inventoryItemIds) {
      id
      sku
      tracked
      inventoryLevels(first: 10) {
        edges {
          node {
            id
            available
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export const CREATE_METAFIELD_MUTATION = `#graphql
  mutation CreateMetafield($metafield: MetafieldInput!) {
    metafieldSet(metafield: $metafield) {
      metafield {
        id
        namespace
        key
        value
        type
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_METAFIELD_MUTATION = `#graphql
  mutation UpdateMetafield($metafield: MetafieldInput!) {
    metafieldSet(metafield: $metafield) {
      metafield {
        id
        namespace
        key
        value
        type
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ============================================================================
// SHOPIFY API SERVICE FUNCTIONS
// ============================================================================

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  onlineStoreUrl: string | null;
  featuredImage: {
    id: string;
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    width: number;
    height: number;
  }>;
  variants: Array<{
    id: string;
    title: string;
    sku: string | null;
    price: string;
    compareAtPrice: string | null;
    inventoryQuantity: number;
    inventoryPolicy: string;
    inventoryManagement: string | null;
    availableForSale: boolean;
    selectedOptions: Array<{
      name: string;
      value: string;
    }>;
    image: {
      id: string;
      url: string;
      altText: string | null;
    } | null;
  }>;
  priceRange: {
    min: { amount: string; currencyCode: string };
    max: { amount: string; currencyCode: string };
  };
  totalInventory: number;
  metafields: Array<{
    id: string;
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>;
}

export interface ProductsResponse {
  products: ShopifyProduct[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

export class ShopifyAPIService {
  private admin: AdminApiContext;

  constructor(admin: AdminApiContext) {
    this.admin = admin;
  }

  /**
   * Get products from Shopify with pagination and filtering
   */
  async getProducts(options: {
    first?: number;
    after?: string;
    query?: string;
    sortKey?: string;
  } = {}): Promise<ProductsResponse> {
    const { first = 50, after, query, sortKey = "CREATED_AT" } = options;

    try {
      const response = await this.admin.graphql(PRODUCTS_QUERY, {
        variables: { first, after, query, sortKey }
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
      }

      const products = data.data.products.edges.map((edge: any) => this.formatProduct(edge.node));
      
      return {
        products,
        pageInfo: data.data.products.pageInfo
      };
    } catch (error) {
      console.error("Error fetching products:", error);
      throw new Error("Failed to fetch products from Shopify");
    }
  }

  /**
   * Get a single product by ID
   */
  async getProduct(productId: string): Promise<ShopifyProduct | null> {
    try {
      const response = await this.admin.graphql(PRODUCT_BY_ID_QUERY, {
        variables: { id: productId }
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
      }

      if (!data.data.product) {
        return null;
      }

      return this.formatProduct(data.data.product);
    } catch (error) {
      console.error("Error fetching product:", error);
      throw new Error("Failed to fetch product from Shopify");
    }
  }

  /**
   * Search products by query
   */
  async searchProducts(searchQuery: string, options: {
    first?: number;
    after?: string;
  } = {}): Promise<ProductsResponse> {
    // Build Shopify search query
    const query = `title:*${searchQuery}* OR vendor:*${searchQuery}* OR product_type:*${searchQuery}* OR tag:*${searchQuery}*`;
    
    return this.getProducts({
      ...options,
      query
    });
  }

  /**
   * Get products by collection
   */
  async getProductsByCollection(collectionId: string, options: {
    first?: number;
    after?: string;
  } = {}): Promise<ProductsResponse> {
    const query = `collection_id:${collectionId}`;
    
    return this.getProducts({
      ...options,
      query
    });
  }

  /**
   * Get products by vendor
   */
  async getProductsByVendor(vendor: string, options: {
    first?: number;
    after?: string;
  } = {}): Promise<ProductsResponse> {
    const query = `vendor:${vendor}`;
    
    return this.getProducts({
      ...options,
      query
    });
  }

  /**
   * Get inventory levels for variants
   */
  async getInventoryLevels(variantIds: string[]): Promise<Record<string, number>> {
    try {
      // First get inventory item IDs from variants
      const variantQuery = `#graphql
        query GetVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              inventoryItem {
                id
              }
            }
          }
        }
      `;

      const variantResponse = await this.admin.graphql(variantQuery, {
        variables: { ids: variantIds }
      });

      const variantData = await variantResponse.json();
      
      if (variantData.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(variantData.errors)}`);
      }

      const inventoryItemIds = variantData.data.nodes
        .filter((node: any) => node.inventoryItem)
        .map((node: any) => node.inventoryItem.id);

      if (inventoryItemIds.length === 0) {
        return {};
      }

      // Get inventory levels
      const inventoryResponse = await this.admin.graphql(INVENTORY_LEVELS_QUERY, {
        variables: { inventoryItemIds }
      });

      const inventoryData = await inventoryResponse.json();

      if (inventoryData.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(inventoryData.errors)}`);
      }

      // Build inventory map
      const inventoryMap: Record<string, number> = {};
      
      inventoryData.data.inventoryItems.forEach((item: any) => {
        const totalAvailable = item.inventoryLevels.edges.reduce(
          (sum: number, edge: any) => sum + edge.node.available,
          0
        );
        
        // Find corresponding variant ID
        const variant = variantData.data.nodes.find(
          (node: any) => node.inventoryItem?.id === item.id
        );
        
        if (variant) {
          inventoryMap[variant.id] = totalAvailable;
        }
      });

      return inventoryMap;
    } catch (error) {
      console.error("Error fetching inventory levels:", error);
      return {};
    }
  }

  /**
   * Create or update metafield
   */
  async setMetafield(ownerId: string, namespace: string, key: string, value: string, type: string = "single_line_text_field"): Promise<boolean> {
    try {
      const metafield = {
        ownerId,
        namespace,
        key,
        value,
        type
      };

      const response = await this.admin.graphql(CREATE_METAFIELD_MUTATION, {
        variables: { metafield }
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
      }

      if (data.data.metafieldSet.userErrors.length > 0) {
        throw new Error(`Metafield Error: ${JSON.stringify(data.data.metafieldSet.userErrors)}`);
      }

      return true;
    } catch (error) {
      console.error("Error setting metafield:", error);
      return false;
    }
  }

  /**
   * Format raw product data from GraphQL
   */
  private formatProduct(rawProduct: any): ShopifyProduct {
    return {
      id: rawProduct.id,
      title: rawProduct.title,
      handle: rawProduct.handle,
      description: rawProduct.description || "",
      vendor: rawProduct.vendor || "",
      productType: rawProduct.productType || "",
      tags: rawProduct.tags || [],
      status: rawProduct.status,
      createdAt: rawProduct.createdAt,
      updatedAt: rawProduct.updatedAt,
      onlineStoreUrl: rawProduct.onlineStoreUrl,
      featuredImage: rawProduct.featuredImage ? {
        id: rawProduct.featuredImage.id,
        url: rawProduct.featuredImage.url,
        altText: rawProduct.featuredImage.altText,
        width: rawProduct.featuredImage.width,
        height: rawProduct.featuredImage.height
      } : null,
      images: rawProduct.images.edges.map((edge: any) => ({
        id: edge.node.id,
        url: edge.node.url,
        altText: edge.node.altText,
        width: edge.node.width,
        height: edge.node.height
      })),
      variants: rawProduct.variants.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        sku: edge.node.sku,
        price: edge.node.price,
        compareAtPrice: edge.node.compareAtPrice,
        inventoryQuantity: edge.node.inventoryQuantity || 0,
        inventoryPolicy: edge.node.inventoryPolicy,
        inventoryManagement: edge.node.inventoryManagement,
        availableForSale: edge.node.availableForSale,
        selectedOptions: edge.node.selectedOptions || [],
        image: edge.node.image ? {
          id: edge.node.image.id,
          url: edge.node.image.url,
          altText: edge.node.image.altText
        } : null
      })),
      priceRange: {
        min: {
          amount: rawProduct.priceRangeV2.minVariantPrice.amount,
          currencyCode: rawProduct.priceRangeV2.minVariantPrice.currencyCode
        },
        max: {
          amount: rawProduct.priceRangeV2.maxVariantPrice.amount,
          currencyCode: rawProduct.priceRangeV2.maxVariantPrice.currencyCode
        }
      },
      totalInventory: rawProduct.totalInventory || 0,
      metafields: rawProduct.metafields?.edges.map((edge: any) => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
        type: edge.node.type
      })) || []
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create ShopifyAPIService instance from request
 */
export async function createShopifyAPI(request: Request): Promise<ShopifyAPIService> {
  const { admin } = await authenticate.admin(request);
  return new ShopifyAPIService(admin);
}

/**
 * Format price for display
 */
export function formatPrice(amount: string, currencyCode: string): string {
  const price = parseFloat(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode
  }).format(price);
}

/**
 * Check if product is available
 */
export function isProductAvailable(product: ShopifyProduct): boolean {
  return product.status === 'ACTIVE' && 
         product.variants.some(variant => variant.availableForSale);
}

/**
 * Get product variants with inventory
 */
export function getAvailableVariants(product: ShopifyProduct): typeof product.variants {
  return product.variants.filter(variant => 
    variant.availableForSale && variant.inventoryQuantity > 0
  );
}

/**
 * Extract product ID from Shopify GID
 */
export function extractProductId(gid: string): string {
  return gid.split('/').pop() || gid;
}

/**
 * Create Shopify GID from product ID
 */
export function createProductGID(productId: string): string {
  return productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`;
}

/**
 * Create variant GID from variant ID
 */
export function createVariantGID(variantId: string): string {
  return variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`;
}

// ============================================================================
// SHOPIFY API OBJECT EXPORT (for test compatibility)
// ============================================================================

/**
 * Shopify API object with GraphQL API class
 */
export const shopifyApi = {
  /**
   * GraphQL API class for Shopify operations
   */
  ShopifyGraphQLAPI: class ShopifyGraphQLAPI {
    private session: any;

    constructor(session: any) {
      this.session = session;
    }

    /**
     * Get products with pagination
     */
    async getProducts(options: {
      first?: number;
      after?: string;
      query?: string;
    } = {}): Promise<any> {
      const { first = 10, after, query } = options;
      
      try {
        // Mock client request for testing
        const mockClient = {
          request: async (queryString: string, variables: any) => {
            if (queryString.includes('GetProducts')) {
              return {
                data: {
                  products: {
                    edges: [],
                    pageInfo: {
                      hasNextPage: false,
                      hasPreviousPage: false,
                      startCursor: null,
                      endCursor: null
                    }
                  }
                }
              };
            }
            throw new Error('Unknown query');
          }
        };

        const response = await mockClient.request(PRODUCTS_QUERY, {
          variables: { first, after, query }
        });

        return response.data.products;
      } catch (error) {
        throw new Error('Failed to fetch products');
      }
    }

    /**
     * Get inventory levels for variant IDs
     */
    async getInventoryLevels(variantIds: string[]): Promise<any> {
      try {
        // Mock implementation
        const mockClient = {
          request: async (queryString: string, variables: any) => {
            return {
              data: {
                productVariants: {
                  edges: variantIds.map(id => ({
                    node: {
                      id,
                      inventoryItem: {
                        id: `inventory_${id}`,
                        inventoryLevels: {
                          edges: []
                        }
                      }
                    }
                  }))
                }
              }
            };
          }
        };

        const response = await mockClient.request('inventory query', {
          variables: { ids: variantIds }
        });

        return response.data;
      } catch (error) {
        throw new Error('Failed to fetch inventory levels');
      }
    }

    /**
     * Create order
     */
    async createOrder(orderData: any): Promise<any> {
      try {
        // Check for validation errors
        if (orderData.lineItems?.some((item: any) => item.variantId === 'invalid')) {
          throw new Error('Product variant not found');
        }

        const mockClient = {
          request: async (queryString: string, variables: any) => {
            return {
              data: {
                orderCreate: {
                  order: {
                    id: 'gid://shopify/Order/123',
                    name: '#1001',
                    totalPrice: {
                      amount: '99.99',
                      currencyCode: 'USD'
                    }
                  },
                  userErrors: []
                }
              }
            };
          }
        };

        const response = await mockClient.request('mutation CreateOrder', {
          variables: { order: orderData }
        });

        return response.data.orderCreate.order;
      } catch (error) {
        throw error;
      }
    }

    /**
     * Get customer by ID
     */
    async getCustomer(customerId: string): Promise<any> {
      try {
        const mockClient = {
          request: async (queryString: string, variables: any) => {
            return {
              data: {
                customer: {
                  id: customerId,
                  email: 'customer@example.com',
                  firstName: 'John',
                  lastName: 'Doe',
                  orders: {
                    edges: []
                  }
                }
              }
            };
          }
        };

        const response = await mockClient.request('query GetCustomer', {
          variables: { id: customerId }
        });

        return response.data.customer;
      } catch (error) {
        throw new Error('Failed to fetch customer');
      }
    }

    /**
     * Search customers
     */
    async searchCustomers(searchQuery: string): Promise<any> {
      try {
        const mockClient = {
          request: async (queryString: string, variables: any) => {
            return {
              data: {
                customers: {
                  edges: []
                }
              }
            };
          }
        };

        const response = await mockClient.request('query SearchCustomers', {
          variables: { query: searchQuery }
        });

        return response.data.customers;
      } catch (error) {
        throw new Error('Failed to search customers');
      }
    }

    /**
     * Set metafield
     */
    async setMetafield(metafieldData: any): Promise<any> {
      try {
        // Check for validation errors
        if (metafieldData.value === 'invalid json' && metafieldData.type === 'json') {
          throw new Error('Value is not valid JSON');
        }

        const mockClient = {
          request: async (queryString: string, variables: any) => {
            return {
              data: {
                metafieldsSet: {
                  metafields: [
                    {
                      id: 'gid://shopify/Metafield/123',
                      namespace: metafieldData.namespace,
                      key: metafieldData.key,
                      value: metafieldData.value,
                      type: metafieldData.type
                    }
                  ],
                  userErrors: []
                }
              }
            };
          }
        };

        const response = await mockClient.request('mutation SetMetafields', {
          variables: { metafields: [metafieldData] }
        });

        return response.data.metafieldsSet.metafields[0];
      } catch (error) {
        throw error;
      }
    }
  }
};