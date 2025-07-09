/**
 * Predictive Prefetching for Performance Optimization
 * Intelligent resource preloading based on user behavior patterns
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from '@remix-run/react';
import { prefersReducedMotion } from './semantic-tokens';

// Prefetch strategies
enum PrefetchStrategy {
  ON_HOVER = 'on-hover',
  ON_INTENT = 'on-intent',
  ON_IDLE = 'on-idle',
  ON_VIEWPORT = 'on-viewport',
  PREDICTIVE = 'predictive',
}

// Prefetch priority levels
enum PrefetchPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// User behavior patterns
interface UserBehavior {
  path: string;
  timestamp: number;
  duration: number;
  interactions: number;
  scrollDepth: number;
  exitPath?: string;
}

// Prefetch configuration
interface PrefetchConfig {
  strategy: PrefetchStrategy;
  priority: PrefetchPriority;
  delay?: number;
  conditions?: () => boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// Route patterns and predictions
interface RoutePattern {
  from: string;
  to: string;
  probability: number;
  avgDelay: number;
  conditions: string[];
}

// Prefetch queue item
interface PrefetchQueueItem {
  url: string;
  config: PrefetchConfig;
  createdAt: number;
  retries: number;
}

// Analytics data structure
interface PrefetchAnalytics {
  totalRequests: number;
  successfulPrefetches: number;
  failedPrefetches: number;
  averageResponseTime: number;
  cacheHitRate: number;
  bandwidthSaved: number;
}

/**
 * Predictive Prefetch Manager
 */
class PredictivePrefetchManager {
  private behaviorHistory: UserBehavior[] = [];
  private routePatterns: RoutePattern[] = [];
  private prefetchQueue: PrefetchQueueItem[] = [];
  private prefetchCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private analytics: PrefetchAnalytics = {
    totalRequests: 0,
    successfulPrefetches: 0,
    failedPrefetches: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    bandwidthSaved: 0,
  };
  private maxCacheSize = 50;
  private maxBehaviorHistory = 100;
  private isProcessing = false;

  constructor() {
    this.loadFromStorage();
    this.startAnalytics();
  }

  /**
   * Load data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('wishcraft-prefetch-data');
      if (stored) {
        const data = JSON.parse(stored);
        this.behaviorHistory = data.behaviorHistory || [];
        this.routePatterns = data.routePatterns || [];
        this.analytics = { ...this.analytics, ...data.analytics };
      }
    } catch (error) {
      console.warn('Failed to load prefetch data from storage:', error);
    }
  }

  /**
   * Save data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        behaviorHistory: this.behaviorHistory.slice(-this.maxBehaviorHistory),
        routePatterns: this.routePatterns,
        analytics: this.analytics,
      };
      localStorage.setItem('wishcraft-prefetch-data', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save prefetch data to storage:', error);
    }
  }

  /**
   * Record user behavior
   */
  recordBehavior(behavior: UserBehavior): void {
    this.behaviorHistory.push(behavior);
    
    // Limit history size
    if (this.behaviorHistory.length > this.maxBehaviorHistory) {
      this.behaviorHistory = this.behaviorHistory.slice(-this.maxBehaviorHistory);
    }
    
    this.updateRoutePatterns();
    this.saveToStorage();
  }

  /**
   * Update route patterns based on behavior
   */
  private updateRoutePatterns(): void {
    const transitions: Map<string, { count: number; totalDelay: number }> = new Map();
    
    // Analyze behavior history for patterns
    for (let i = 0; i < this.behaviorHistory.length - 1; i++) {
      const current = this.behaviorHistory[i];
      const next = this.behaviorHistory[i + 1];
      
      if (current.exitPath && next.path) {
        const key = `${current.path}->${next.path}`;
        const existing = transitions.get(key) || { count: 0, totalDelay: 0 };
        const delay = next.timestamp - current.timestamp;
        
        transitions.set(key, {
          count: existing.count + 1,
          totalDelay: existing.totalDelay + delay,
        });
      }
    }
    
    // Update route patterns
    this.routePatterns = Array.from(transitions.entries())
      .map(([key, data]) => {
        const [from, to] = key.split('->');
        return {
          from,
          to,
          probability: data.count / this.behaviorHistory.length,
          avgDelay: data.totalDelay / data.count,
          conditions: this.extractConditions(from, to),
        };
      })
      .filter(pattern => pattern.probability > 0.1) // Only keep patterns with >10% probability
      .sort((a, b) => b.probability - a.probability);
  }

