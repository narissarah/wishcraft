import { LRUCache } from 'lru-cache';
import { log } from '~/lib/logger.server';

// Performance optimization utilities for Shopify best practices

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  cacheHits: number;
  dbQueries: number;
  graphqlQueries: number;
}

// In-memory cache for performance-critical data
const performanceCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Resource hints for critical resources
export function generateResourceHints(): string[] {
  return [
    '/build/entry.client.js',
    '/build/entry.client.css',
    '/build/polaris.css',
  ];
}

// Critical CSS extraction for above-the-fold content
export function generateCriticalCSS(route: string): string {
  const criticalStyles: Record<string, string> = {
    '/': `
      /* Critical styles for homepage */
      body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}
      .header{background:#000;color:#fff;padding:1rem}
      .hero{min-height:50vh;display:flex;align-items:center}
      .registry-card{border:1px solid #e1e1e1;border-radius:8px;padding:1rem}
    `,
    '/registry': `
      /* Critical styles for registry pages */
      .registry-header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)}
      .progress-bar{height:8px;background:#e1e1e1;border-radius:4px}
      .item-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem}
    `,
    '/admin': `
      /* Critical styles for admin */
      .polaris-page{padding:1rem}
      .polaris-card{background:#fff;border:1px solid #e1e1e1;border-radius:8px}
    `
  };

  return criticalStyles[route] || criticalStyles['/'];
}

// Lazy loading utilities
export function createIntersectionObserver(callback: IntersectionObserverCallback): IntersectionObserver {
  return new IntersectionObserver(callback, {
    root: null,
    rootMargin: '50px',
    threshold: 0.1
  });
}

// Performance measurement helpers
export class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    loadTime: 0,
    renderTime: 0,
    cacheHits: 0,
    dbQueries: 0,
    graphqlQueries: 0
  };

  startTiming(label: string): void {
    performance.mark(`${label}-start`);
  }

  endTiming(label: string): number {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    
    const measure = performance.getEntriesByName(label)[0];
    return measure.duration;
  }

  incrementCounter(metric: keyof PerformanceMetrics): void {
    if (typeof this.metrics[metric] === 'number') {
      (this.metrics[metric] as number) += 1;
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  recordCoreWebVitals(): void {
    // Largest Contentful Paint
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      log.performance('LCP', lastEntry.startTime, { metric: 'LCP' });
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((entryList) => {
      const firstInput = entryList.getEntries()[0];
      const processingStart = (firstInput as any).processingStart;
      if (processingStart) {
        log.performance('FID', processingStart - firstInput.startTime, { metric: 'FID' });
      }
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift
    new PerformanceObserver((entryList) => {
      let clsValue = 0;
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      log.performance('CLS', clsValue, { metric: 'CLS' });
    }).observe({ entryTypes: ['layout-shift'] });
  }
}

// Cache utilities
export const cacheUtils = {
  get: <T>(key: string): T | undefined => {
    return performanceCache.get(key);
  },

  set: <T>(key: string, value: T, ttl?: number): void => {
    performanceCache.set(key, value, { ttl });
  },

  delete: (key: string): void => {
    performanceCache.delete(key);
  },

  clear: (): void => {
    performanceCache.clear();
  },

  generateKey: (...parts: string[]): string => {
    return parts.join(':');
  }
};

// Image optimization helpers
export function generateResponsiveImageSizes(width: number): string {
  const sizes = [480, 768, 1024, 1280, 1920];
  return sizes
    .filter(size => size <= width * 2) // Include up to 2x the original
    .map(size => `${size}w`)
    .join(', ');
}

export function generateImageSrcSet(baseUrl: string, width: number): string {
  const sizes = [480, 768, 1024, 1280, 1920];
  return sizes
    .filter(size => size <= width * 2)
    .map(size => `${baseUrl}?width=${size} ${size}w`)
    .join(', ');
}

// Bundle optimization utilities
export function shouldPreloadResource(route: string, resource: string): boolean {
  const criticalRoutes = ['/', '/registry', '/admin'];
  const criticalResources = ['/build/entry.client.js', '/build/entry.client.css'];
  
  return criticalRoutes.includes(route) && criticalResources.includes(resource);
}

// Database performance helpers
export function createOptimizedQuery(tableName: string, fields: string[], conditions?: Record<string, any>) {
  const query = {
    select: fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}),
    where: conditions,
    // Add performance optimizations
    take: 50, // Limit results by default
    orderBy: { updatedAt: 'desc' as const }
  };

  return query;
}