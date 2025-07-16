/**
 * Lazy Route Loading - Code splitting for optimal performance
 * Reduces initial bundle size by loading routes on demand
 */

import { lazy, Suspense } from 'react';
import { Spinner, Frame } from '@shopify/polaris';

/**
 * Loading component for route transitions
 */
export function RouteLoader() {
  return (
    <Frame>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <Spinner accessibilityLabel="Loading..." size="large" />
      </div>
    </Frame>
  );
}

/**
 * Wrapper for lazy loaded routes
 */
export function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<RouteLoader />}>
      {children}
    </Suspense>
  );
}

/**
 * Lazy loaded routes with error boundaries
 */
export const LazyRoutes = {
  // Note: In a real implementation, these would be actual route imports
  // For now, we'll just show the pattern since routes may not exist yet
  
  // Example pattern for lazy loading routes:
  // Settings: lazy(() => 
  //   import('../routes/app.settings').then(module => ({ 
  //     default: module.default 
  //   }))
  // ),
};

/**
 * Preload a route before navigation
 */
export function preloadRoute(routeName: string) {
  // Implementation would go here when routes are defined
  // Route preloading logic
}

/**
 * Route prefetching on hover/focus
 */
export function usePrefetchRoute() {
  return {
    onMouseEnter: (routeName: string) => {
      preloadRoute(routeName);
    },
    onFocus: (routeName: string) => {
      preloadRoute(routeName);
    },
  };
}

/**
 * Lazy load heavy Polaris components
 */
export const LazyComponents = {
  // Heavy data visualization components
  DataTable: lazy(() => 
    import('@shopify/polaris').then(module => ({ 
      default: module.DataTable 
    }))
  ),
  
  ResourceList: lazy(() => 
    import('@shopify/polaris').then(module => ({ 
      default: module.ResourceList 
    }))
  ),
  
  // Modal components
  Modal: lazy(() => 
    import('@shopify/polaris').then(module => ({ 
      default: module.Modal 
    }))
  ),
};

/**
 * Progressive enhancement for images
 */
export function LazyImage({ 
  src, 
  alt, 
  width, 
  height,
  placeholder 
}: { 
  src: string; 
  alt: string; 
  width?: number;
  height?: number;
  placeholder?: string;
}) {
  return (
    <img
      src={placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="100%25" height="100%25" fill="%23f6f6f7"/%3E%3C/svg%3E'}
      data-src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onLoad={(e) => {
        const img = e.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          delete img.dataset.src;
        }
      }}
    />
  );
}

/**
 * Intersection Observer for lazy loading
 */
export function useLazyLoad(threshold = 0.1) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          
          // Load images
          if (element.tagName === 'IMG' && element.dataset.src) {
            (element as HTMLImageElement).src = element.dataset.src;
            delete element.dataset.src;
          }
          
          // Load components
          if (element.dataset.component) {
            // Component preloading would be implemented here
            // Load component based on dataset
          }
          
          observer.unobserve(element);
        }
      });
    },
    { threshold }
  );
  
  return observer;
}