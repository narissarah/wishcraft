/**
 * Real User Monitoring (RUM) Integration
 * Advanced client-side performance and user experience monitoring
 */

interface RUMMetrics {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
  inp: number; // Interaction to Next Paint (new metric)
}

interface UserSession {
  sessionId: string;
  userId?: string;
  shopId?: string;
  userAgent: string;
  viewport: { width: number; height: number };
  connection: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  startTime: number;
}

interface BusinessMetrics {
  registryViews: number;
  itemInteractions: number;
  searchQueries: number;
  addToRegistryClicks: number;
  shareRegistryClicks: number;
  conversionEvents: number;
}

class RealUserMonitoring {
  private session: UserSession;
  private metrics: Partial<RUMMetrics> = {};
  private businessMetrics: Partial<BusinessMetrics> = {};
  private errorBuffer: Array<{ error: Error; context: Record<string, any>; timestamp: number }> = [];
  private isInitialized = false;
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.session = this.initializeSession();
    this.initialize();
  }

  /**
   * Initialize RUM monitoring
   */
  private initialize() {
    if (typeof window === 'undefined' || this.isInitialized) return;

    this.setupPerformanceObservers();
    this.setupErrorTracking();
    this.setupUserInteractionTracking();
    this.setupBusinessMetricTracking();
    this.setupNetworkMonitoring();
    this.setupPageVisibilityTracking();
    
    this.isInitialized = true;
    console.log('🔍 RUM monitoring initialized', this.session.sessionId);

    // Send session start event
    this.sendMetric('session_start', {
      sessionId: this.session.sessionId,
      userAgent: this.session.userAgent,
      viewport: this.session.viewport,
      deviceType: this.session.deviceType,
      connection: this.session.connection,
    });

    // Send periodic updates
    setInterval(() => this.sendPeriodicUpdate(), 30000); // Every 30 seconds
    
    // Send final metrics on page unload
    window.addEventListener('beforeunload', () => this.sendFinalMetrics());
  }

  /**
   * Initialize user session
   */
  private initializeSession(): UserSession {
    const sessionId = this.generateSessionId();
    const userAgent = navigator.userAgent;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    
    // Detect device type
    const deviceType = this.detectDeviceType();
    
    // Get connection info
    const connection = this.getConnectionInfo();

    return {
      sessionId,
      userAgent,
      viewport,
      deviceType,
      connection,
      startTime: performance.now(),
    };
  }

  /**
   * Setup Core Web Vitals and performance observers
   */
  private setupPerformanceObservers() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEventTiming;
        this.metrics.lcp = lastEntry.startTime;
        this.sendMetric('core_web_vitals', { metric: 'lcp', value: lastEntry.startTime });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as PerformanceEventTiming;
          const fidValue = fidEntry.processingStart - fidEntry.startTime;
          this.metrics.fid = fidValue;
          this.sendMetric('core_web_vitals', { metric: 'fid', value: fidValue });
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const layoutShiftEntry = entry as any;
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value;
          }
        });
        this.metrics.cls = clsValue;
        this.sendMetric('core_web_vitals', { metric: 'cls', value: clsValue });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

      // First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
            this.sendMetric('core_web_vitals', { metric: 'fcp', value: entry.startTime });
          }
        });
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(fcpObserver);

      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const navEntry = entry as PerformanceNavigationTiming;
          this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
          this.sendMetric('navigation_timing', {
            ttfb: this.metrics.ttfb,
            domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.navigationStart,
            loadComplete: navEntry.loadEventEnd - navEntry.navigationStart,
          });
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);

      // Resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const resourceEntry = entry as PerformanceResourceTiming;
          if (resourceEntry.transferSize > 0) {
            this.sendMetric('resource_timing', {
              name: resourceEntry.name,
              duration: resourceEntry.duration,
              transferSize: resourceEntry.transferSize,
              type: this.getResourceType(resourceEntry.name),
            });
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    }
  }

  /**
   * Setup error tracking
   */
  private setupErrorTracking() {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error, {
        type: 'javascript_error',
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        message: event.message,
      });
    });

    // Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(new Error(event.reason), {
        type: 'unhandled_rejection',
        reason: event.reason,
      });
    });

    // Resource loading errors
    document.addEventListener('error', (event) => {
      const target = event.target as HTMLElement;
      if (target && target.tagName) {
        this.captureError(new Error('Resource loading failed'), {
          type: 'resource_error',
          tagName: target.tagName,
          source: (target as any).src || (target as any).href,
        });
      }
    }, true);
  }

  /**
   * Setup user interaction tracking
   */
  private setupUserInteractionTracking() {
    // Click tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const actionData = this.getActionData(target);
      
      if (actionData) {
        this.sendMetric('user_interaction', {
          type: 'click',
          element: target.tagName,
          ...actionData,
        });
      }
    });

    // Form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.sendMetric('user_interaction', {
        type: 'form_submit',
        formId: form.id,
        action: form.action,
        method: form.method,
      });
    });

    // Scroll depth tracking
    let maxScrollDepth = 0;
    window.addEventListener('scroll', this.throttle(() => {
      const scrollDepth = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      
      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth;
        this.sendMetric('scroll_depth', { depth: scrollDepth });
      }
    }, 250));
  }

  /**
   * Setup business metric tracking
   */
  private setupBusinessMetricTracking() {
    // Registry view tracking
    if (window.location.pathname.includes('/registry/')) {
      this.businessMetrics.registryViews = (this.businessMetrics.registryViews || 0) + 1;
      this.sendMetric('business_metric', {
        type: 'registry_view',
        path: window.location.pathname,
      });
    }

    // Search tracking
    const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="search" i]');
    searchInputs.forEach((input) => {
      input.addEventListener('keyup', this.debounce((event: any) => {
        if (event.target.value.length > 2) {
          this.businessMetrics.searchQueries = (this.businessMetrics.searchQueries || 0) + 1;
          this.sendMetric('business_metric', {
            type: 'search_query',
            query: event.target.value,
            length: event.target.value.length,
          });
        }
      }, 500));
    });

    // Button click tracking
    const trackableButtons = document.querySelectorAll('[data-track]');
    trackableButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const trackingData = button.getAttribute('data-track');
        this.sendMetric('business_metric', {
          type: 'tracked_action',
          action: trackingData,
        });
      });
    });
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring() {
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;
        
        this.sendMetric('network_request', {
          url: this.sanitizeUrl(url),
          method: args[1]?.method || 'GET',
          status: response.status,
          duration,
          size: Number(response.headers.get('content-length')) || 0,
        });
        
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.captureError(error as Error, {
          type: 'network_error',
          url: this.sanitizeUrl(url),
          duration,
        });
        throw error;
      }
    };
  }

  /**
   * Setup page visibility tracking
   */
  private setupPageVisibilityTracking() {
    let visibilityStart = Date.now();
    let totalVisibleTime = 0;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        totalVisibleTime += Date.now() - visibilityStart;
        this.sendMetric('page_visibility', {
          type: 'hidden',
          visibleTime: totalVisibleTime,
        });
      } else {
        visibilityStart = Date.now();
        this.sendMetric('page_visibility', {
          type: 'visible',
        });
      }
    });

    // Track when user leaves the page
    window.addEventListener('beforeunload', () => {
      if (!document.hidden) {
        totalVisibleTime += Date.now() - visibilityStart;
      }
      this.sendMetric('page_visibility', {
        type: 'unload',
        totalVisibleTime,
      });
    });
  }

  /**
   * Capture and store errors
   */
  private captureError(error: Error, context: Record<string, any>) {
    const errorEntry = {
      error,
      context: {
        ...context,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.session.sessionId,
      },
      timestamp: Date.now(),
    };

    this.errorBuffer.push(errorEntry);

    // Send error immediately if critical
    if (context.type === 'javascript_error' || context.type === 'unhandled_rejection') {
      this.sendMetric('error', {
        message: error.message,
        stack: error.stack,
        ...context,
      });
    }

    // Limit buffer size
    if (this.errorBuffer.length > 50) {
      this.errorBuffer = this.errorBuffer.slice(-25);
    }
  }

  /**
   * Send metric to backend
   */
  private sendMetric(type: string, data: Record<string, any>) {
    const payload = {
      type,
      data,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
      url: window.location.href,
      referrer: document.referrer,
      userId: this.session.userId,
      shopId: this.session.shopId,
    };

    // Send via beacon API for reliability
    if ('sendBeacon' in navigator) {
      navigator.sendBeacon('/api/rum/metrics', JSON.stringify(payload));
    } else {
      // Fallback to fetch
      fetch('/api/rum/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Silently fail - don't impact user experience
      });
    }
  }

  /**
   * Send periodic updates
   */
  private sendPeriodicUpdate() {
    this.sendMetric('session_update', {
      metrics: this.metrics,
      businessMetrics: this.businessMetrics,
      errorCount: this.errorBuffer.length,
      sessionDuration: Date.now() - this.session.startTime,
    });
  }

  /**
   * Send final metrics on page unload
   */
  private sendFinalMetrics() {
    this.sendMetric('session_end', {
      finalMetrics: this.metrics,
      businessMetrics: this.businessMetrics,
      totalErrors: this.errorBuffer.length,
      sessionDuration: Date.now() - this.session.startTime,
    });

    // Cleanup observers
    this.observers.forEach((observer) => observer.disconnect());
  }

  /**
   * Utility methods
   */
  private generateSessionId(): string {
    return 'rum_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionInfo(): string {
    const nav = navigator as any;
    if (nav.connection) {
      return nav.connection.effectiveType || nav.connection.type || 'unknown';
    }
    return 'unknown';
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    return 'other';
  }

  private getActionData(element: HTMLElement): Record<string, any> | null {
    // Extract meaningful data from clicked elements
    const data: Record<string, any> = {};

    if (element.id) data.elementId = element.id;
    if (element.className) data.className = element.className;
    if (element.getAttribute('data-action')) data.action = element.getAttribute('data-action');
    if (element.textContent) data.text = element.textContent.trim().substr(0, 50);

    return Object.keys(data).length > 0 ? data : null;
  }

  private sanitizeUrl(url: string): string {
    // Remove sensitive parameters
    try {
      const urlObj = new URL(url, window.location.origin);
      urlObj.searchParams.delete('access_token');
      urlObj.searchParams.delete('api_key');
      urlObj.searchParams.delete('session');
      return urlObj.pathname + (urlObj.search ? '?[params]' : '');
    } catch {
      return url.split('?')[0];
    }
  }

  private throttle(func: Function, delay: number) {
    let timeoutId: number;
    let lastExecTime = 0;
    return function (this: any, ...args: any[]) {
      const currentTime = Date.now();
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  private debounce(func: Function, delay: number) {
    let timeoutId: number;
    return function (this: any, ...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Public API for custom tracking
   */
  public trackCustomEvent(name: string, data: Record<string, any>) {
    this.sendMetric('custom_event', { name, ...data });
  }

  public setUserId(userId: string) {
    this.session.userId = userId;
  }

  public setShopId(shopId: string) {
    this.session.shopId = shopId;
  }

  public getSessionId(): string {
    return this.session.sessionId;
  }

  public getCurrentMetrics(): Partial<RUMMetrics> {
    return { ...this.metrics };
  }
}

// Initialize RUM monitoring
export const rum = new RealUserMonitoring();

// Export for manual usage
export { RealUserMonitoring };

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  // Initialize with slight delay to not impact page load
  setTimeout(() => {
    console.log('🔍 RUM monitoring ready');
  }, 100);
}