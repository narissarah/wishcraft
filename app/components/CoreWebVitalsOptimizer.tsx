import { useEffect, useRef, useState } from "react";

/**
 * Core Web Vitals Optimizer Component
 * Advanced optimizations for perfect LCP, FID, and CLS scores
 */

interface CoreWebVitalsOptimizerProps {
  children: React.ReactNode;
  enableLCPOptimization?: boolean;
  enableCLSOptimization?: boolean;
  enableFIDOptimization?: boolean;
}

export function CoreWebVitalsOptimizer({
  children,
  enableLCPOptimization = true,
  enableCLSOptimization = true,
  enableFIDOptimization = true,
}: CoreWebVitalsOptimizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // LCP Optimization: Preload critical resources
    if (enableLCPOptimization) {
      // Preload critical fonts
      const fontLink = document.createElement('link');
      fontLink.rel = 'preload';
      fontLink.href = 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2';
      fontLink.as = 'font';
      fontLink.type = 'font/woff2';
      fontLink.crossOrigin = 'anonymous';
      document.head.appendChild(fontLink);

      // Preload critical CSS
      const criticalCSS = document.createElement('link');
      criticalCSS.rel = 'preload';
      criticalCSS.href = '/build/critical.css';
      criticalCSS.as = 'style';
      criticalCSS.onload = () => {
        criticalCSS.rel = 'stylesheet';
      };
      document.head.appendChild(criticalCSS);

      // Prefetch next page resources
      const nextPagePrefetch = document.createElement('link');
      nextPagePrefetch.rel = 'prefetch';
      nextPagePrefetch.href = '/admin/registries';
      document.head.appendChild(nextPagePrefetch);
    }

    // CLS Optimization: Reserve space for dynamic content
    if (enableCLSOptimization) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Prevent layout shifts by maintaining aspect ratios
          const target = entry.target as HTMLElement;
          if (target.dataset.aspectRatio) {
            const aspectRatio = parseFloat(target.dataset.aspectRatio);
            const width = entry.contentRect.width;
            target.style.height = `${width / aspectRatio}px`;
          }
        }
      });

      // Observe all images and dynamic content
      const images = containerRef.current.querySelectorAll('img[data-aspect-ratio]');
      images.forEach((img) => observer.observe(img));

      return () => observer.disconnect();
    }

    // FID Optimization: Defer non-critical JavaScript
    if (enableFIDOptimization) {
      // Use requestIdleCallback for non-critical tasks
      if ('requestIdleCallback' in window) {
        const idleCallback = (deadline: IdleDeadline) => {
          while (deadline.timeRemaining() > 0) {
            // Perform non-critical tasks during idle time
            const nonCriticalElements = document.querySelectorAll('[data-non-critical]');
            nonCriticalElements.forEach((element) => {
              element.removeAttribute('data-non-critical');
            });
            break;
          }
        };
        requestIdleCallback(idleCallback);
      }

      // Optimize event listeners with passive options
      const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'scroll'];
      passiveEvents.forEach((eventType) => {
        document.addEventListener(eventType, () => {}, { passive: true });
      });
    }

    // Intersection Observer for lazy loading and viewport optimizations
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            
            // Load non-critical resources when visible
            const target = entry.target as HTMLElement;
            const lazyImages = target.querySelectorAll('img[data-src]');
            lazyImages.forEach((img) => {
              const htmlImg = img as HTMLImageElement;
              if (htmlImg.dataset.src) {
                htmlImg.src = htmlImg.dataset.src;
                htmlImg.removeAttribute('data-src');
                htmlImg.classList.add('loaded');
              }
            });
          }
        });
      },
      {
        root: null,
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      intersectionObserver.observe(containerRef.current);
    }

    return () => {
      intersectionObserver.disconnect();
    };
  }, [enableLCPOptimization, enableCLSOptimization, enableFIDOptimization]);

  return (
    <div
      ref={containerRef}
      style={{
        // Prevent layout shifts with min-height
        minHeight: '1px',
        // Optimize painting with contain
        contain: 'layout style paint',
        // Enable hardware acceleration
        transform: 'translateZ(0)',
        // Optimize for compositing
        willChange: isVisible ? 'auto' : 'transform',
      }}
      data-core-web-vitals-optimized="true"
    >
      {children}
    </div>
  );
}

/**
 * Critical Resource Preloader Hook
 * Preloads critical resources for improved LCP
 */
