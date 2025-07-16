# WishCraft API Reference

This document provides comprehensive documentation for the WishCraft Shopify app API endpoints and GraphQL operations.

## Table of Contents

1. [Authentication](#authentication)
2. [GraphQL API](#graphql-api)
3. [REST Endpoints](#rest-endpoints)
4. [Webhooks](#webhooks)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

## Authentication

WishCraft uses Shopify's OAuth 2.0 authentication flow for secure access to shop data.

### OAuth Flow

1. **Authorization Request**
   ```
   GET https://admin.shopify.com/oauth/authorize?
     client_id={api_key}&
     scope={scopes}&
     redirect_uri={redirect_uri}&
     state={nonce}
   ```

2. **Token Exchange**
   ```
   POST https://admin.shopify.com/oauth/access_token
   Content-Type: application/json
   
   {
     "client_id": "your_api_key",
     "client_secret": "your_api_secret",
     "code": "authorization_code"
   }
   ```

### Required Scopes

```javascript
const REQUIRED_SCOPES = [
  'read_customers',
  'write_customers',
  'read_products', 
  'read_orders',
  'write_orders',
  'read_inventory',
  'write_content'
];
```

## GraphQL API

WishCraft uses Shopify's GraphQL Admin API (version 2025-07) for all data operations.

### Base URL
```
https://{shop}.myshopify.com/admin/api/2025-07/graphql.json
```

### Headers
```
X-Shopify-Access-Token: {access_token}
Content-Type: application/json
```

### Core Operations

#### 1. Registry Management

**Create Registry**
```graphql
mutation CreateRegistry($input: MetafieldsSetInput!) {
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
```

Variables:
```json
{
  "input": {
    "namespace": "wishcraft",
    "key": "registry_data",
    "value": "{\"title\":\"Wedding Registry\",\"eventDate\":\"2025-06-15\"}",
    "type": "json",
    "ownerId": "gid://shopify/Customer/123456789"
  }
}
```

**Get Registry**
```graphql
query GetRegistry($customerId: ID!) {
  customer(id: $customerId) {
    id
    email
    firstName
    lastName
    metafields(namespace: "wishcraft", first: 10) {
      edges {
        node {
          id
          key
          value
          type
        }
      }
    }
  }
}
```

#### 2. Product Operations

**Get Products with Variants**
```graphql
query GetProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    edges {
      node {
        id
        title
        handle
        description
        featuredImage {
          url
          altText
        }
        variants(first: 100) {
          edges {
            node {
              id
              title
              price
              availableForSale
              inventoryQuantity
            }
          }
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

#### 3. Order Operations

**Get Order Details**
```graphql
query GetOrder($id: ID!) {
  order(id: $id) {
    id
    name
    email
    createdAt
    totalPrice
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
}
```

## REST Endpoints

While GraphQL is preferred, some REST endpoints are available for specific operations.

### Health Checks

**Application Health**
```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": true,
    "shopify_api": true,
    "redis": true
  },
  "version": "1.0.0"
}
```

**Performance Health**
```
GET /health/performance
```

Response:
```json
{
  "status": "healthy",
  "core_web_vitals": {
    "lcp": 2200,
    "inp": 150,
    "cls": 0.08
  },
  "bundle_sizes": {
    "javascript": 15360,
    "css": 49152
  }
}
```

### Registry Operations

**Get Registry by Slug**
```
GET /api/registries/{slug}
```

Response:
```json
{
  "id": "registry_123",
  "title": "Wedding Registry",
  "description": "Our wedding gift registry",
  "eventDate": "2025-06-15",
  "eventType": "wedding",
  "visibility": "public",
  "items": [
    {
      "id": "item_456",
      "productId": "gid://shopify/Product/789",
      "quantity": 2,
      "quantityPurchased": 1,
      "price": 29.99
    }
  ]
}
```

## Webhooks

WishCraft implements mandatory Shopify webhooks for GDPR compliance and real-time data synchronization.

### Webhook Endpoints

#### Customer Data Webhooks

**Customer Created**
```
POST /webhooks/customers/create
```

**Customer Data Request**
```
POST /webhooks/customers/data_request
```

**Customer Redact**
```
POST /webhooks/customers/redact
```

#### Shop Data Webhook

**Shop Redact**
```
POST /webhooks/shop/redact
```

### Webhook Verification

All webhooks include HMAC verification:

```javascript
const crypto = require('crypto');

function verifyWebhookHMAC(payload, signature, secret) {
  const computedHmac = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(computedHmac, 'base64')
  );
}
```

## Error Handling

### GraphQL Errors

GraphQL responses may contain errors in the `errors` array:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Product not found",
      "locations": [{"line": 2, "column": 3}],
      "path": ["product"],
      "extensions": {
        "code": "NOT_FOUND",
        "exception": {
          "stacktrace": ["Error: Product not found..."]
        }
      }
    }
  ]
}
```

### REST Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid registry data",
    "details": {
      "field": "eventDate",
      "reason": "Date must be in the future"
    }
  },
  "timestamp": "2025-01-15T10:30:00Z",
  "path": "/api/registries"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTHENTICATION_ERROR` | Invalid or expired access token | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `VALIDATION_ERROR` | Invalid request data | 400 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

## Rate Limiting

WishCraft implements multi-tier rate limiting:

### GraphQL API Limits
- **Cost-based limiting**: Maximum 1000 points per minute
- **Query complexity**: Maximum depth of 10 levels
- **Batch operations**: Maximum 100 operations per request

### REST API Limits
- **General endpoints**: 200 requests per minute
- **Authentication endpoints**: 50 requests per minute
- **Webhook endpoints**: 1000 requests per minute

### Rate Limit Headers

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1642234800
Retry-After: 60
```

### Handling Rate Limits

Implement exponential backoff when receiving 429 responses:

```javascript
async function makeRequestWithRetry(request, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(request);
    
    if (response.status !== 429) {
      return response;
    }
    
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    const backoffDelay = Math.min(1000 * Math.pow(2, attempt), retryAfter * 1000);
    
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
  }
  
  throw new Error('Max retries exceeded');
}
```

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
import { WishCraftClient } from '@wishcraft/sdk';

const client = new WishCraftClient({
  shop: 'your-shop',
  accessToken: 'your-access-token',
  apiVersion: '2025-07'
});

// Create a registry
const registry = await client.registries.create({
  title: 'Wedding Registry',
  eventDate: '2025-06-15',
  eventType: 'wedding',
  visibility: 'public'
});

// Add items to registry
await client.registries.addItem(registry.id, {
  productId: 'gid://shopify/Product/123',
  quantity: 2,
  priority: 'high'
});

// Get registry items
const items = await client.registries.getItems(registry.id);
```

### React Hooks

```typescript
import { useRegistry, useRegistryItems } from '@wishcraft/react-hooks';

function RegistryComponent({ registryId }: { registryId: string }) {
  const { registry, loading, error } = useRegistry(registryId);
  const { items, addItem, removeItem } = useRegistryItems(registryId);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h1>{registry.title}</h1>
      {items.map(item => (
        <div key={item.id}>
          {item.title} - ${item.price}
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

## Testing

### GraphQL Testing

Use Shopify's GraphQL Explorer for testing queries:
```
https://your-shop.myshopify.com/admin/api/graphql/explorer
```

### Webhook Testing

Use ngrok to test webhooks locally:
```bash
ngrok http 3000
# Update webhook URL to https://abc123.ngrok.io/webhooks/customers/create
```

## Support

- **API Issues**: [GitHub Issues](https://github.com/wishcraft-team/wishcraft/issues)
- **Shopify Documentation**: [shopify.dev](https://shopify.dev)
- **GraphQL Schema**: [Shopify GraphQL Reference](https://shopify.dev/api/admin-graphql)

---

*Last updated: January 15, 2025*