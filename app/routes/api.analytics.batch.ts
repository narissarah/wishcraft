// API endpoint for batch analytics collection (offline sync)
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { performanceAnalytics } from '~/lib/performance-dashboard.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = await request.json();
    
    // Validate the incoming data
    if (!data.events || !Array.isArray(data.events)) {
      return json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Process batch of analytics events
    for (const event of data.events) {
      await performanceAnalytics.storeMetrics({
        sessionId: event.sessionId,
        userId: event.userId,
        page: event.page,
        userAgent: event.userAgent,
        timestamp: event.timestamp,
        
        // Event data
        eventType: event.type,
        eventName: event.name,
        eventData: event.data,
        
        // Mark as synced offline event
        syncedOffline: true
      });
    }

    return json({ 
      success: true, 
      processed: data.events.length 
    });
  } catch (error) {
    console.error('Failed to process batch analytics:', error);
    return json({ error: 'Failed to process batch' }, { status: 500 });
  }
}

export async function loader() {
  return json({ error: 'Method not allowed' }, { status: 405 });
}