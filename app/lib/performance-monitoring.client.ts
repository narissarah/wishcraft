// Performance monitoring and analytics for WishCraft
// Real-time Core Web Vitals tracking and performance insights

export interface PerformanceMetrics {
  // Core Web Vitals
  LCP: number | null; // Largest Contentful Paint
  FID: number | null; // First Input Delay
  CLS: number | null; // Cumulative Layout Shift
  
  // Additional metrics
  FCP: number | null; // First Contentful Paint
  TTFB: number | null; // Time to First Byte
  
  // Custom metrics
  pageLoadTime: number;
  domContentLoaded: number;
  jsLoadTime: number;
  cssLoadTime: number;
  
  // User context
  sessionId: string;
  userId?: string;
  page: string;
  userAgent: string;
  timestamp: number;
  
  // Performance context
  connectionType?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface PerformanceEvent {
  type: 'navigation' | 'resource' | 'paint' | 'layout-shift' | 'input' | 'custom';
  name: string;
  duration: number;
  startTime: number;
  metadata?: Record<string, any>;
}

// Performance monitoring class
export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private events: PerformanceEvent[] = [];
  private sessionId: string;
  private observer?: PerformanceObserver;
  private isEnabled = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    if (!this.isEnabled || typeof window === 'undefined') return;

    // Initialize base metrics
    this.metrics = {
      sessionId: this.sessionId,
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      pageLoadTime: 0,
      domContentLoaded: 0,
      jsLoadTime: 0,
      cssLoadTime: 0,
      LCP: null,
      FID: null,
      CLS: null,
      FCP: null,
      TTFB: null
    };

    // Collect device information
    this.collectDeviceInfo();

    // Set up performance observers
    this.setupPerformanceObservers();

    // Monitor page load metrics
    this.monitorPageLoad();

