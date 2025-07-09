// WishCraft Service Worker - Offline functionality for Shopify app
// Follows Shopify performance best practices

const CACHE_NAME = 'wishcraft-v1';
const RUNTIME_CACHE = 'wishcraft-runtime';
const STATIC_CACHE = 'wishcraft-static';
const API_CACHE = 'wishcraft-api';
const IMAGE_CACHE = 'wishcraft-images';

// Cache strategies configuration
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// URLs to cache on install
const STATIC_RESOURCES = [
  '/',
  '/offline',
  '/build/entry.client.js',
  '/build/entry.client.css',
  '/build/vendor-react.js',
  '/build/vendor-shopify.js',
  '/manifest.json',
  '/favicon.ico'
];

// Route patterns and their cache strategies
const ROUTE_CACHE_CONFIG = [
  {
    pattern: /^https:\/\/cdn\.shopify\.com\//,
    strategy: CACHE_STRATEGIES.CACHE_FIRST,
    cacheName: IMAGE_CACHE,
    expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } // 30 days
  },
  {
    pattern: /\/build\/.*\.(js|css|woff|woff2)$/,
    strategy: CACHE_STRATEGIES.CACHE_FIRST,
    cacheName: STATIC_CACHE,
    expiration: { maxEntries: 50, maxAgeSeconds: 365 * 24 * 60 * 60 } // 1 year
  },
  {
    pattern: /\/api\/registries/,
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    cacheName: API_CACHE,
    expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 } // 5 minutes
  },
  {
    pattern: /\/registry\/[^\/]+$/,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    cacheName: RUNTIME_CACHE,
    expiration: { maxEntries: 30, maxAgeSeconds: 60 } // 1 minute
  },
  {
    pattern: /\/admin/,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    cacheName: RUNTIME_CACHE,
    expiration: { maxEntries: 20, maxAgeSeconds: 30 } // 30 seconds
  }
];

// Install event - cache static resources
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static resources...');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('Static resources cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Failed to cache static resources:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName !== CACHE_NAME && 
                     cacheName !== STATIC_CACHE &&
                     cacheName !== API_CACHE &&
                     cacheName !== IMAGE_CACHE &&
                     cacheName !== RUNTIME_CACHE;
            })
            .map(cacheName => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Take control of all pages
      self.clients.claim()
    ])
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip requests to different origins (except CDNs)
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('cdn.shopify.com')) {
    return;
  }

  // Skip webhook requests
  if (event.request.url.includes('/webhooks/')) {
    return;
  }

  event.respondWith(handleRequest(event.request));
});

// Handle push notifications for real-time updates
self.addEventListener('push', event => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New activity on your registry',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag || 'wishcraft-notification',
      renotify: true,
      actions: [
        {
          action: 'view',
          title: 'View Registry',
          icon: '/action-view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/action-dismiss.png'
        }
      ],
      data: {
        url: data.url || '/',
        registryId: data.registryId
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'WishCraft', options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'registry-updates') {
    event.waitUntil(syncRegistryUpdates());
  } else if (event.tag === 'offline-analytics') {
    event.waitUntil(syncOfflineAnalytics());
  }
});

// Main request handler with caching strategies
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Find matching cache configuration
  const config = findCacheConfig(request);
  
  if (!config) {
    // No cache config - try network first, fallback to cache
    return networkFirstWithFallback(request);
  }

  switch (config.strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return cacheFirst(request, config);
    
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return networkFirst(request, config);
    
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request, config);
    
    case CACHE_STRATEGIES.NETWORK_ONLY:
      return fetch(request);
    
    case CACHE_STRATEGIES.CACHE_ONLY:
      return caches.match(request);
    
    default:
      return networkFirstWithFallback(request);
  }
}

// Cache first strategy
async function cacheFirst(request, config) {
  const cache = await caches.open(config.cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    // Check if cache entry is expired
    if (config.expiration && isCacheExpired(cached, config.expiration.maxAgeSeconds)) {
      // Cache expired, fetch new version in background
      fetchAndCache(request, config).catch(console.error);
    }
    return cached;
  }
  
  return fetchAndCache(request, config);
}

// Network first strategy
async function networkFirst(request, config) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cacheResponse(request, response.clone(), config);
    }
    
    return response;
  } catch (error) {
    console.warn('Network request failed, trying cache:', error);
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    
    throw error;
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, config) {
  const cache = await caches.open(config.cacheName);
  const cached = await cache.match(request);
  
  // Always fetch in background to update cache
  const fetchPromise = fetchAndCache(request, config).catch(console.error);
  
  // Return cached version immediately if available
  if (cached) {
    return cached;
  }
  
  // Wait for network if no cache
  return fetchPromise;
}