  /**
   * Extract conditions for route transitions
   */
  private extractConditions(from: string, to: string): string[] {
    const conditions: string[] = [];
    
    // Time-based conditions
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) conditions.push('business_hours');
    if (hour >= 18 || hour <= 8) conditions.push('after_hours');
    
    // Route-specific conditions
    if (from.includes('/admin')) conditions.push('admin_context');
    if (to.includes('/registries')) conditions.push('registry_focus');
    if (to.includes('/analytics')) conditions.push('analytics_focus');
    
    return conditions;
  }

  /**
   * Get prefetch predictions for current route
   */
  getPredictions(currentPath: string): RoutePattern[] {
    return this.routePatterns
      .filter(pattern => pattern.from === currentPath)
      .filter(pattern => this.checkConditions(pattern.conditions))
      .slice(0, 5); // Top 5 predictions
  }

  /**
   * Check if conditions are met
   */
  private checkConditions(conditions: string[]): boolean {
    for (const condition of conditions) {
      switch (condition) {
        case 'business_hours':
          const hour = new Date().getHours();
          if (hour < 9 || hour > 17) return false;
          break;
        case 'after_hours':
          const afterHour = new Date().getHours();
          if (afterHour >= 9 && afterHour <= 17) return false;
          break;
        // Add more condition checks as needed
      }
    }
    return true;
  }

  /**
   * Add item to prefetch queue
   */
  addToPrefetchQueue(url: string, config: PrefetchConfig): void {
    // Check if already in queue or cache
    if (this.prefetchQueue.some(item => item.url === url)) return;
    if (this.prefetchCache.has(url)) {
      const cached = this.prefetchCache.get(url)!;
      if (Date.now() - cached.timestamp < cached.ttl) return;
    }

    const item: PrefetchQueueItem = {
      url,
      config,
      createdAt: Date.now(),
      retries: 0,
    };

    // Insert based on priority
    const priorityOrder = [
      PrefetchPriority.URGENT,
      PrefetchPriority.HIGH,
      PrefetchPriority.MEDIUM,
      PrefetchPriority.LOW,
    ];
    
    const insertIndex = this.prefetchQueue.findIndex(
      queueItem => priorityOrder.indexOf(queueItem.config.priority) > 
                  priorityOrder.indexOf(config.priority)
    );
    
    if (insertIndex === -1) {
      this.prefetchQueue.push(item);
    } else {
      this.prefetchQueue.splice(insertIndex, 0, item);
    }

    this.processQueue();
  }

  /**
   * Process prefetch queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.prefetchQueue.length === 0) return;
    
    this.isProcessing = true;
    
    // Check network conditions
    if (!this.shouldPrefetch()) {
      this.isProcessing = false;
      return;
    }

    const item = this.prefetchQueue.shift()!;
    
    try {
      await this.executePrefetch(item);
    } catch (error) {
      console.warn('Prefetch failed:', error);
      
      // Retry logic
      if (item.retries < 3) {
        item.retries++;
        this.prefetchQueue.unshift(item);
      } else {
        this.analytics.failedPrefetches++;
        item.config.onError?.(error as Error);
      }
    }
    
    this.isProcessing = false;
    
    // Process next item
    if (this.prefetchQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Execute prefetch request
   */
  private async executePrefetch(item: PrefetchQueueItem): Promise<void> {
    const startTime = Date.now();
    
    // Apply delay if specified
    if (item.config.delay) {
      await new Promise(resolve => setTimeout(resolve, item.config.delay));
    }
    
    // Check conditions before executing
    if (item.config.conditions && !item.config.conditions()) {
      return;
    }

    // Create prefetch request
    const response = await fetch(item.url, {
      method: 'GET',
      headers: {
        'X-Prefetch': 'true',
        'X-Prefetch-Priority': item.config.priority,
      },
    });

    if (!response.ok) {
      throw new Error(`Prefetch failed: ${response.status}`);
    }

    const data = await response.json();
    const endTime = Date.now();
    
    // Cache the response
    this.prefetchCache.set(item.url, {
      data,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000, // 5 minutes
    });

    // Update analytics
    this.analytics.totalRequests++;
    this.analytics.successfulPrefetches++;
    this.analytics.averageResponseTime = 
      (this.analytics.averageResponseTime + (endTime - startTime)) / 2;

    // Clean up old cache entries
    this.cleanupCache();
    
    item.config.onSuccess?.();
  }

  /**
   * Check if prefetching should be performed
   */
  private shouldPrefetch(): boolean {
    // Check user preferences
    if (prefersReducedMotion()) return false;
    
    // Check connection quality
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return false;
      }
      if (connection.saveData) return false;
    }
    
    // Check device memory
    if ('deviceMemory' in navigator) {
      const memory = (navigator as any).deviceMemory;
      if (memory < 2) return false; // Less than 2GB RAM
    }
    
    // Check if user is idle
    if (document.hidden) return false;
    
    return true;
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    // Remove expired entries
    for (const [url, entry] of this.prefetchCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.prefetchCache.delete(url);
      }
    }
    
    // Remove oldest entries if cache is too large
    if (this.prefetchCache.size > this.maxCacheSize) {
      const entries = Array.from(this.prefetchCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.prefetchCache.size - this.maxCacheSize);
      toRemove.forEach(([url]) => this.prefetchCache.delete(url));
    }
  }

  /**
   * Get cached data
   */
  getCachedData(url: string): any | null {
    const cached = this.prefetchCache.get(url);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.prefetchCache.delete(url);
      return null;
    }
    
    this.analytics.cacheHitRate++;
    return cached.data;
  }

  /**
   * Start analytics tracking
   */
  private startAnalytics(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveToStorage();
      }
    });
    
    // Save analytics periodically
    setInterval(() => {
      this.saveToStorage();
    }, 30000); // Every 30 seconds
  }

  /**
   * Get analytics data
   */
  getAnalytics(): PrefetchAnalytics {
    return { ...this.analytics };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.behaviorHistory = [];
    this.routePatterns = [];
    this.prefetchQueue = [];
    this.prefetchCache.clear();
    this.analytics = {
      totalRequests: 0,
      successfulPrefetches: 0,
      failedPrefetches: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
    };
    localStorage.removeItem('wishcraft-prefetch-data');
  }
}

