import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ClientOnly } from '~/components/ClientOnly';

// Optimized image component with lazy loading and responsive images
interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function OptimizedImage({ 
  src, 
  alt, 
  width, 
  height, 
  className = '', 
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
}: OptimizedImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(priority);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  // Generate responsive image URLs
  const generateSrcSet = (baseUrl: string) => {
    const sizes = [480, 768, 1024, 1280, 1920];
    return sizes
      .filter(size => size <= width * 2)
      .map(size => {
        const url = new URL(baseUrl);
        url.searchParams.set('width', size.toString());
        return `${url.toString()} ${size}w`;
      })
      .join(', ');
  };

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${width}/${height}` }}
    >
      {/* Placeholder with blur effect */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3e%3crect width='100%25' height='100%25' fill='%23e5e7eb'/%3e%3c/svg%3e")`,
            backgroundSize: 'cover'
          }}
        />
      )}
      
      {/* Actual image */}
      <img
        ref={imgRef}
        src={isVisible ? src : undefined}
        srcSet={isVisible ? generateSrcSet(src) : undefined}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
      />
    </div>
  );
}

// Lazy-loaded component wrapper
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
}

export function LazyWrapper({ 
  children, 
  fallback = <div className="animate-pulse bg-gray-200 h-32 rounded" />,
  threshold = 0.1 
}: LazyWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
}

// Code splitting utility for dynamic imports
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(importFn);
}

// Critical CSS component
export function CriticalCSS({ styles }: { styles: string }) {
  return (
    <style
      dangerouslySetInnerHTML={{ __html: styles }}
      data-critical="true"
    />
  );
}

// Resource hints component
interface ResourceHint {
  rel: string;
  href: string;
  as?: string;
  crossOrigin?: string;
}

export function ResourceHints({ hints }: { hints: ResourceHint[] }) {
  return (
    <>
      {hints.map((hint, index) => (
        <link
          key={index}
          rel={hint.rel}
          href={hint.href}
          as={hint.as}
          crossOrigin={hint.crossOrigin as "anonymous" | "use-credentials" | "" | undefined}
        />
      ))}
    </>
  );
}

// Performance monitoring component
export function PerformanceMonitor() {
  useEffect(() => {
    // Core Web Vitals monitoring
    if (typeof window !== 'undefined') {
      // Largest Contentful Paint
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        // Send to analytics
        if (window.gtag) {
          window.gtag('event', 'web-vitals', {
            name: 'LCP',
            value: Math.round(lastEntry.startTime),
            event_category: 'Performance'
          });
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((entryList) => {
        const firstInput = entryList.getEntries()[0];
        const fid = (firstInput.processingStart || 0) - firstInput.startTime;
        
        if (window.gtag) {
          window.gtag('event', 'web-vitals', {
            name: 'FID',
            value: Math.round(fid),
            event_category: 'Performance'
          });
        }
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        
        if (window.gtag) {
          window.gtag('event', 'web-vitals', {
            name: 'CLS',
            value: Math.round(clsValue * 1000) / 1000,
            event_category: 'Performance'
          });
        }
      }).observe({ entryTypes: ['layout-shift'] });
    }
  }, []);

  return null;
}

// Skeleton loading components
export function RegistryCardSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-4" />
      <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
      <div className="h-4 bg-gray-200 rounded mb-4 w-1/2" />
      <div className="h-10 bg-gray-200 rounded" />
    </div>
  );
}

export function ProductItemSkeleton() {
  return (
    <div className="flex space-x-4 p-4 animate-pulse">
      <div className="w-16 h-16 bg-gray-200 rounded" />
      <div className="flex-1">
        <div className="h-4 bg-gray-200 rounded mb-2" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="h-8 w-20 bg-gray-200 rounded" />
    </div>
  );
}

// Virtual scrolling for large lists
interface VirtualScrollProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
}

export function VirtualScroll({ 
  items, 
  itemHeight, 
  containerHeight, 
  renderItem 
}: VirtualScrollProps) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  
  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Client-only wrapper for hydration-sensitive components
export function ClientOnlyWrapper({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <ClientOnly fallback={fallback}>
      {() => children}
    </ClientOnly>
  );
}