// Network first with offline fallback
async function networkFirstWithFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline') || new Response('Offline', { status: 503 });
    }
    
    throw error;
  }
}

// Fetch and cache response
async function fetchAndCache(request, config) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      await cacheResponse(request, response.clone(), config);
    }
    
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}

// Cache response with expiration handling
async function cacheResponse(request, response, config) {
  const cache = await caches.open(config.cacheName);
  
  // Add timestamp for expiration checking
  const responseWithTimestamp = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'sw-cache-timestamp': Date.now().toString()
    }
  });
  
  await cache.put(request, responseWithTimestamp);
  
  // Clean up expired entries
  if (config.expiration) {
    cleanupExpiredEntries(config.cacheName, config.expiration);
  }
}

// Find cache configuration for request
function findCacheConfig(request) {
  return ROUTE_CACHE_CONFIG.find(config => 
    config.pattern.test(request.url)
  );
}

// Check if cache entry is expired
function isCacheExpired(response, maxAgeSeconds) {
  const timestamp = response.headers.get('sw-cache-timestamp');
  if (!timestamp) return false;
  
  const age = (Date.now() - parseInt(timestamp)) / 1000;
  return age > maxAgeSeconds;
}

// Clean up expired cache entries
async function cleanupExpiredEntries(cacheName, expiration) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    let deletedCount = 0;
    const maxEntries = expiration.maxEntries || 50;
    
    // Delete expired entries
    for (const request of requests) {
      const response = await cache.match(request);
      if (response && isCacheExpired(response, expiration.maxAgeSeconds)) {
        await cache.delete(request);
        deletedCount++;
      }
    }
    
    // Enforce max entries limit
    const remainingRequests = await cache.keys();
    if (remainingRequests.length > maxEntries) {
      const excessCount = remainingRequests.length - maxEntries;
      for (let i = 0; i < excessCount; i++) {
        await cache.delete(remainingRequests[i]);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired entries from ${cacheName}`);
    }
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}

// Sync registry updates when back online
async function syncRegistryUpdates() {
  try {
    // Get offline actions from IndexedDB
    const offlineActions = await getOfflineActions();
    
    for (const action of offlineActions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        // Remove successful action from offline storage
        await removeOfflineAction(action.id);
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }
  } catch (error) {
    console.error('Registry sync failed:', error);
  }
}

// Sync offline analytics when back online
async function syncOfflineAnalytics() {
  try {
    const analyticsData = await getOfflineAnalytics();
    
    if (analyticsData.length > 0) {
      await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: analyticsData })
      });
      
      // Clear offline analytics after successful sync
      await clearOfflineAnalytics();
    }
  } catch (error) {
    console.error('Analytics sync failed:', error);
  }
}

// IndexedDB operations (simplified)
async function getOfflineActions() {
  // Implementation would use IndexedDB to store offline actions
  return [];
}

async function removeOfflineAction(id) {
  // Implementation would remove action from IndexedDB
}

async function getOfflineAnalytics() {
  // Implementation would get analytics data from IndexedDB
  return [];
}

async function clearOfflineAnalytics() {
  // Implementation would clear analytics data from IndexedDB
}

// Performance monitoring with enhanced metrics
const PERFORMANCE_METRICS = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  backgroundSyncs: 0,
  pushNotifications: 0,
  offlineInteractions: 0
};

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_CACHE_STATS') {
    getCacheStats().then(stats => {
      event.ports[0].postMessage(stats);
    });
  } else if (event.data && event.data.type === 'GET_PERFORMANCE_METRICS') {
    event.ports[0].postMessage({
      type: 'PERFORMANCE_METRICS',
      data: PERFORMANCE_METRICS
    });
  } else if (event.data && event.data.type === 'TRACK_OFFLINE_INTERACTION') {
    PERFORMANCE_METRICS.offlineInteractions++;
    // Store offline interaction for later sync
    storeOfflineInteraction(event.data.payload);
  }
});

// Get cache statistics
async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    stats[cacheName] = {
      entryCount: keys.length,
      size: await getCacheSize(cache, keys)
    };
  }
  
  return stats;
}

// Calculate cache size (approximate)
async function getCacheSize(cache, keys) {
  let totalSize = 0;
  
  for (const key of keys.slice(0, 10)) { // Sample first 10 entries
    try {
      const response = await cache.match(key);
      if (response && response.headers.has('content-length')) {
        totalSize += parseInt(response.headers.get('content-length'));
      }
    } catch (error) {
      // Ignore errors for size calculation
    }
  }
  
  return Math.round(totalSize * keys.length / Math.min(keys.length, 10));
}