// Create singleton instance
export const prefetchManager = new PredictivePrefetchManager();

/**
 * React hook for predictive prefetching
 */
export function usePredictivePrefetch() {
  const location = useLocation();
  const navigate = useNavigate();
  const behaviorRef = useRef<UserBehavior | null>(null);
  const [predictions, setPredictions] = useState<RoutePattern[]>([]);

  // Track page behavior
  useEffect(() => {
    const startTime = Date.now();
    let interactions = 0;
    let maxScroll = 0;

    const handleInteraction = () => {
      interactions++;
    };

    const handleScroll = () => {
      const scrollDepth = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      maxScroll = Math.max(maxScroll, scrollDepth);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);
    window.addEventListener('scroll', handleScroll);

    behaviorRef.current = {
      path: location.pathname,
      timestamp: startTime,
      duration: 0,
      interactions: 0,
      scrollDepth: 0,
    };

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('scroll', handleScroll);

      if (behaviorRef.current) {
        const behavior: UserBehavior = {
          ...behaviorRef.current,
          duration: Date.now() - startTime,
          interactions,
          scrollDepth: maxScroll,
          exitPath: location.pathname,
        };

        prefetchManager.recordBehavior(behavior);
      }
    };
  }, [location.pathname]);

  // Get predictions for current route
  useEffect(() => {
    const currentPredictions = prefetchManager.getPredictions(location.pathname);
    setPredictions(currentPredictions);

    // Auto-prefetch high-probability routes
    currentPredictions
      .filter(prediction => prediction.probability > 0.5)
      .forEach(prediction => {
        prefetchManager.addToPrefetchQueue(prediction.to, {
          strategy: PrefetchStrategy.PREDICTIVE,
          priority: PrefetchPriority.MEDIUM,
          delay: Math.min(prediction.avgDelay / 2, 1000),
        });
      });
  }, [location.pathname]);

  const prefetchRoute = useCallback((url: string, config: Partial<PrefetchConfig> = {}) => {
    prefetchManager.addToPrefetchQueue(url, {
      strategy: PrefetchStrategy.ON_INTENT,
      priority: PrefetchPriority.MEDIUM,
      ...config,
    });
  }, []);

  const prefetchOnHover = useCallback((url: string) => {
    prefetchManager.addToPrefetchQueue(url, {
      strategy: PrefetchStrategy.ON_HOVER,
      priority: PrefetchPriority.LOW,
      delay: 100,
    });
  }, []);

  const prefetchOnIdle = useCallback((url: string) => {
    prefetchManager.addToPrefetchQueue(url, {
      strategy: PrefetchStrategy.ON_IDLE,
      priority: PrefetchPriority.LOW,
      delay: 2000,
      conditions: () => !document.hidden,
    });
  }, []);

  const getCachedData = useCallback((url: string) => {
    return prefetchManager.getCachedData(url);
  }, []);

  return {
    predictions,
    prefetchRoute,
    prefetchOnHover,
    prefetchOnIdle,
    getCachedData,
    analytics: prefetchManager.getAnalytics(),
  };
}

