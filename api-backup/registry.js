// Consolidated registry API endpoint
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Registry API endpoint called:', req.method, req.url, req.query);
    
    const { action, shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required'
      });
    }

    // Route based on action parameter
    switch (action) {
      case 'create':
        return await handleCreateRegistry(req, res);
      case 'list':
        return await handleListRegistries(req, res);
      case 'add-item':
        return await handleAddItem(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action parameter'
        });
    }

  } catch (error) {
    console.error('Registry API error:', error);
    res.status(500).json({
      success: false,
      error: 'Registry operation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Create registry handler
async function handleCreateRegistry(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { shop, title, description, eventType, eventDate, visibility = 'public' } = req.body;
  
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Title is required'
    });
  }

  // Generate mock registry data
  const registryId = `reg_${Math.random().toString(36).substring(2, 15)}`;
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

  const registry = {
    id: registryId,
    title,
    description,
    slug,
    eventType: eventType || 'general',
    eventDate: eventDate ? new Date(eventDate) : null,
    visibility,
    shareUrl: `https://wishcraft-h7kdbkaky-narissarahs-projects.vercel.app/registry/${slug}`,
    createdAt: new Date().toISOString()
  };

  return res.status(201).json({
    success: true,
    message: 'Registry created successfully',
    registry,
    timestamp: new Date().toISOString()
  });
}

// List registries handler
async function handleListRegistries(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { shop, page = 1, limit = 10 } = req.query;

  // Mock registry data
  const mockRegistries = [
    {
      id: 'reg_sample1',
      title: 'Sarah & John\'s Wedding Registry',
      description: 'Help us celebrate our special day!',
      eventType: 'wedding',
      eventDate: '2025-09-15',
      visibility: 'public',
      itemCount: 24,
      totalValue: 1250.99,
      purchasedValue: 432.50,
      completionRate: 34.6,
      views: 142,
      createdAt: '2025-08-01T10:00:00Z'
    },
    {
      id: 'reg_sample2',
      title: 'Baby Shower for Emma',
      description: 'Welcome our little bundle of joy!',
      eventType: 'baby-shower',
      eventDate: '2025-08-20',
      visibility: 'public',
      itemCount: 18,
      totalValue: 875.25,
      purchasedValue: 324.99,
      completionRate: 37.1,
      views: 89,
      createdAt: '2025-07-15T14:30:00Z'
    }
  ];

  return res.status(200).json({
    success: true,
    registries: mockRegistries,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalCount: mockRegistries.length,
      totalPages: 1
    },
    timestamp: new Date().toISOString()
  });
}

// Add item handler
async function handleAddItem(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { registryId, productId, quantity = 1, priority = 'medium' } = req.body;
  
  if (!registryId || !productId) {
    return res.status(400).json({
      success: false,
      error: 'Registry ID and Product ID are required'
    });
  }

  const item = {
    id: `item_${Math.random().toString(36).substring(2, 15)}`,
    registryId,
    productId,
    productTitle: `Sample Product ${productId}`,
    quantity: parseInt(quantity),
    priority,
    price: 29.99,
    currencyCode: 'USD',
    createdAt: new Date().toISOString()
  };

  return res.status(201).json({
    success: true,
    message: 'Item added to registry successfully',
    item,
    timestamp: new Date().toISOString()
  });
}