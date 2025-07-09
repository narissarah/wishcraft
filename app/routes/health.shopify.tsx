// Shopify API health check endpoint - GraphQL compliant for 2025 standards
import { json, type LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const start = Date.now();
  
  try {
    // Test Shopify GraphQL API connectivity (REST API sunset April 1, 2025)
    const shopifyGraphQLUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN || 'test-shop'}.myshopify.com/admin/api/2025-07/graphql.json`;
    
    // Use a minimal GraphQL query to check API accessibility
    const healthCheckQuery = {
      query: `
        query HealthCheck {
          shop {
            id
            name
          }
        }
      `
    };
    
    const response = await fetch(shopifyGraphQLUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || 'test',
      },
      body: JSON.stringify(healthCheckQuery),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const responseTime = Date.now() - start;
    
    // Check if response is successful or expected auth failure
    const isHealthy = response.status === 200 || response.status === 401 || response.status === 403;
    const apiVersion = '2025-07';
    let rateLimitStatus = null;
    
    // Extract rate limit headers
    if (response.headers.get('X-Shopify-Shop-Api-Call-Limit')) {
      rateLimitStatus = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
    }
    
    const health = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'shopify-graphql-api',
      timestamp: new Date().toISOString(),
      responseTime,
      details: {
        apiVersion,
        endpoint: 'GraphQL Admin API',
        statusCode: response.status,
        accessible: isHealthy,
        rateLimitStatus,
        compliance: {
          graphqlMandatory: true,
          restApiSunset: '2025-04-01',
          apiVersionSupported: apiVersion >= '2025-01'
        }
      }
    };

    return json(health, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - start;
    
    return json(
      {
        status: 'unhealthy',
        service: 'shopify-graphql-api',
        timestamp: new Date().toISOString(),
        responseTime,
        error: error instanceof Error ? error.message : 'Shopify GraphQL API connection failed',
        details: {
          compliance: {
            graphqlMandatory: true,
            restApiSunset: '2025-04-01'
          }
        }
      },
      { status: 503 }
    );
  }
}