    // Set up periodic reporting
    this.setupReporting();
  }

  private collectDeviceInfo(): void {
    if (typeof navigator !== 'undefined') {
      // Connection information
      const connection = (navigator as any).connection;
      if (connection) {
        this.metrics.connectionType = connection.effectiveType;
      }

      // Device memory
      this.metrics.deviceMemory = (navigator as any).deviceMemory;
      
      // Hardware concurrency
      this.metrics.hardwareConcurrency = navigator.hardwareConcurrency;
    }
  }

  private setupPerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Core Web Vitals observer
      this.observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      // Observe different entry types
      const entryTypes = ['navigation', 'resource', 'paint', 'layout-shift', 'first-input', 'largest-contentful-paint'];
      
      entryTypes.forEach(type => {
        try {
          this.observer!.observe({ type, buffered: true });
        } catch (error) {
          console.debug(`Performance observer type ${type} not supported`);
        }
      });

    } catch (error) {
      console.error('Failed to setup performance observers:', error);
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.handleNavigationTiming(entry as PerformanceNavigationTiming);
        break;
      
      case 'resource':
        this.handleResourceTiming(entry as PerformanceResourceTiming);
        break;
      
      case 'paint':
        this.handlePaintTiming(entry);
        break;
      
      case 'layout-shift':
        this.handleLayoutShift(entry as any);
        break;
      
      case 'first-input':
        this.handleFirstInput(entry as any);
        break;
      
      case 'largest-contentful-paint':
        this.handleLargestContentfulPaint(entry as any);
        break;
    }
  }

  private handleNavigationTiming(entry: PerformanceNavigationTiming): void {
    this.metrics.pageLoadTime = entry.loadEventEnd - entry.loadEventStart;
    this.metrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
    this.metrics.TTFB = entry.responseStart - entry.requestStart;

    this.addEvent({
      type: 'navigation',
      name: 'page-load',
      duration: entry.loadEventEnd - entry.navigationStart,
      startTime: entry.navigationStart,
      metadata: {
        domContentLoaded: this.metrics.domContentLoaded,
        TTFB: this.metrics.TTFB
      }
    });
  }

  private handleResourceTiming(entry: PerformanceResourceTiming): void {
    const resourceType = this.getResourceType(entry.name);
    const duration = entry.responseEnd - entry.startTime;

    if (resourceType === 'script') {
      this.metrics.jsLoadTime = Math.max(this.metrics.jsLoadTime || 0, duration);
    } else if (resourceType === 'stylesheet') {
      this.metrics.cssLoadTime = Math.max(this.metrics.cssLoadTime || 0, duration);
    }

    this.addEvent({
      type: 'resource',
      name: resourceType,
      duration,
      startTime: entry.startTime,
      metadata: {
        url: entry.name,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize
      }
    });
  }

  private handlePaintTiming(entry: PerformanceEntry): void {
    if (entry.name === 'first-contentful-paint') {
      this.metrics.FCP = entry.startTime;
    }

    this.addEvent({
      type: 'paint',
      name: entry.name,
      duration: 0,
      startTime: entry.startTime
    });
  }

  private handleLayoutShift(entry: any): void {
    if (!entry.hadRecentInput) {
      this.metrics.CLS = (this.metrics.CLS || 0) + entry.value;
    }

    this.addEvent({
      type: 'layout-shift',
      name: 'cumulative-layout-shift',
      duration: 0,
      startTime: entry.startTime,
      metadata: {
        value: entry.value,
        hadRecentInput: entry.hadRecentInput
      }
    });
  }

  private handleFirstInput(entry: any): void {
    this.metrics.FID = entry.processingStart - entry.startTime;

    this.addEvent({
      type: 'input',
      name: 'first-input-delay',
      duration: this.metrics.FID,
      startTime: entry.startTime,
      metadata: {
        processingStart: entry.processingStart,
        processingEnd: entry.processingEnd
      }
    });
  }

  private handleLargestContentfulPaint(entry: any): void {
    this.metrics.LCP = entry.startTime;

    this.addEvent({
      type: 'paint',
      name: 'largest-contentful-paint',
      duration: 0,
      startTime: entry.startTime,
      metadata: {
        element: entry.element?.tagName,
        size: entry.size,
        url: entry.url
      }
    });
  }

  private monitorPageLoad(): void {
    if (typeof window === 'undefined') return;

    // Monitor when page is fully loaded
    if (document.readyState === 'loading') {
      window.addEventListener('load', () => {
        this.trackPageLoadComplete();
      });
    } else {
      this.trackPageLoadComplete();
    }

    // Monitor visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sendMetrics();
      }
    });

    // Monitor beforeunload
    window.addEventListener('beforeunload', () => {
      this.sendMetrics();
    });
  }

  private trackPageLoadComplete(): void {
    // Wait a bit for all resources to load
    setTimeout(() => {
      this.sendMetrics();
    }, 100);
  }

  private setupReporting(): void {
    // Send metrics every 30 seconds
    setInterval(() => {
      this.sendMetrics();
    }, 30000);
  }

  // Public methods
  public trackCustomEvent(name: string, duration: number, metadata?: Record<string, any>): void {
    this.addEvent({
      type: 'custom',
      name,
      duration,
      startTime: performance.now(),
      metadata
    });
  }

  public trackUserAction(action: string, target?: string, metadata?: Record<string, any>): void {
    this.addEvent({
      type: 'custom',
      name: 'user-action',
      duration: 0,
      startTime: performance.now(),
      metadata: {
        action,
        target,
        ...metadata
      }
    });
  }

  public trackError(error: Error, context?: Record<string, any>): void {
    this.addEvent({
      type: 'custom',
      name: 'error',
      duration: 0,
      startTime: performance.now(),
      metadata: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...context
      }
    });
  }

  public getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  public getEvents(): PerformanceEvent[] {
    return this.events;
  }

  public async sendMetrics(): Promise<void> {
    if (!this.isEnabled || this.events.length === 0) return;

    const payload = {
      metrics: this.metrics,
      events: this.events,
      timestamp: Date.now()
    };

    try {
      // Use sendBeacon for reliability
      if ('sendBeacon' in navigator) {
        navigator.sendBeacon('/api/analytics/performance', JSON.stringify(payload));
      } else {
        // Fallback to fetch
        fetch('/api/analytics/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {
          // Store for offline sync
          this.storeForOfflineSync(payload);
        });
      }

      // Clear events after sending
      this.events = [];
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
      this.storeForOfflineSync(payload);
    }
  }

  private storeForOfflineSync(payload: any): void {
    try {
      // Store in IndexedDB for offline sync
      if ('indexedDB' in window) {
        const request = indexedDB.open('wishcraft-analytics', 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('performance')) {
            db.createObjectStore('performance', { keyPath: 'id', autoIncrement: true });
          }
        };
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['performance'], 'readwrite');
          const store = transaction.objectStore('performance');
          store.add({ ...payload, id: Date.now() });
        };
      }
    } catch (error) {
      console.error('Failed to store metrics offline:', error);
    }
  }

  // Utility methods
  private addEvent(event: PerformanceEvent): void {
    this.events.push(event);
    
    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
        return 'script';
      case 'css':
        return 'stylesheet';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
      case 'avif':
      case 'svg':
        return 'image';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'eot':
        return 'font';
      default:
        if (url.includes('/api/')) return 'api';
        return 'other';
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public disable(): void {
    this.isEnabled = false;
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  public enable(): void {
    this.isEnabled = true;
    this.initializeMonitoring();
  }
}

// Performance budget checker
export class PerformanceBudget {
  private static budgets = {
    LCP: 2500, // 2.5 seconds
    FID: 100,  // 100ms
    CLS: 0.1,  // 0.1
    FCP: 1800, // 1.8 seconds
    TTFB: 600, // 600ms
    pageLoadTime: 3000, // 3 seconds
    jsLoadTime: 1000,   // 1 second
    cssLoadTime: 500    // 500ms
  };

  public static checkBudget(metrics: PerformanceMetrics): {
    passed: boolean;
    violations: Array<{
      metric: string;
      value: number;
      budget: number;
      severity: 'warning' | 'error';
    }>;
  } {
    const violations: Array<{
      metric: string;
      value: number;
      budget: number;
      severity: 'warning' | 'error';
    }> = [];

    Object.entries(this.budgets).forEach(([metric, budget]) => {
      const value = metrics[metric as keyof PerformanceMetrics] as number;
      if (value && value > budget) {
        violations.push({
          metric,
          value,
          budget,
          severity: value > budget * 1.5 ? 'error' : 'warning'
        });
      }
    });

    return {
      passed: violations.length === 0,
      violations
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
  // Track initial page load
  performanceMonitor.trackCustomEvent('page-init', 0, {
    referrer: document.referrer,
    pathname: window.location.pathname,
    search: window.location.search
  });
}