export function useCriticalResourcePreloader() {
  useEffect(() => {
    // Preload critical images
    const criticalImages = [
      '/images/hero-banner.webp',
      '/images/logo.svg',
      '/build/polaris-icons.svg',
    ];

    criticalImages.forEach((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = src;
      link.as = 'image';
      link.fetchPriority = 'high';
      document.head.appendChild(link);
    });

    // Preload critical scripts
    const criticalScripts = [
      '/build/entry.client.js',
      '/build/vendor-react.js',
    ];

    criticalScripts.forEach((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = src;
      link.as = 'script';
      link.fetchPriority = 'high';
      document.head.appendChild(link);
    });
  }, []);
}

/**
 * Layout Shift Prevention Hook
 * Prevents cumulative layout shift by reserving space
 */
export function useLayoutShiftPrevention() {
  useEffect(() => {
    // Add aspect ratio containers for images
    const images = document.querySelectorAll('img:not([data-aspect-ratio])');
    images.forEach((img) => {
      const htmlImg = img as HTMLImageElement;
      
      // Calculate aspect ratio when image loads
      htmlImg.onload = () => {
        const aspectRatio = htmlImg.naturalWidth / htmlImg.naturalHeight;
        htmlImg.dataset.aspectRatio = aspectRatio.toString();
        
        // Set explicit dimensions to prevent shifts
        if (!htmlImg.style.width && !htmlImg.style.height) {
          htmlImg.style.aspectRatio = aspectRatio.toString();
        }
      };
    });

    // Reserve space for dynamic content
    const dynamicContainers = document.querySelectorAll('[data-dynamic-content]');
    dynamicContainers.forEach((container) => {
      const htmlContainer = container as HTMLElement;
      if (!htmlContainer.style.minHeight) {
        htmlContainer.style.minHeight = '200px'; // Reserve minimum space
      }
    });
  }, []);
}

/**
 * First Input Delay Optimizer Hook
 * Optimizes for better FID scores
 */
export function useFirstInputDelayOptimizer() {
  useEffect(() => {
    // Break up long tasks using scheduler.postTask if available
    if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
      const scheduler = (window as any).scheduler;
      
      // Schedule non-critical tasks
      scheduler.postTask(() => {
        // Initialize non-critical features
        console.log('Non-critical initialization complete');
      }, { priority: 'background' });
    }

    // Use MessageChannel for task scheduling fallback
    const channel = new MessageChannel();
    channel.port2.onmessage = () => {
      // Execute deferred tasks
      const deferredTasks = document.querySelectorAll('[data-deferred-task]');
      deferredTasks.forEach((element) => {
        element.removeAttribute('data-deferred-task');
      });
    };

    // Schedule deferred execution
    setTimeout(() => {
      channel.port1.postMessage(null);
    }, 0);

    // Optimize scroll listeners
    let scrollTimeout: NodeJS.Timeout;
    const optimizedScrollHandler = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Perform scroll-related updates
        document.body.dataset.scrolling = 'false';
      }, 150);
      document.body.dataset.scrolling = 'true';
    };

    document.addEventListener('scroll', optimizedScrollHandler, { passive: true });

    return () => {
      document.removeEventListener('scroll', optimizedScrollHandler);
      clearTimeout(scrollTimeout);
    };
  }, []);
}

/**
 * Performance Budget Monitor
 * Monitors and alerts on performance budget violations
 */
export function usePerformanceBudgetMonitor() {
  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    // Monitor LCP
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEventTiming;
      
      if (lastEntry.startTime > 2500) {
        console.warn(`LCP Budget Violation: ${lastEntry.startTime}ms (budget: 2500ms)`);
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Monitor FID
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fidEntry = entry as PerformanceEventTiming;
        if (fidEntry.processingStart - fidEntry.startTime > 100) {
          console.warn(`FID Budget Violation: ${fidEntry.processingStart - fidEntry.startTime}ms (budget: 100ms)`);
        }
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Monitor CLS
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        const layoutShiftEntry = entry as any;
        if (!layoutShiftEntry.hadRecentInput) {
          clsValue += layoutShiftEntry.value;
        }
      });
      
      if (clsValue > 0.1) {
        console.warn(`CLS Budget Violation: ${clsValue} (budget: 0.1)`);
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    return () => {
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
    };
  }, []);
}