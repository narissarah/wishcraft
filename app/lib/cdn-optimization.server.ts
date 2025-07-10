// CDN optimization and edge caching strategies for Shopify apps

export interface CDNConfig {
  baseUrl: string;
  regions: string[];
  cacheRules: CacheRule[];
  purgeEndpoints: string[];
}

export interface CacheRule {
  pattern: string;
  ttl: number;
  conditions?: {
    fileTypes?: string[];
    paths?: string[];
    headers?: Record<string, string>;
  };
}

// CDN cache rules for different content types
export const CDNCacheRules: CacheRule[] = [
  // Static assets - Long cache
  {
    pattern: '/build/assets/*',
    ttl: 31536000, // 1 year
    conditions: {
      fileTypes: ['js', 'css', 'woff', 'woff2', 'eot', 'ttf']
    }
  },
  
  // Images - Medium cache
  {
    pattern: '/images/*',
    ttl: 2592000, // 30 days
    conditions: {
      fileTypes: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'gif']
    }
  },
  
  // API responses - Short cache
  {
    pattern: '/api/registries/*',
    ttl: 300, // 5 minutes
    conditions: {
      headers: { 'content-type': 'application/json' }
    }
  },
  
  // Dynamic pages - Very short cache
  {
    pattern: '/registry/*',
    ttl: 60, // 1 minute
    conditions: {
      headers: { 'content-type': 'text/html' }
    }
  },

  // Shopify webhooks - No cache
  {
    pattern: '/webhooks/*',
    ttl: 0,
  },

  // Static content - Long cache
  {
    pattern: '/favicon.ico',
    ttl: 86400, // 1 day
  },

  // Sitemap and robots - Medium cache
  {
    pattern: '/sitemap.xml',
    ttl: 3600, // 1 hour
  },
  {
    pattern: '/robots.txt',
    ttl: 3600, // 1 hour
  }
];

