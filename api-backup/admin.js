// Consolidated admin API endpoint (billing, analytics, settings)
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Admin API endpoint called:', req.method, req.url, req.query);
    
    const { action, shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required'
      });
    }

    // Route based on action parameter
    switch (action) {
      case 'subscription':
        return await handleSubscription(req, res);
      case 'analytics':
        return await handleAnalytics(req, res);
      case 'settings':
        return await handleSettings(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action parameter'
        });
    }

  } catch (error) {
    console.error('Admin API error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin operation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Subscription handler
async function handleSubscription(req, res) {
  const { shop } = req.query;

  if (req.method === 'GET') {
    const subscriptionData = {
      isActive: true,
      planName: 'Basic',
      planPrice: 9.99,
      currency: 'USD',
      billingCycle: 'monthly',
      features: {
        maxRegistries: 100,
        maxItemsPerRegistry: 250,
        analyticsEnabled: true,
        customBranding: false
      },
      usage: {
        registriesCreated: 2,
        itemsAdded: 42,
        views: 231
      }
    };

    return res.status(200).json({
      success: true,
      subscription: subscriptionData,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    const { planName } = req.body;
    const chargeUrl = `https://${shop}.myshopify.com/admin/charges/confirm_recurring_application_charge?charge_id=demo123`;
    
    return res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      confirmationUrl: chargeUrl,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// Analytics handler
async function handleAnalytics(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const analyticsData = {
    overview: {
      totalRegistries: 2,
      activeRegistries: 2,
      totalItems: 42,
      totalViews: 231,
      averageItemsPerRegistry: 21,
      averageViewsPerRegistry: 116
    },
    trends: {
      registriesCreated: 2,
      itemsAdded: 42,
      uniqueVisitors: 189
    },
    topRegistries: [
      {
        id: 'reg_sample1',
        title: 'Sarah & John\'s Wedding Registry',
        views: 142,
        itemCount: 24,
        completionRate: 34.6
      },
      {
        id: 'reg_sample2',
        title: 'Baby Shower for Emma',
        views: 89,
        itemCount: 18,
        completionRate: 37.1
      }
    ],
    recentActivity: [
      { event: 'registry_viewed', timestamp: new Date(), value: 1 },
      { event: 'item_added', timestamp: new Date(), value: 29.99 }
    ]
  };

  return res.status(200).json({
    success: true,
    analytics: analyticsData,
    generatedAt: new Date().toISOString()
  });
}

// Settings handler
async function handleSettings(req, res) {
  if (req.method === 'GET') {
    const settings = {
      enablePasswordProtection: true,
      enableGiftMessages: true,
      enableSocialSharing: true,
      enableGroupGifting: true,
      primaryColor: '#007ace',
      accentColor: '#f3f3f3',
      defaultVisibility: 'public',
      maxItemsPerRegistry: 100
    };

    return res.status(200).json({
      success: true,
      settings,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}