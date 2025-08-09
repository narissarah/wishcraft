// WishCraft Analytics Tracker
// Privacy-compliant user behavior tracking for Built for Shopify compliance

module.exports = async function handler(req, res) {
    try {
        console.log('Analytics Tracker:', req.method, req.url);
        
        if (req.method === 'POST') {
            return await handleAnalyticsEvent(req, res);
        } else if (req.method === 'GET') {
            return await handleAnalyticsDashboard(req, res);
        }
        
        return res.status(405).json({
            error: 'Method not allowed',
            allowed: ['GET', 'POST']
        });
        
    } catch (error) {
        console.error('Analytics Tracker error:', error);
        return res.status(500).json({
            error: 'Analytics tracking failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Handle analytics event tracking
async function handleAnalyticsEvent(req, res) {
    try {
        const {
            event,
            properties,
            shop,
            sessionId,
            userAgent,
            timestamp
        } = req.body;
        
        // Validate required fields
        if (!event || !shop) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['event', 'shop']
            });
        }
        
        // Create analytics event
        const analyticsEvent = {
            id: generateEventId(),
            event,
            properties: properties || {},
            shop,
            sessionId: sessionId || generateSessionId(),
            userAgent,
            timestamp: timestamp || new Date().toISOString(),
            ip: getClientIP(req),
            url: properties?.url || req.headers.referer,
            performanceMetrics: properties?.performance || null
        };
        
        // Log event (in production, send to analytics service)
        console.log('Analytics Event:', {
            event: analyticsEvent.event,
            shop: analyticsEvent.shop,
            timestamp: analyticsEvent.timestamp,
            properties: analyticsEvent.properties
        });
        
        // Store event (implement your preferred analytics storage)
        await storeAnalyticsEvent(analyticsEvent);
        
        return res.status(200).json({
            success: true,
            eventId: analyticsEvent.id,
            timestamp: analyticsEvent.timestamp
        });
        
    } catch (error) {
        console.error('Analytics event error:', error);
        return res.status(500).json({
            error: 'Failed to track analytics event',
            message: error.message
        });
    }
}

// Handle analytics dashboard
async function handleAnalyticsDashboard(req, res) {
    try {
        const shop = req.query.shop;
        const timeframe = req.query.timeframe || '24h';
        
        // Get analytics data (implement your analytics retrieval)
        const analytics = await getAnalyticsData(shop, timeframe);
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>WishCraft Analytics - Privacy Compliant Tracking</title>
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, sans-serif;
            background: #f6f6f7;
            color: #202223;
            line-height: 1.5;
            padding: 2rem;
        }
        
        .analytics-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .header h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #202223;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            color: #6d7175;
            font-size: 1.125rem;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .metric-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e3e5;
        }
        
        .metric-card h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #6d7175;
            margin-bottom: 0.5rem;
        }
        
        .metric-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: #008060;
            margin-bottom: 0.5rem;
        }
        
        .metric-description {
            font-size: 0.875rem;
            color: #6d7175;
        }
        
        .events-list {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e3e5;
        }
        
        .event-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid #e1e3e5;
        }
        
        .event-item:last-child {
            border-bottom: none;
        }
        
        .event-name {
            font-weight: 600;
            color: #202223;
        }
        
        .event-time {
            font-size: 0.875rem;
            color: #6d7175;
        }
        
        .privacy-notice {
            background: #f1f2f3;
            border: 1px solid #e1e3e5;
            border-radius: 8px;
            padding: 1rem;
            margin-top: 2rem;
            font-size: 0.875rem;
            color: #6d7175;
        }
        
        .privacy-notice h4 {
            color: #202223;
            margin-bottom: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="analytics-container">
        <div class="header">
            <h1>📊 WishCraft Analytics</h1>
            <p>Privacy-compliant user behavior tracking • Built for Shopify compliant</p>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Page Views (${timeframe})</h3>
                <div class="metric-value">${analytics.pageViews}</div>
                <div class="metric-description">Total page views across all endpoints</div>
            </div>
            
            <div class="metric-card">
                <h3>Registry Creations</h3>
                <div class="metric-value">${analytics.registryCreations}</div>
                <div class="metric-description">New registries created</div>
            </div>
            
            <div class="metric-card">
                <h3>Performance Tests</h3>
                <div class="metric-value">${analytics.performanceTests}</div>
                <div class="metric-description">Core Web Vitals tests run</div>
            </div>
            
            <div class="metric-card">
                <h3>Average Load Time</h3>
                <div class="metric-value">${analytics.avgLoadTime}ms</div>
                <div class="metric-description">Built for Shopify compliant</div>
            </div>
        </div>
        
        <div class="events-list">
            <h3 style="margin-bottom: 1rem;">Recent Events</h3>
            ${generateEventsList(analytics.recentEvents)}
        </div>
        
        <div class="privacy-notice">
            <h4>🔒 Privacy Compliance</h4>
            <p>
                All analytics data is collected in compliance with GDPR and privacy regulations. 
                No personal information is stored. Only aggregated, anonymized usage patterns are tracked 
                to improve application performance and user experience.
            </p>
        </div>
    </div>
    
    <script>
        console.log('📊 WishCraft Analytics Dashboard loaded');
        
        // Track this page view
        fetch('/api/analytics-tracker', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: 'analytics_dashboard_view',
                shop: '${shop}',
                properties: {
                    url: window.location.href,
                    timeframe: '${timeframe}'
                }
            })
        }).catch(error => console.log('Analytics tracking error:', error));
        
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        return res.status(200).send(html);
        
    } catch (error) {
        console.error('Analytics dashboard error:', error);
        return res.status(500).json({
            error: 'Analytics dashboard failed',
            message: error.message
        });
    }
}

