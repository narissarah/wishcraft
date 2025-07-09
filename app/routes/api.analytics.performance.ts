// API endpoint for performance analytics collection
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { performanceAnalytics } from '~/lib/performance-dashboard.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = await request.json();
    
    // Validate the incoming data
    if (!data.metrics || !data.events) {
      return json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Store the performance metrics
    await performanceAnalytics.storeMetrics({
      sessionId: data.metrics.sessionId,
      userId: data.metrics.userId,
      page: data.metrics.page,
      userAgent: data.metrics.userAgent,
      timestamp: data.timestamp,
      
      // Core Web Vitals
      LCP: data.metrics.LCP,
      FID: data.metrics.FID,
      CLS: data.metrics.CLS,
      FCP: data.metrics.FCP,
      TTFB: data.metrics.TTFB,
      
      // Performance metrics
      pageLoadTime: data.metrics.pageLoadTime,
      domContentLoaded: data.metrics.domContentLoaded,
      jsLoadTime: data.metrics.jsLoadTime,
      cssLoadTime: data.metrics.cssLoadTime,
      
      // Device info
      connectionType: data.metrics.connectionType,
      deviceMemory: data.metrics.deviceMemory,
      hardwareConcurrency: data.metrics.hardwareConcurrency,
      
      // Events
      events: data.events
    });

    return json({ success: true });
  } catch (error) {
    console.error('Failed to store performance metrics:', error);
    return json({ error: 'Failed to store metrics' }, { status: 500 });
  }
}

export async function loader() {
  return json({ error: 'Method not allowed' }, { status: 405 });
}