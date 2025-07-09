// Performance monitoring initialization script
// This script is loaded early to capture all performance metrics

(function() {
  'use strict';

  // Early performance tracking
  const startTime = performance.now();
  const sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  let metrics = {
    sessionId: sessionId,
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    LCP: null,
    FID: null,
    CLS: null,
    FCP: null,
    TTFB: null,
    pageLoadTime: 0,
    domContentLoaded: 0,
    jsLoadTime: 0,
    cssLoadTime: 0
  };

  let events = [];
  let observer;

  // Collect device information
  if (navigator.connection) {
    metrics.connectionType = navigator.connection.effectiveType;
  }
  if (navigator.deviceMemory) {
    metrics.deviceMemory = navigator.deviceMemory;
  }
  if (navigator.hardwareConcurrency) {
    metrics.hardwareConcurrency = navigator.hardwareConcurrency;
  }

  // Performance observer for Core Web Vitals
  if ('PerformanceObserver' in window) {
    try {
      observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          switch (entry.entryType) {
            case 'navigation':
              const navEntry = entry;
              metrics.pageLoadTime = navEntry.loadEventEnd - navEntry.loadEventStart;
              metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
              metrics.TTFB = navEntry.responseStart - navEntry.requestStart;
              break;
              
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                metrics.FCP = entry.startTime;
              }
              break;
              
            case 'largest-contentful-paint':
              metrics.LCP = entry.startTime;
              break;
              
            case 'first-input':
              metrics.FID = entry.processingStart - entry.startTime;
              break;
              
            case 'layout-shift':
              if (!entry.hadRecentInput) {
                metrics.CLS = (metrics.CLS || 0) + entry.value;
              }
              break;
          }

          events.push({
            type: entry.entryType,
            name: entry.name || entry.entryType,
            duration: entry.duration || 0,
            startTime: entry.startTime,
            metadata: {
              entryType: entry.entryType
            }
          });
        }
      });

      // Observe different entry types
      const entryTypes = ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'];
      entryTypes.forEach(type => {
        try {
          observer.observe({ type, buffered: true });
        } catch (e) {
          // Silently fail for unsupported types
        }
      });
    } catch (error) {
      console.debug('Performance observer setup failed:', error);
    }
  }

  // Send metrics function
  function sendMetrics() {
    if (events.length === 0 && !metrics.LCP && !metrics.FID && !metrics.CLS) {
      return; // No meaningful data to send
    }

    const payload = {
      metrics: metrics,
      events: events,
      timestamp: Date.now()
    };

    try {
      if ('sendBeacon' in navigator) {
        navigator.sendBeacon('/api/analytics/performance', JSON.stringify(payload));
      } else {
        fetch('/api/analytics/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {
          // Store for offline sync if available
          if ('indexedDB' in window) {
            try {
              const request = indexedDB.open('wishcraft-analytics', 1);
              request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('performance')) {
                  db.createObjectStore('performance', { keyPath: 'id', autoIncrement: true });
                }
              };
              request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['performance'], 'readwrite');
                const store = transaction.objectStore('performance');
                store.add({ ...payload, id: Date.now() });
              };
            } catch (e) {
              // Silently fail
            }
          }
        });
      }
    } catch (error) {
      console.debug('Failed to send performance metrics:', error);
    }
  }

  // Send metrics on various events
  window.addEventListener('load', () => {
    // Wait a bit for all metrics to be collected
    setTimeout(sendMetrics, 100);
  });

  window.addEventListener('beforeunload', sendMetrics);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sendMetrics();
    }
  });

  // Periodic sending
  setInterval(() => {
    if (events.length > 0) {
      sendMetrics();
      events = []; // Clear events after sending
    }
  }, 30000);

  // Track user interactions
  function trackUserAction(action, target) {
    events.push({
      type: 'custom',
      name: 'user-action',
      duration: 0,
      startTime: performance.now(),
      metadata: {
        action: action,
        target: target,
        pathname: window.location.pathname
      }
    });
  }

  // Track errors
  window.addEventListener('error', (event) => {
    events.push({
      type: 'custom',
      name: 'error',
      duration: 0,
      startTime: performance.now(),
      metadata: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }
    });
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    events.push({
      type: 'custom',
      name: 'unhandled-rejection',
      duration: 0,
      startTime: performance.now(),
      metadata: {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      }
    });
  });

  // Expose tracking function globally
  window.wishcraftPerformance = {
    trackUserAction: trackUserAction,
    sendMetrics: sendMetrics,
    getMetrics: () => ({ ...metrics }),
    getEvents: () => [...events]
  };

  // Track initial page view
  trackUserAction('page-view', window.location.pathname);

})();