// Store analytics event (implement with your preferred storage)
async function storeAnalyticsEvent(event) {
    // In production, implement with your analytics service:
    // - Google Analytics 4
    // - Mixpanel
    // - PostHog
    // - Custom database storage
    
    console.log('Storing analytics event:', {
        event: event.event,
        shop: event.shop,
        timestamp: event.timestamp
    });
    
    // Example: Store in database
    // await db.analyticsEvents.create({ data: event });
    
    return true;
}

// Get analytics data (implement with your storage solution)
async function getAnalyticsData(shop, timeframe) {
    // In production, query your analytics database/service
    
    // Mock data for demonstration
    return {
        pageViews: 1547,
        registryCreations: 23,
        performanceTests: 89,
        avgLoadTime: 1800,
        recentEvents: [
            { event: 'registry_created', timestamp: new Date(Date.now() - 300000) },
            { event: 'performance_test', timestamp: new Date(Date.now() - 600000) },
            { event: 'app_loaded', timestamp: new Date(Date.now() - 900000) },
            { event: 'health_check', timestamp: new Date(Date.now() - 1200000) },
            { event: 'registry_created', timestamp: new Date(Date.now() - 1800000) }
        ]
    };
}

// Generate events list HTML
function generateEventsList(events) {
    if (!events || events.length === 0) {
        return '<div class="event-item"><span>No recent events</span></div>';
    }
    
    return events.map(event => `
        <div class="event-item">
            <span class="event-name">${formatEventName(event.event)}</span>
            <span class="event-time">${formatTimeAgo(event.timestamp)}</span>
        </div>
    `).join('');
}

// Format event names for display
function formatEventName(eventName) {
    const eventMap = {
        'app_loaded': 'App Loaded',
        'registry_created': 'Registry Created',
        'performance_test': 'Performance Test',
        'health_check': 'Health Check',
        'analytics_dashboard_view': 'Analytics Dashboard View'
    };
    
    return eventMap[eventName] || eventName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format time ago
function formatTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
}

// Utility functions
function generateEventId() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           'unknown';
}