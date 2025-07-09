import { lazy, Suspense } from 'react';
import { ClientOnly } from 'remix-utils/client-only';

// Code splitting utilities for optimal bundle size

// Lazy-loaded components for non-critical features
export const LazyComponents = {
  // Charts and analytics (heavy dependencies)
  AnalyticsChart: lazy(() => 
    import('~/components/analytics/AnalyticsChart').then(module => ({
      default: module.AnalyticsChart
    }))
  ),
  
  RegistryAnalytics: lazy(() => 
    import('~/components/analytics/RegistryAnalytics').then(module => ({
      default: module.RegistryAnalytics
    }))
  ),

  // Group gifting components (feature-specific)
  GroupGiftProgress: lazy(() => 
    import('~/components/GroupGiftProgress').then(module => ({
      default: module.GroupGiftProgress
    }))
  ),
  
  GroupGiftContributors: lazy(() => 
    import('~/components/GroupGiftContributors').then(module => ({
      default: module.GroupGiftContributors
    }))
  ),

  // Real-time components (WebSocket heavy)
  RealtimeNotifications: lazy(() => 
    import('~/components/RealtimeComponents').then(module => ({
      default: module.RealtimeNotifications
    }))
  ),
  
  LiveViewers: lazy(() => 
    import('~/components/RealtimeComponents').then(module => ({
      default: module.LiveViewers
    }))
  ),

  // Advanced forms (complex validation)
  AdvancedRegistryForm: lazy(() => 
    import('~/components/forms/AdvancedRegistryForm').then(module => ({
      default: module.AdvancedRegistryForm
    }))
  ),
  
  MultiAddressForm: lazy(() => 
    import('~/components/forms/MultiAddressForm').then(module => ({
      default: module.MultiAddressForm
    }))
  ),

  // Image gallery (heavy media handling)
  ImageGallery: lazy(() => 
    import('~/components/OptimizedImage').then(module => ({
      default: module.ImageGallery
    }))
  ),

  // Rich text editor (heavy dependency)
  RichTextEditor: lazy(() => 
    import('~/components/forms/RichTextEditor').then(module => ({
      default: module.RichTextEditor
    }))
  ),

  // PDF generation (heavy processing)
  PDFExport: lazy(() => 
    import('~/components/export/PDFExport').then(module => ({
      default: module.PDFExport
    }))
  ),

  // QR Code generator
  QRCodeGenerator: lazy(() => 
    import('~/components/sharing/QRCodeGenerator').then(module => ({
      default: module.QRCodeGenerator
    }))
  ),
};

// Loading fallbacks for different component types
export const LoadingFallbacks = {
  chart: (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-200 rounded-lg mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  ),
  
  form: (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-24 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded w-32"></div>
    </div>
  ),
  
  gallery: (
    <div className="animate-pulse">
      <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
      <div className="flex space-x-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-16 h-16 bg-gray-200 rounded"></div>
        ))}
      </div>
    </div>
  ),
  
  card: (
    <div className="animate-pulse p-6 border border-gray-200 rounded-lg">
      <div className="h-6 bg-gray-200 rounded mb-4"></div>
      <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  ),
  
  list: (
    <div className="animate-pulse space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex space-x-3">
          <div className="w-12 h-12 bg-gray-200 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  ),

  notification: (
    <div className="animate-pulse flex items-center space-x-3 p-3 border border-gray-200 rounded">
      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
      <div className="flex-1">
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  ),
};

// Wrapper components for lazy loading with appropriate fallbacks
export function LazyChart({ 
  children, 
  fallback = LoadingFallbacks.chart 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <ClientOnly fallback={fallback}>
        {() => children}
      </ClientOnly>
    </Suspense>
  );
}

export function LazyForm({ 
  children, 
  fallback = LoadingFallbacks.form 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <ClientOnly fallback={fallback}>
        {() => children}
      </ClientOnly>
    </Suspense>
  );
}

export function LazyGallery({ 
  children, 
  fallback = LoadingFallbacks.gallery 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <ClientOnly fallback={fallback}>
        {() => children}
      </ClientOnly>
    </Suspense>
  );
}

export function LazyFeature({ 
  children, 
  fallback = LoadingFallbacks.card,
  condition = true
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
  condition?: boolean;
}) {
  if (!condition) return null;
  
  return (
    <Suspense fallback={fallback}>
      <ClientOnly fallback={fallback}>
        {() => children}
      </ClientOnly>
    </Suspense>
  );
}

// Route-based code splitting helper
export function createLazyRoute(importFn: () => Promise<any>) {
  return lazy(() => importFn().then(module => ({
    default: module.default || module
  })));
}

// Dynamic import with error boundary
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await importFn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return dynamicImport(importFn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Preload utilities for route transitions
export const preloadRoutes = {
  analytics: () => import('~/routes/admin.analytics'),
  groupGifts: () => import('~/routes/registry.$slug.group-gift.$id'),
  multiAddress: () => import('~/routes/registry.$slug.checkout'),
  settings: () => import('~/routes/admin.settings'),
};

// Bundle analysis helper
export function analyzeBundleSize() {
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    const jsResources = resources.filter(resource => 
      resource.name.includes('.js') && 
      !resource.name.includes('node_modules')
    );
    
    const cssResources = resources.filter(resource => 
      resource.name.includes('.css')
    );
    
    const analysis = {
      totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,
      jsSize: jsResources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
      cssSize: cssResources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
      resourceCount: resources.length,
      cacheHitRatio: resources.filter(r => r.transferSize === 0).length / resources.length
    };
    
    console.log('Bundle Analysis:', analysis);
    
    // Send to analytics if available
    if (window.gtag) {
      window.gtag('event', 'bundle_analysis', {
        event_category: 'Performance',
        js_size: analysis.jsSize,
        css_size: analysis.cssSize,
        load_time: analysis.totalLoadTime,
        cache_hit_ratio: analysis.cacheHitRatio
      });
    }
    
    return analysis;
  }
}

// Tree shaking helper - mark functions for production removal
export function devOnly<T>(fn: T): T | undefined {
  return __DEV__ ? fn : undefined;
}

export function prodOnly<T>(fn: T): T | undefined {
  return __PROD__ ? fn : undefined;
}

// Feature flag system for progressive loading
interface FeatureFlags {
  enableGroupGifting: boolean;
  enableRealtimeFeatures: boolean;
  enableAdvancedAnalytics: boolean;
  enableMultiAddress: boolean;
  enablePDFExport: boolean;
}

const defaultFlags: FeatureFlags = {
  enableGroupGifting: true,
  enableRealtimeFeatures: true,
  enableAdvancedAnalytics: false, // Heavy feature, disabled by default
  enableMultiAddress: true,
  enablePDFExport: false, // Heavy dependency, disabled by default
};

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  // In production, read from environment or API
  if (typeof window !== 'undefined') {
    const flags = window.ENV?.FEATURE_FLAGS || defaultFlags;
    return flags[flag] ?? defaultFlags[flag];
  }
  
  return defaultFlags[flag];
}

// Conditional component wrapper
export function ConditionalFeature({ 
  flag, 
  children, 
  fallback = null 
}: { 
  flag: keyof FeatureFlags; 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeatureFlag(flag);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// Resource hints for preloading critical chunks
export function generateModulePreloadHints(modules: string[]): Array<{
  rel: string;
  href: string;
  as: string;
  crossOrigin?: string;
}> {
  return modules.map(module => ({
    rel: 'modulepreload',
    href: `/build/${module}`,
    as: 'script',
    crossOrigin: 'anonymous'
  }));
}