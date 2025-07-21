/**
 * Performance Monitor Component
 * Shopify 2025 compliance - Core Web Vitals tracking
 */

import { useEffect } from 'react';

interface PerformanceMonitorProps {
  enabled?: boolean;
  debug?: boolean;
}

export function PerformanceMonitor({ enabled = true, debug = false }: PerformanceMonitorProps) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Track custom performance marks
    if (window.performance && typeof window.performance.getEntriesByType === 'function') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'mark' && entry.name.startsWith('wishcraft-')) {
            const data = {
              name: entry.name,
              value: entry.startTime,
              rating: 'info',
              delta: 0,
              id: crypto.randomUUID(),
              navigationType: 'navigate',
              timestamp: Date.now(),
              url: window.location.href
            };

            if (debug) {
              // Debug logging removed for production security
            }

            if (navigator.sendBeacon) {
              navigator.sendBeacon('/api/analytics/performance', JSON.stringify(data));
            }
          }
        }
      });
      
      observer.observe({ entryTypes: ['mark', 'measure'] });
    }

  }, [enabled, debug]);

  return null; // This is a monitoring component with no UI
}

export default PerformanceMonitor;