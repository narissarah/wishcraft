// API endpoint for performance analytics collection (2025 Enhanced)
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { performanceMonitor } from '~/lib/lighthouse-monitoring.server';
import { updateBuiltForShopifyMetrics } from '~/lib/built-for-shopify-monitor.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = await request.json();
    
    // Handle both single metrics and batch metrics
    const metricsArray = data.metrics || [data];
    
    // Collect metrics for Built for Shopify monitoring
    const webVitalsData: Record<string, number> = {};
    
    // Process each metric
    for (const metricData of metricsArray) {
      const { metric: name, value, rating, path, connection, device, timestamp } = metricData;
      
      // Record performance metrics
      switch (name) {
        case 'LCP':
        case 'FID':
        case 'CLS':
        case 'FCP':
        case 'TTFB':
        case 'INP':
          performanceMonitor.recordCoreWebVitals({
            lcp: name === 'LCP' ? value : 0,
            fid: name === 'FID' ? value : 0,
            cls: name === 'CLS' ? value : 0,
            fcp: name === 'FCP' ? value : 0,
            ttfb: name === 'TTFB' ? value : 0,
          });
          
          // Collect for Built for Shopify monitoring
          webVitalsData[name.toLowerCase()] = value;
          break;
        case 'long-task':
          // Record long tasks
          performanceMonitor.recordApiResponseTime('long-task', value);
          break;
        default:
          // Custom metrics
          if (name.startsWith('custom-')) {
            performanceMonitor.recordApiResponseTime(name, value);
          }
      }
      
      // Log for debugging
      console.log(`📊 Performance Metric: ${name}=${value}ms (${rating}) [${device}/${connection}] ${path}`);
    }
    
    // Update Built for Shopify monitoring with collected metrics
    if (Object.keys(webVitalsData).length > 0) {
      await updateBuiltForShopifyMetrics(webVitalsData);
    }
    
    return json({ success: true, processed: metricsArray.length });
  } catch (error) {
    console.error('Failed to store performance metrics:', error);
    return json({ error: 'Failed to store metrics' }, { status: 500 });
  }
}

export async function loader() {
  // Return current performance summary
  try {
    const summary = performanceMonitor.getPerformanceSummary();
    const builtForShopify = performanceMonitor.checkBuiltForShopifyEligibility();
    
    return json({
      ...summary,
      builtForShopify,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get performance summary:', error);
    return json({ error: 'Failed to get metrics' }, { status: 500 });
  }
}