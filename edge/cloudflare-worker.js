/**
 * Cloudflare Worker for WishCraft Edge Computing
 * Provides edge caching, request routing, and security filtering
 */

// Environment variables (set in Cloudflare dashboard)
// SHOPIFY_APP_URL - Main app URL
// REDIS_URL - Redis connection for edge cache
// ALLOWED_ORIGINS - Comma-separated list of allowed origins

// Edge cache configuration
const CACHE_CONFIG = {
  // Static assets cache for 1 day
  STATIC_ASSETS: 86400,
  // API responses cache for 5 minutes
  API_RESPONSES: 300,
  // GraphQL cache for 1 minute
  GRAPHQL: 60,
  // Registry data cache for 10 minutes
  REGISTRY_DATA: 600
};

// Security headers for edge responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle different types of requests
  try {
    // Static assets
    if (isStaticAsset(path)) {
      return handleStaticAsset(request);
    }

    // API requests
    if (path.startsWith('/api/')) {
      return handleAPIRequest(request);
    }

    // GraphQL requests
    if (path.includes('/graphql')) {
      return handleGraphQLRequest(request);
    }

    // Registry data requests
    if (path.startsWith('/registry/')) {
      return handleRegistryRequest(request);
    }

    // Security checks
    if (!isSecureRequest(request)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Forward to origin server
    return forwardToOrigin(request);

  } catch (error) {
    console.error('Edge worker error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Check if request is for a static asset
 */
function isStaticAsset(path) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => path.endsWith(ext));
}

/**
 * Handle static asset requests with aggressive caching
 */
async function handleStaticAsset(request) {
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;

  // Try to get from cache first
  let response = await cache.match(cacheKey);

  if (!response) {
    // Fetch from origin
    response = await fetch(request);
    
    if (response.status === 200) {
      // Clone response for caching
      const responseToCache = response.clone();
      
      // Add cache headers
      const headers = new Headers(responseToCache.headers);
      headers.set('Cache-Control', `public, max-age=${CACHE_CONFIG.STATIC_ASSETS}`);
      headers.set('Edge-Cache', 'MISS');
      
      // Add security headers
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        headers.set(key, value);
      });

      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });

      // Cache the response
      event.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
      
      return cachedResponse;
    }
  } else {
    // Add cache hit header
    const headers = new Headers(response.headers);
    headers.set('Edge-Cache', 'HIT');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
}

/**
 * Handle API requests with selective caching
 */
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const method = request.method;

  // Only cache GET requests
  if (method !== 'GET') {
    return forwardToOrigin(request);
  }

  // Check if this endpoint should be cached
  const shouldCache = isCacheableAPI(url.pathname);
  
  if (!shouldCache) {
    return forwardToOrigin(request);
  }

  const cacheKey = new Request(request.url, {
    method: 'GET',
    headers: request.headers
  });

  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (!response) {
    response = await fetch(request);
    
    if (response.status === 200) {
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('Cache-Control', `public, max-age=${CACHE_CONFIG.API_RESPONSES}`);
      headers.set('Edge-Cache', 'MISS');

      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });

      event.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
      return cachedResponse;
    }
  } else {
    const headers = new Headers(response.headers);
    headers.set('Edge-Cache', 'HIT');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
}

/**
 * Handle GraphQL requests with smart caching
 */
async function handleGraphQLRequest(request) {
  const method = request.method;

  // Only cache GET requests (query operations)
  if (method !== 'GET') {
    return forwardToOrigin(request);
  }

  try {
    const requestBody = await request.text();
    const graphqlQuery = JSON.parse(requestBody);

    // Only cache queries (not mutations)
    if (graphqlQuery.query && !graphqlQuery.query.includes('mutation')) {
      const cacheKey = generateGraphQLCacheKey(request.url, graphqlQuery);
      const cache = caches.default;
      
      let response = await cache.match(cacheKey);

      if (!response) {
        // Forward to origin
        const newRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(graphqlQuery)
        });

        response = await fetch(newRequest);
        
        if (response.status === 200) {
          const responseToCache = response.clone();
          const headers = new Headers(responseToCache.headers);
          headers.set('Cache-Control', `public, max-age=${CACHE_CONFIG.GRAPHQL}`);
          headers.set('Edge-Cache', 'MISS');

          const cachedResponse = new Response(responseToCache.body, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers
          });

          event.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
          return cachedResponse;
        }
      } else {
        const headers = new Headers(response.headers);
        headers.set('Edge-Cache', 'HIT');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }
    }
  } catch (error) {
    console.error('GraphQL caching error:', error);
  }

  return forwardToOrigin(request);
}

/**
 * Handle registry-specific requests
 */
async function handleRegistryRequest(request) {
  const url = new URL(request.url);
  const registryId = url.pathname.split('/')[2];

  // Check if registry is public and cacheable
  if (request.method === 'GET' && registryId) {
    const cacheKey = new Request(request.url, request);
    const cache = caches.default;

    let response = await cache.match(cacheKey);

    if (!response) {
      response = await fetch(request);
      
      if (response.status === 200) {
        const responseToCache = response.clone();
        const headers = new Headers(responseToCache.headers);
        headers.set('Cache-Control', `public, max-age=${CACHE_CONFIG.REGISTRY_DATA}`);
        headers.set('Edge-Cache', 'MISS');

        const cachedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers
        });

        event.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
        return cachedResponse;
      }
    } else {
      const headers = new Headers(response.headers);
      headers.set('Edge-Cache', 'HIT');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return response;
  }

  return forwardToOrigin(request);
}

/**
 * Security validation for requests
 */
function isSecureRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Check allowed origins
  if (origin) {
    const allowedOrigins = (ALLOWED_ORIGINS || '').split(',');
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return false;
    }
  }

  // Basic bot detection
  const userAgent = request.headers.get('user-agent') || '';
  const suspiciousBots = ['curl', 'wget', 'python-requests', 'scrapy'];
  if (suspiciousBots.some(bot => userAgent.toLowerCase().includes(bot))) {
    return false;
  }

  // Rate limiting would go here (using KV store)
  
  return true;
}

/**
 * Check if API endpoint should be cached
 */
function isCacheableAPI(pathname) {
  const cacheableEndpoints = [
    '/api/products',
    '/api/collections',
    '/api/shop-info',
    '/api/health'
  ];

  return cacheableEndpoints.some(endpoint => pathname.startsWith(endpoint));
}

/**
 * Generate cache key for GraphQL queries
 */
function generateGraphQLCacheKey(url, query) {
  const queryString = JSON.stringify({
    query: query.query,
    variables: query.variables || {}
  });
  
  const hash = btoa(queryString).replace(/[^a-zA-Z0-9]/g, '').substr(0, 32);
  return new Request(`${url}_${hash}`);
}

/**
 * Forward request to origin server
 */
async function forwardToOrigin(request) {
  const response = await fetch(request);
  
  // Add security headers to all responses
  const headers = new Headers(response.headers);
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}