/**
 * React hook for hover-based prefetching
 */
export function useHoverPrefetch() {
  const { prefetchOnHover } = usePredictivePrefetch();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback((url: string) => {
    timeoutRef.current = setTimeout(() => {
      prefetchOnHover(url);
    }, 100);
  }, [prefetchOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
}

/**
 * React hook for intersection-based prefetching
 */
export function useIntersectionPrefetch() {
  const { prefetchRoute } = usePredictivePrefetch();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const observeElement = useCallback((element: HTMLElement, url: string) => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const url = entry.target.getAttribute('data-prefetch-url');
              if (url) {
                prefetchRoute(url, {
                  strategy: PrefetchStrategy.ON_VIEWPORT,
                  priority: PrefetchPriority.LOW,
                });
              }
            }
          });
        },
        { threshold: 0.1 }
      );
    }

    element.setAttribute('data-prefetch-url', url);
    observerRef.current.observe(element);
  }, [prefetchRoute]);

  const unobserveElement = useCallback((element: HTMLElement) => {
    if (observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    observeElement,
    unobserveElement,
  };
}

/**
 * Enhanced Link component with predictive prefetching
 */
export function PredictiveLink({ 
  to, 
  children, 
  strategy = PrefetchStrategy.ON_HOVER,
  priority = PrefetchPriority.MEDIUM,
  ...props 
}: {
  to: string;
  children: React.ReactNode;
  strategy?: PrefetchStrategy;
  priority?: PrefetchPriority;
  [key: string]: any;
}) {
  const { prefetchRoute } = usePredictivePrefetch();
  const { onMouseEnter, onMouseLeave } = useHoverPrefetch();

  const handleMouseEnter = useCallback(() => {
    if (strategy === PrefetchStrategy.ON_HOVER) {
      onMouseEnter(to);
    }
  }, [strategy, onMouseEnter, to]);

  const handleMouseLeave = useCallback(() => {
    if (strategy === PrefetchStrategy.ON_HOVER) {
      onMouseLeave();
    }
  }, [strategy, onMouseLeave]);

  const handleFocus = useCallback(() => {
    if (strategy === PrefetchStrategy.ON_INTENT) {
      prefetchRoute(to, { strategy, priority });
    }
  }, [strategy, prefetchRoute, to, priority]);

  return (
    <a
      href={to}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      {...props}
    >
      {children}
    </a>
  );
}

export default prefetchManager;