/**
 * Chunk Optimization Utilities
 * Implements advanced code splitting strategies
 */

/**
 * Define chunk groups for optimal loading
 */
export const ChunkGroups = {
  // Critical path - loaded immediately
  critical: [
    '@shopify/polaris/build/esm/components/Frame',
    '@shopify/polaris/build/esm/components/Page',
    '@shopify/polaris/build/esm/components/Layout',
    '@shopify/polaris/build/esm/components/Card',
    '@shopify/polaris/build/esm/components/Button',
    '@shopify/polaris/build/esm/components/Text',
  ],
  
  // Common components - loaded after critical
  common: [
    '@shopify/polaris/build/esm/components/Form',
    '@shopify/polaris/build/esm/components/TextField',
    '@shopify/polaris/build/esm/components/Select',
    '@shopify/polaris/build/esm/components/Banner',
    '@shopify/polaris/build/esm/components/Toast',
  ],
  
  // Data components - loaded on demand
  data: [
    '@shopify/polaris/build/esm/components/DataTable',
    '@shopify/polaris/build/esm/components/ResourceList',
    '@shopify/polaris/build/esm/components/ResourceItem',
    '@shopify/polaris/build/esm/components/Pagination',
    '@shopify/polaris/build/esm/components/Filters',
  ],
  
  // Heavy components - always lazy loaded
  heavy: [
    '@shopify/polaris/build/esm/components/Modal',
    '@shopify/polaris/build/esm/components/Sheet',
    '@shopify/polaris/build/esm/components/ColorPicker',
    '@shopify/polaris/build/esm/components/DatePicker',
  ],
  
  // Utilities - shared across all chunks
  utils: [
    'date-fns',
    'zod',
    '@shopify/app-bridge-react',
  ],
};

/**
 * Magic comments for webpack/vite chunking
 */
export const ChunkNames = {
  // Route chunks
  settings: /* webpackChunkName: "route-settings" */ 'route-settings',
  registries: /* webpackChunkName: "route-registries" */ 'route-registries',
  analytics: /* webpackChunkName: "route-analytics" */ 'route-analytics',
  
  // Feature chunks
  encryption: /* webpackChunkName: "feature-encryption" */ 'feature-encryption',
  validation: /* webpackChunkName: "feature-validation" */ 'feature-validation',
  cache: /* webpackChunkName: "feature-cache" */ 'feature-cache',
  
  // Vendor chunks
  polaris: /* webpackChunkName: "vendor-polaris" */ 'vendor-polaris',
  shopify: /* webpackChunkName: "vendor-shopify" */ 'vendor-shopify',
  utils: /* webpackChunkName: "vendor-utils" */ 'vendor-utils',
};

/**
 * Preload critical resources
 */
export function preloadCriticalAssets() {
  if (typeof window === 'undefined') return;
  
  // Preload critical CSS
  const criticalCSS = [
    '/build/css/app.css',
    '/build/css/polaris.css',
  ];
  
  criticalCSS.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  });
  
  // Preload critical fonts
  const criticalFonts = [
    '/fonts/Inter-Regular.woff2',
    '/fonts/Inter-Medium.woff2',
    '/fonts/Inter-Bold.woff2',
  ];
  
  criticalFonts.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Prefetch non-critical resources
 */
export function prefetchAssets() {
  if (typeof window === 'undefined') return;
  
  // Use requestIdleCallback for non-critical prefetching
  const prefetch = () => {
    // Prefetch route chunks
    Object.values(ChunkNames).forEach(chunkName => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = `/build/js/${chunkName}.js`;
      document.head.appendChild(link);
    });
  };
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetch);
  } else {
    setTimeout(prefetch, 1000);
  }
}

/**
 * Resource hints for optimal loading
 */
export function addResourceHints() {
  if (typeof window === 'undefined') return;
  
  // DNS prefetch for external resources
  const dnsPrefetch = [
    'https://cdn.shopify.com',
    'https://fonts.shopifycdn.com',
    'https://analytics.shopify.com',
  ];
  
  dnsPrefetch.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = href;
    document.head.appendChild(link);
  });
  
  // Preconnect to critical origins
  const preconnect = [
    'https://cdn.shopify.com',
  ];
  
  preconnect.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Progressive enhancement for bundle loading
 */
export class BundleLoader {
  private static loadedChunks = new Set<string>();
  private static loadingChunks = new Map<string, Promise<void>>();
  
  /**
   * Load a chunk on demand
   */
  static async loadChunk(chunkName: string): Promise<void> {
    // Already loaded
    if (this.loadedChunks.has(chunkName)) {
      return Promise.resolve();
    }
    
    // Currently loading
    if (this.loadingChunks.has(chunkName)) {
      return this.loadingChunks.get(chunkName)!;
    }
    
    // Load the chunk
    const loadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `/build/js/${chunkName}.js`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        this.loadedChunks.add(chunkName);
        this.loadingChunks.delete(chunkName);
        resolve();
      };
      
      script.onerror = () => {
        this.loadingChunks.delete(chunkName);
        reject(new Error(`Failed to load chunk: ${chunkName}`));
      };
      
      document.head.appendChild(script);
    });
    
    this.loadingChunks.set(chunkName, loadPromise);
    return loadPromise;
  }
  
  /**
   * Preload chunks based on user interaction patterns
   */
  static preloadByPattern(pattern: 'admin' | 'customer' | 'analytics') {
    const chunks: string[] = [];
    
    switch (pattern) {
      case 'admin':
        chunks.push(ChunkNames.settings, ChunkNames.registries);
        break;
      case 'customer':
        chunks.push(ChunkNames.registries);
        break;
      case 'analytics':
        chunks.push(ChunkNames.analytics, ChunkNames.utils);
        break;
    }
    
    // Preload in background
    requestIdleCallback(() => {
      chunks.forEach(chunk => this.loadChunk(chunk).catch((error) => {
        // Silent failure for preloading - track for monitoring only
        if (typeof window !== 'undefined' && window.performance?.mark) {
          window.performance.mark(`chunk-load-error-${chunk}`);
        }
      }));
    });
  }
}

/**
 * Service Worker registration for advanced caching
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        registration => {
          // ServiceWorker registered successfully - silent for production
        },
        error => {
          // ServiceWorker registration failed - silent for production
        }
      );
    });
  }
}

/**
 * Module federation configuration for micro-frontends
 */
export const ModuleFederationConfig = {
  name: 'wishcraft',
  filename: 'remoteEntry.js',
  exposes: {
    './RegistryWidget': './app/components/RegistryWidget',
    './RegistryList': './app/components/RegistryList',
    './RegistryCreate': './app/components/RegistryCreate',
  },
  shared: {
    react: { singleton: true, requiredVersion: '^18.0.0' },
    'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
    '@shopify/polaris': { singleton: true, requiredVersion: '^13.0.0' },
    '@shopify/app-bridge-react': { singleton: true },
  },
};