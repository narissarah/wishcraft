import { shopify } from "~/shopify.server";
import { log } from "~/lib/logger.server";
import { cache } from './cache-unified.server';
import { GraphQLCache } from './graphql-optimizations.server';

/**
 * GraphQL Client for Shopify 2025 Compliance
 * All API calls must use GraphQL starting April 2025
 */

// GraphQL query fragments for reusability
export const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    title
    handle
    description
    featuredImage {
      url
      altText
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          price
          compareAtPrice
          availableForSale
          inventoryQuantity
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
`;

export const CUSTOMER_FRAGMENT = `
  fragment CustomerFields on Customer {
    id
    email
    firstName
    lastName
    displayName
    acceptsMarketing
    createdAt
    updatedAt
    metafields(first: 10, namespace: "wishcraft") {
      edges {
        node {
          namespace
          key
          value
          type
        }
      }
    }
  }
`;

export const ORDER_FRAGMENT = `
  fragment OrderFields on Order {
    id
    name
    email
    createdAt
    displayFinancialStatus
    displayFulfillmentStatus
    totalPrice {
      amount
      currencyCode
    }
    lineItems(first: 250) {
      edges {
        node {
          id
          title
          quantity
          variant {
            id
            title
            price
          }
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
`;

/**
 * Execute a GraphQL query with proper error handling
 */
export async function graphqlQuery<T = any>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  try {
    // Try cache first for read queries
    const isReadQuery = query.trim().toLowerCase().startsWith('query');
    if (isReadQuery) {
      const cached = await GraphQLCache.get(shop, query, variables);
      if (cached) {
        log.debug('GraphQL cache hit', { shop, query: query.substring(0, 50) });
        return cached as T;
      }
    }
    
    // Note: Using direct GraphQL client instead of shopify.api.clients.Graphql
    // which may not be available in current Shopify App Remix version
    // FIXED: Explicit 2024-10 API version for Built for Shopify compliance
    const apiVersion = '2024-10'; // MANDATORY 2025 API version
    const response = await fetch(`https://${shop}.myshopify.com/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      const errors = result.errors.map((e: any) => e.message).join(", ");
      throw new Error(`GraphQL errors: ${errors}`);
    }

    // Cache successful read queries
    if (isReadQuery) {
      await GraphQLCache.set(shop, query, variables || {}, result.data);
      log.debug('GraphQL response cached', { shop, query: query.substring(0, 50) });
    }
    
    return result.data as T;
  } catch (error) {
    log.error("GraphQL query failed", {
      shop,
      query: query.substring(0, 100) + "...",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Product-related GraphQL queries
 */
export const ProductQueries = {
  getProduct: (productId: string) => `
    query GetProduct($id: ID!) {
      product(id: $id) {
        ...ProductFields
      }
    }
    ${PRODUCT_FRAGMENT}
  `,

  getProducts: (first = 50) => `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node {
            ...ProductFields
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    ${PRODUCT_FRAGMENT}
  `,

  searchProducts: () => `
    query SearchProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            ...ProductFields
          }
        }
      }
    }
    ${PRODUCT_FRAGMENT}
  `
};

/**
 * Customer-related GraphQL queries
 */
export const CustomerQueries = {
  getCustomer: () => `
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        ...CustomerFields
      }
    }
    ${CUSTOMER_FRAGMENT}
  `,

  searchCustomers: () => `
    query SearchCustomers($query: String!, $first: Int!) {
      customers(first: $first, query: $query) {
        edges {
          node {
            ...CustomerFields
          }
        }
      }
    }
    ${CUSTOMER_FRAGMENT}
  `
};

/**
 * Order-related GraphQL queries
 */
export const OrderQueries = {
  getOrder: () => `
    query GetOrder($id: ID!) {
      order(id: $id) {
        ...OrderFields
      }
    }
    ${ORDER_FRAGMENT}
  `,

  getOrders: () => `
    query GetOrders($first: Int!, $query: String) {
      orders(first: $first, query: $query) {
        edges {
          node {
            ...OrderFields
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    ${ORDER_FRAGMENT}
  `
};

/**
 * Metafield mutations for registry data
 */
export const MetafieldMutations = {
  createMetafield: () => `
    mutation CreateMetafield($input: MetafieldsSetInput!) {
      metafieldsSet(metafields: [$input]) {
        metafields {
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
  `,

  updateMetafield: () => `
    mutation UpdateMetafield($input: MetafieldsSetInput!) {
      metafieldsSet(metafields: [$input]) {
        metafields {
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
  `,

  deleteMetafield: () => `
    mutation DeleteMetafield($input: MetafieldDeleteInput!) {
      metafieldDelete(input: $input) {
        deletedId
        userErrors {
          field
          message
        }
      }
    }
  `
};

/**
 * Inventory tracking queries
 */
export const InventoryQueries = {
  getInventoryItem: () => `
    query GetInventoryItem($id: ID!) {
      inventoryItem(id: $id) {
        id
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
  `,

  adjustInventory: () => `
    mutation AdjustInventory($input: InventoryAdjustQuantityInput!) {
      inventoryAdjustQuantity(input: $input) {
        inventoryLevel {
          id
          available
        }
        userErrors {
          field
          message
        }
      }
    }
  `
};

/**
 * Webhook subscription queries
 */
export const WebhookQueries = {
  createWebhook: () => `
    mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
          topic
          callbackUrl
          format
        }
        userErrors {
          field
          message
        }
      }
    }
  `,

  listWebhooks: () => `
    query ListWebhooks($first: Int!) {
      webhookSubscriptions(first: $first) {
        edges {
          node {
            id
            topic
            callbackUrl
            format
            createdAt
            updatedAt
          }
        }
      }
    }
  `
};

/**
 * Helper function to handle paginated queries
 */
export async function* paginatedGraphQLQuery<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, any> = {},
  extractData: (data: any) => { edges: any[], pageInfo: { hasNextPage: boolean, endCursor: string } }
): AsyncGenerator<T, void, undefined> {
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const result = await graphqlQuery(shop, accessToken, query, {
      ...variables,
      after: cursor
    });

    const { edges, pageInfo } = extractData(result);
    
    for (const edge of edges) {
      yield edge.node as T;
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
}

/**
 * Batch GraphQL operations for efficiency
 */
export async function batchGraphQLQuery(
  shop: string,
  accessToken: string,
  queries: Array<{ query: string, variables?: Record<string, any> }>
): Promise<any[]> {
  const batchQuery = queries.map((q, i) => 
    `query${i}: ${q.query.replace(/^query\s+\w+/, '')}`
  ).join("\n");

  const wrappedQuery = `query BatchQuery { ${batchQuery} }`;
  
  const result = await graphqlQuery(shop, accessToken, wrappedQuery, {});
  
  return queries.map((_, i) => result[`query${i}`]);
}