// Edge function for intelligent caching
export class EdgeCacheManager {
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;
  }

  // Generate cache headers based on content type and path
  generateCacheHeaders(
    request: Request,
    response: Response
  ): Record<string, string> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const headers: Record<string, string> = {};

    // Find matching cache rule
    const rule = this.findMatchingRule(pathname, request);
    
    if (!rule) {
      // Default: no cache for dynamic content
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      return headers;
    }

    if (rule.ttl === 0) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      return headers;
    }

    // Set cache headers based on rule
    const cacheDirectives = [
      'public',
      `max-age=${rule.ttl}`,
      `s-maxage=${rule.ttl}`,
      'stale-while-revalidate=86400' // 1 day stale-while-revalidate
    ];

    // Add immutable for versioned assets
    if (this.isVersionedAsset(pathname)) {
      cacheDirectives.push('immutable');
    }

    headers['Cache-Control'] = cacheDirectives.join(', ');

    // Add Vary header for content negotiation
    if (this.shouldVaryOnAccept(pathname)) {
      headers['Vary'] = 'Accept, Accept-Encoding';
    }

    // Add ETag for validation caching
    const etag = this.generateETag(response);
    if (etag) {
      headers['ETag'] = etag;
    }

    return headers;
  }

  // Generate optimized response for edge caching
  async optimizeForEdge(
    request: Request,
    response: Response
  ): Promise<Response> {
    const url = new URL(request.url);
    const headers = new Headers(response.headers);

    // Add cache headers
    const cacheHeaders = this.generateCacheHeaders(request, response);
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Add security headers (frame options handled by CSP in server.js)
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-XSS-Protection', '1; mode=block');

    // Add compression hints
    if (this.shouldCompress(url.pathname)) {
      headers.set('Content-Encoding', 'gzip');
    }

    // Create optimized response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  // Purge CDN cache for specific patterns
  async purgeCache(patterns: string[]): Promise<void> {
    if (!this.config.purgeEndpoints.length) {
      console.warn('No purge endpoints configured');
      return;
    }

    const purgePromises = this.config.purgeEndpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CDN_PURGE_TOKEN}`
          },
          body: JSON.stringify({ patterns })
        });

        if (!response.ok) {
          throw new Error(`Purge failed: ${response.statusText}`);
        }

        console.log(`Cache purged for patterns: ${patterns.join(', ')}`);
      } catch (error) {
        console.error(`CDN purge failed for endpoint ${endpoint}:`, error);
      }
    });

    await Promise.allSettled(purgePromises);
  }

  // Smart cache invalidation based on content changes
  async invalidateRelatedContent(
    resourceType: 'registry' | 'product' | 'shop',
    resourceId: string
  ): Promise<void> {
    const patterns: string[] = [];

    switch (resourceType) {
      case 'registry':
        patterns.push(
          `/registry/${resourceId}`,
          `/api/registries/${resourceId}`,
          `/registry/${resourceId}/*`
        );
        break;
        
      case 'product':
        patterns.push(
          `/api/products/${resourceId}`,
          `/products/${resourceId}`,
          `/registry/*/items/${resourceId}`
        );
        break;
        
      case 'shop':
        patterns.push(
          `/api/registries/*`,
          `/registry/*`,
          `/admin/*`
        );
        break;
    }

    await this.purgeCache(patterns);
  }

  private findMatchingRule(pathname: string, request: Request): CacheRule | null {
    for (const rule of CDNCacheRules) {
      if (this.matchesPattern(pathname, rule.pattern)) {
        if (rule.conditions) {
          if (!this.matchesConditions(pathname, request, rule.conditions)) {
            continue;
          }
        }
        return rule;
      }
    }
    return null;
  }

  private matchesPattern(pathname: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(pathname);
  }

  private matchesConditions(
    pathname: string,
    request: Request,
    conditions: CacheRule['conditions']
  ): boolean {
    if (conditions?.fileTypes) {
      const extension = pathname.split('.').pop()?.toLowerCase();
      if (!extension || !conditions.fileTypes.includes(extension)) {
        return false;
      }
    }

    if (conditions?.paths) {
      const matches = conditions.paths.some(path => 
        this.matchesPattern(pathname, path)
      );
      if (!matches) {
        return false;
      }
    }

    if (conditions?.headers) {
      for (const [headerName, expectedValue] of Object.entries(conditions.headers)) {
        const actualValue = request.headers.get(headerName);
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  private isVersionedAsset(pathname: string): boolean {
    // Check if asset has version hash (e.g., app-abc123.js)
    return /\.[a-f0-9]{8,}\.(js|css|woff|woff2)$/.test(pathname);
  }

  private shouldVaryOnAccept(pathname: string): boolean {
    // Vary on Accept for images and API responses
    return pathname.includes('/api/') || 
           pathname.includes('/images/') ||
           Boolean(pathname.match(/\.(jpg|jpeg|png|webp|avif)$/));
  }

  private shouldCompress(pathname: string): boolean {
    const compressibleTypes = ['.js', '.css', '.html', '.json', '.xml', '.svg'];
    return compressibleTypes.some(ext => pathname.endsWith(ext));
  }

  private generateETag(response: Response): string | null {
    // Generate ETag based on content or last-modified date
    const lastModified = response.headers.get('Last-Modified');
    const contentLength = response.headers.get('Content-Length');
    
    if (lastModified && contentLength) {
      const hash = this.simpleHash(`${lastModified}:${contentLength}`);
      return `"${hash}"`;
    }
    
    return null;
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Content delivery optimization
export class ContentDeliveryOptimizer {
  // Optimize static asset delivery
  static optimizeStaticAssets(): {
    preloadLinks: string[];
    resourceHints: Array<{ rel: string; href: string; as?: string }>;
  } {
    const preloadLinks = [
      '/build/entry.client.js',
      '/build/entry.client.css',
      '/build/vendor-react.js',
      '/build/vendor-shopify.js'
    ];

    const resourceHints = [
      { rel: 'preconnect', href: 'https://cdn.shopify.com' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com' },
      { rel: 'dns-prefetch', href: 'https://www.google-analytics.com' },
    ];

    return { preloadLinks, resourceHints };
  }

  // Generate service worker cache strategies
  static generateSWCacheStrategies(): Array<{
    urlPattern: string;
    strategy: string;
    options?: any;
  }> {
    return [
      {
        urlPattern: '/build/assets/*',
        strategy: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
          }
        }
      },
      {
        urlPattern: '/api/registries/*',
        strategy: 'StaleWhileRevalidate',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60 // 5 minutes
          }
        }
      },
      {
        urlPattern: '/registry/*',
        strategy: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 // 1 minute
          }
        }
      }
    ];
  }

  // Optimize images for CDN delivery
  static optimizeImageDelivery(
    imageUrl: string,
    options: {
      width?: number;
      height?: number;
      format?: 'webp' | 'avif' | 'jpg' | 'png';
      quality?: number;
      srcSizes?: number[];
    }
  ): {
    optimizedUrl: string;
    srcSet?: string;
    sizes?: string;
  } {
    const { width, height, format = 'webp', quality = 85, srcSizes } = options;
    
    const url = new URL(imageUrl);
    
    if (width) url.searchParams.set('width', width.toString());
    if (height) url.searchParams.set('height', height.toString());
    if (format) url.searchParams.set('format', format);
    if (quality) url.searchParams.set('quality', quality.toString());

    const optimizedUrl = url.toString();

    let srcSet: string | undefined;
    let sizes: string | undefined;

    if (srcSizes && width) {
      srcSet = srcSizes
        .map(size => {
          const sizeUrl = new URL(imageUrl);
          sizeUrl.searchParams.set('width', size.toString());
          if (format) sizeUrl.searchParams.set('format', format);
          if (quality) sizeUrl.searchParams.set('quality', quality.toString());
          return `${sizeUrl.toString()} ${size}w`;
        })
        .join(', ');

      sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
    }

    return { optimizedUrl, srcSet, sizes };
  }
}

// Edge computing utilities
export class EdgeComputeOptimizer {
  // A/B testing at the edge
  static handleABTesting(request: Request): {
    variant: 'A' | 'B';
    headers: Record<string, string>;
  } {
    const url = new URL(request.url);
    const existingVariant = url.searchParams.get('variant');
    
    if (existingVariant === 'A' || existingVariant === 'B') {
      return {
        variant: existingVariant,
        headers: { 'X-AB-Variant': existingVariant }
      };
    }

    // Simple hash-based assignment
    const userHash = this.hashIP(this.getClientIP(request));
    const variant = userHash % 2 === 0 ? 'A' : 'B';

    return {
      variant,
      headers: { 
        'X-AB-Variant': variant,
        'Vary': 'X-Forwarded-For'
      }
    };
  }

  // Geolocation-based optimization
  static optimizeForRegion(request: Request): {
    region: string;
    optimizations: {
      currency?: string;
      language?: string;
      cdnEndpoint?: string;
    };
  } {
    const region = request.headers.get('cf-ipcountry') || 
                   request.headers.get('x-vercel-ip-country') || 
                   'US';

    const optimizations: any = {};

    // Currency optimization
    const currencyMap: Record<string, string> = {
      'US': 'USD',
      'CA': 'CAD',
      'GB': 'GBP',
      'EU': 'EUR',
      'AU': 'AUD',
      'JP': 'JPY'
    };
    optimizations.currency = currencyMap[region] || 'USD';

    // Language optimization
    const languageMap: Record<string, string> = {
      'US': 'en-US',
      'CA': 'en-CA',
      'GB': 'en-GB',
      'FR': 'fr-FR',
      'DE': 'de-DE',
      'ES': 'es-ES',
      'JP': 'ja-JP'
    };
    optimizations.language = languageMap[region] || 'en-US';

    // CDN endpoint optimization
    const cdnMap: Record<string, string> = {
      'US': 'us-east-1.cdn.example.com',
      'EU': 'eu-west-1.cdn.example.com',
      'AP': 'ap-southeast-1.cdn.example.com'
    };
    optimizations.cdnEndpoint = cdnMap[region] || cdnMap['US'];

    return { region, optimizations };
  }

  private static getClientIP(request: Request): string {
    return request.headers.get('cf-connecting-ip') ||
           request.headers.get('x-forwarded-for')?.split(',')[0] ||
           request.headers.get('x-real-ip') ||
           '127.0.0.1';
  }

  private static hashIP(ip: string): number {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Export optimized CDN manager
export const cdnManager = new EdgeCacheManager({
  baseUrl: process.env.CDN_BASE_URL || '',
  regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
  cacheRules: CDNCacheRules,
  purgeEndpoints: [process.env.CDN_PURGE_URL || ''].filter(Boolean)
});