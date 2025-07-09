import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, BlockStack, Text, Link, Badge, InlineStack } from "@shopify/polaris";
import { useState, useEffect } from "react";

/**
 * Interactive API Documentation with Swagger UI
 * Built for Shopify 2025 compliance with comprehensive examples
 */

interface LoaderData {
  apiSpec: any;
  examples: Record<string, any>;
  sdkInfo: {
    languages: string[];
    downloadLinks: Record<string, string>;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Load OpenAPI specification (placeholder for build compatibility)
  const apiSpec = {
    openapi: "3.0.0",
    info: {
      title: "WishCraft API",
      version: "1.0.0",
      description: "Gift Registry API for Shopify"
    },
    paths: {}
  };

  // Code examples for different languages
  const examples = {
    javascript: {
      authentication: `
// OAuth 2.0 Authentication
const shopifyAuth = new ShopifyAuth({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  scopes: ['read_registries', 'write_registries'],
  redirectUri: 'https://yourapp.com/auth/callback'
});

// Get access token
const accessToken = await shopifyAuth.getAccessToken(code);
      `,
      graphql: `
// GraphQL Query Example
const query = \`
  query GetRegistry($id: ID!) {
    registry(id: $id) {
      id
      title
      description
      items {
        id
        title
        price
        status
      }
    }
  }
\`;

const response = await fetch('/api/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${accessToken}\`
  },
  body: JSON.stringify({
    query,
    variables: { id: 'gid://shopify/Registry/123' }
  })
});
      `,
      webhook: `
// Webhook Verification
const crypto = require('crypto');

function verifyWebhook(data, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data, 'utf8');
  const hash = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

// GDPR Webhook Handler
app.post('/webhooks/gdpr/customers/data_request', (req, res) => {
  const signature = req.get('X-Shopify-Hmac-Sha256');
  const data = JSON.stringify(req.body);
  
  if (!verifyWebhook(data, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Unauthorized');
  }
  
  // Process data request
  processGDPRDataRequest(req.body);
  res.status(200).send('OK');
});
      `
    },
    python: {
      authentication: `
# Python SDK Example
import shopify
from shopify import Session

# Configure API
shopify.ShopifyResource.set_site('https://yourshop.myshopify.com/admin')
shopify.ShopifyResource.set_headers({'X-Shopify-Access-Token': access_token})

# Create session
session = Session('yourshop.myshopify.com', '2025-07', access_token)
shopify.ShopifyResource.activate_session(session)
      `,
      graphql: `
# GraphQL with Python
import requests

def query_registry(registry_id, access_token, shop_domain):
    query = '''
    query GetRegistry($id: ID!) {
      registry(id: $id) {
        id
        title
        description
        items {
          id
          title
          price
          status
        }
      }
    }
    '''
    
    response = requests.post(
        f'https://{shop_domain}/admin/api/2025-07/graphql.json',
        headers={
            'X-Shopify-Access-Token': access_token,
            'Content-Type': 'application/json'
        },
        json={
            'query': query,
            'variables': {'id': registry_id}
        }
    )
    
    return response.json()
      `
    },
    curl: {
      authentication: `
# OAuth Token Exchange
curl -X POST https://yourshop.myshopify.com/admin/oauth/access_token \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "your_client_id",
    "client_secret": "your_client_secret",
    "code": "authorization_code"
  }'
      `,
      graphql: `
# GraphQL Query via cURL
curl -X POST https://yourshop.myshopify.com/admin/api/2025-07/graphql.json \\
  -H "X-Shopify-Access-Token: your_access_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "query GetRegistry($id: ID!) { registry(id: $id) { id title description items { id title price status } } }",
    "variables": {
      "id": "gid://shopify/Registry/123"
    }
  }'
      `,
      webhook: `
# Test Webhook Endpoint
curl -X POST https://yourapp.com/webhooks/gdpr/customers/data_request \\
  -H "X-Shopify-Hmac-Sha256: webhook_signature" \\
  -H "X-Shopify-Topic: customers/data_request" \\
  -H "X-Shopify-Shop-Domain: yourshop.myshopify.com" \\
  -H "Content-Type: application/json" \\
  -d '{
    "shop_id": 12345,
    "shop_domain": "yourshop.myshopify.com",
    "customer": {
      "id": 67890,
      "email": "customer@example.com"
    }
  }'
      `
    }
  };

  const sdkInfo = {
    languages: ['JavaScript', 'Python', 'PHP', 'Ruby', 'Go', 'Java'],
    downloadLinks: {
      javascript: '/sdk/wishcraft-js-sdk.zip',
      python: '/sdk/wishcraft-python-sdk.zip',
      php: '/sdk/wishcraft-php-sdk.zip',
      ruby: '/sdk/wishcraft-ruby-sdk.zip',
      go: '/sdk/wishcraft-go-sdk.zip',
      java: '/sdk/wishcraft-java-sdk.zip'
    }
  };

  return json({ apiSpec, examples, sdkInfo });
}

export default function APIDocs() {
  const { apiSpec, examples, sdkInfo } = useLoaderData<LoaderData>();
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [selectedExample, setSelectedExample] = useState('authentication');

  // Load Swagger UI dynamically
  useEffect(() => {
    // Load Swagger UI CSS
    const swaggerCSS = document.createElement('link');
    swaggerCSS.rel = 'stylesheet';
    swaggerCSS.href = 'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css';
    document.head.appendChild(swaggerCSS);

    // Load Swagger UI JS
    const swaggerJS = document.createElement('script');
    swaggerJS.src = 'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js';
    swaggerJS.onload = () => {
      // Initialize Swagger UI
      (window as any).SwaggerUIBundle({
        url: '/docs/api/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          (window as any).SwaggerUIBundle.presets.apis,
          (window as any).SwaggerUIBundle.presets.standalone
        ],
        plugins: [
          (window as any).SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        requestInterceptor: (req: any) => {
          // Add authentication headers
          req.headers['Authorization'] = 'Bearer your_access_token';
          return req;
        },
        responseInterceptor: (res: any) => {
          // Log responses for debugging
          console.log('API Response:', res);
          return res;
        }
      });
    };
    document.head.appendChild(swaggerJS);

    return () => {
      document.head.removeChild(swaggerCSS);
      document.head.removeChild(swaggerJS);
    };
  }, []);

  return (
    <Page
      title="WishCraft API Documentation"
      subtitle="Comprehensive documentation for the WishCraft Shopify app API"
      compactTitle
    >
      <BlockStack gap="400">
        {/* Overview Section */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              API Overview
            </Text>
            <Text variant="bodyMd">
              WishCraft provides a comprehensive GraphQL API that seamlessly integrates with 
              Shopify's 2025-07 Admin API. Our API is designed for modern applications with 
              built-in security, performance optimization, and GDPR compliance.
            </Text>
            <InlineStack gap="200">
              <Badge tone="success">GraphQL 2025-07</Badge>
              <Badge tone="info">OAuth 2.0 + PKCE</Badge>
              <Badge tone="critical">GDPR Compliant</Badge>
              <Badge tone="warning">Rate Limited</Badge>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Quick Start Guide */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              Quick Start Guide
            </Text>
            
            <Text variant="headingMd" as="h3">
              1. Authentication
            </Text>
            <Text variant="bodyMd">
              WishCraft uses OAuth 2.0 with PKCE for secure authentication. Follow these steps:
            </Text>
            <ol>
              <li>Register your app in the Shopify Partner Dashboard</li>
              <li>Configure OAuth redirect URIs</li>
              <li>Implement the OAuth flow with PKCE</li>
              <li>Exchange authorization code for access token</li>
            </ol>

            <Text variant="headingMd" as="h3">
              2. Making API Calls
            </Text>
            <Text variant="bodyMd">
              All API calls use GraphQL over HTTPS. Include your access token in the Authorization header:
            </Text>
            <pre style={{ 
              background: '#f6f6f7', 
              padding: '1rem', 
              borderRadius: '4px', 
              overflow: 'auto' 
            }}>
              <code>
                Authorization: Bearer your_access_token{'\n'}
                Content-Type: application/json
              </code>
            </pre>

            <Text variant="headingMd" as="h3">
              3. Rate Limiting
            </Text>
            <Text variant="bodyMd">
              Our API implements intelligent rate limiting:
            </Text>
            <ul>
              <li><strong>GraphQL:</strong> 1000 points per minute (cost-based)</li>
              <li><strong>REST:</strong> 40 requests per app per store per minute</li>
              <li><strong>Webhooks:</strong> Unlimited (with signature verification)</li>
            </ul>
          </BlockStack>
        </Card>

        {/* Interactive Examples */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              Code Examples
            </Text>
            
            {/* Language Selector */}
            <InlineStack gap="200">
              {Object.keys(examples).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  style={{
                    padding: '8px 16px',
                    border: selectedLanguage === lang ? '2px solid #008060' : '1px solid #c9cccf',
                    background: selectedLanguage === lang ? '#f0f8f5' : 'white',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {lang}
                </button>
              ))}
            </InlineStack>

            {/* Example Type Selector */}
            <InlineStack gap="200">
              {Object.keys(examples[selectedLanguage] || {}).map((example) => (
                <button
                  key={example}
                  onClick={() => setSelectedExample(example)}
                  style={{
                    padding: '6px 12px',
                    border: selectedExample === example ? '1px solid #008060' : '1px solid #e1e3e5',
                    background: selectedExample === example ? '#f0f8f5' : 'white',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {example}
                </button>
              ))}
            </InlineStack>

            {/* Code Display */}
            <div style={{ 
              background: '#1e1e1e', 
              color: '#f8f8f2', 
              padding: '1rem', 
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '0.875rem',
              lineHeight: '1.5'
            }}>
              <pre>
                <code>
                  {examples[selectedLanguage]?.[selectedExample] || 'Example not available'}
                </code>
              </pre>
            </div>
          </BlockStack>
        </Card>

        {/* SDK Downloads */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              Official SDKs
            </Text>
            <Text variant="bodyMd">
              Download our official SDKs for faster integration:
            </Text>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem' 
            }}>
              {sdkInfo.languages.map((lang) => (
                <div
                  key={lang}
                  style={{
                    border: '1px solid #e1e3e5',
                    borderRadius: '6px',
                    padding: '1rem',
                    textAlign: 'center'
                  }}
                >
                  <Text variant="bodyMd" as="p" fontWeight="semibold">
                    {lang}
                  </Text>
                  <Link 
                    url={sdkInfo.downloadLinks[lang.toLowerCase()]}
                    download
                  >
                    Download SDK
                  </Link>
                </div>
              ))}
            </div>
          </BlockStack>
        </Card>

        {/* Interactive API Explorer */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              Interactive API Explorer
            </Text>
            <Text variant="bodyMd">
              Test our API endpoints directly in your browser with Swagger UI:
            </Text>
            
            {/* Swagger UI Container */}
            <div 
              id="swagger-ui" 
              style={{ 
                minHeight: '600px',
                border: '1px solid #e1e3e5',
                borderRadius: '6px'
              }}
            >
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center', 
                color: '#6d7175' 
              }}>
                Loading interactive API documentation...
              </div>
            </div>
          </BlockStack>
        </Card>

        {/* GraphQL Schema Browser */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              GraphQL Schema
            </Text>
            <Text variant="bodyMd">
              Explore our complete GraphQL schema with types, queries, and mutations:
            </Text>
            
            <div style={{
              background: '#f6f6f7',
              padding: '1rem',
              borderRadius: '6px',
              fontFamily: 'Monaco, Consolas, monospace',
              fontSize: '0.875rem',
              overflow: 'auto'
            }}>
              <pre>{`
type Registry {
  id: ID!
  title: String!
  description: String
  slug: String!
  eventType: EventType!
  eventDate: DateTime
  privacy: RegistryPrivacy!
  status: RegistryStatus!
  items: [RegistryItem!]!
  totalValue: Money!
  completionRate: Float!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type RegistryItem {
  id: ID!
  title: String!
  description: String
  price: Money!
  quantity: Int!
  quantityPurchased: Int!
  priority: ItemPriority!
  status: ItemStatus!
  product: ShopifyProduct!
  variant: ShopifyProductVariant
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Query {
  registry(id: ID!): Registry
  registries(
    first: Int
    after: String
    filter: RegistryFilter
    sortKey: RegistrySortKeys
  ): RegistryConnection!
}

type Mutation {
  registryCreate(input: RegistryCreateInput!): RegistryCreatePayload!
  registryUpdate(id: ID!, input: RegistryUpdateInput!): RegistryUpdatePayload!
  registryItemAdd(registryId: ID!, input: RegistryItemAddInput!): RegistryItemAddPayload!
}
              `}</pre>
            </div>
            
            <Link url="/graphql" external>
              Open GraphQL Playground →
            </Link>
          </BlockStack>
        </Card>

        {/* Webhook Documentation */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              Webhook Events
            </Text>
            <Text variant="bodyMd">
              WishCraft sends webhooks for important events. All webhooks include HMAC signatures for security:
            </Text>
            
            <div style={{ 
              display: 'grid', 
              gap: '1rem',
              gridTemplateColumns: '1fr 1fr'
            }}>
              <div>
                <Text variant="bodyMd" fontWeight="semibold">Registry Events</Text>
                <ul>
                  <li>registry/created</li>
                  <li>registry/updated</li>
                  <li>registry/item_added</li>
                  <li>registry/item_purchased</li>
                </ul>
              </div>
              <div>
                <Text variant="bodyMd" fontWeight="semibold">GDPR Events</Text>
                <ul>
                  <li>customers/data_request</li>
                  <li>customers/redact</li>
                  <li>shop/redact</li>
                </ul>
              </div>
            </div>
          </BlockStack>
        </Card>

        {/* Support Section */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              Support & Resources
            </Text>
            <div style={{ 
              display: 'grid', 
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'
            }}>
              <div>
                <Text variant="bodyMd" fontWeight="semibold">Developer Support</Text>
                <Text variant="bodyMd">
                  Email: <Link url="mailto:dev-support@wishcraft.app">dev-support@wishcraft.app</Link>
                </Text>
                <Text variant="bodyMd">
                  Discord: <Link url="https://discord.gg/wishcraft" external>Join our community</Link>
                </Text>
              </div>
              <div>
                <Text variant="bodyMd" fontWeight="semibold">Additional Resources</Text>
                <Text variant="bodyMd">
                  <Link url="/docs/tutorials" external>Integration Tutorials</Link>
                </Text>
                <Text variant="bodyMd">
                  <Link url="/docs/changelog" external>API Changelog</Link>
                </Text>
                <Text variant="bodyMd">
                  <Link url="https://github.com/wishcraft/examples" external>Code Examples</Link>
                </Text>
              </div>
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}