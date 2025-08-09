// Simple registry API without database (temporary solution)
module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('Registry Simple API:', req.method, req.url);
        
        const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'demo.myshopify.com';
        
        // Handle different request methods
        if (req.method === 'POST') {
            return await handleCreateRegistry(req, res, shop);
        } else if (req.method === 'GET') {
            return await handleListRegistries(req, res, shop);
        } else {
            return res.status(405).json({
                success: false,
                error: 'Method not allowed'
            });
        }

    } catch (error) {
        console.error('Registry Simple API error:', error);
        res.status(500).json({
            success: false,
            error: 'Registry operation failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Create registry (in-memory for now)
async function handleCreateRegistry(req, res, shop) {
    const { title, description, eventType, eventDate, visibility = 'public' } = req.body;
    
    if (!title) {
        return res.status(400).json({
            success: false,
            error: 'Title is required'
        });
    }

    try {
        // Generate mock registry
        const registryId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

        const registry = {
            id: registryId,
            shopId: shop,
            customerId: `customer_${Date.now()}`,
            customerEmail: 'customer@example.com',
            title,
            description: description || '',
            slug,
            eventType: eventType || 'general',
            eventDate: eventDate ? new Date(eventDate).toISOString() : null,
            visibility,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            item_count: 0,
            total_value: 0,
            purchased_value: 0,
            completion_rate: 0
        };

        console.log('Mock registry created:', registryId, 'for shop:', shop);

        return res.status(201).json({
            success: true,
            message: 'Registry created successfully (demo mode)',
            data: registry,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Create registry error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create registry',
            message: error.message
        });
    }
}

// List registries (mock data)
async function handleListRegistries(req, res, shop) {
    try {
        // Return sample registries
        const sampleRegistries = [
            {
                id: 'reg_sample_1',
                shopId: shop,
                title: 'Sarah & John\'s Wedding Registry',
                description: 'Help us celebrate our special day!',
                eventType: 'wedding',
                eventDate: '2024-09-15T00:00:00.000Z',
                visibility: 'public',
                createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
                updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
                item_count: 12,
                total_value: 2450.00,
                purchased_value: 890.00,
                completion_rate: 36.3
            },
            {
                id: 'reg_sample_2',
                shopId: shop,
                title: 'Baby Emma\'s Shower Registry',
                description: 'Welcome baby Emma with these essentials!',
                eventType: 'baby_shower',
                eventDate: '2024-08-20T00:00:00.000Z',
                visibility: 'private',
                createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
                updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
                item_count: 8,
                total_value: 675.00,
                purchased_value: 450.00,
                completion_rate: 66.7
            }
        ];

        return res.status(200).json({
            success: true,
            data: sampleRegistries,
            pagination: {
                page: 1,
                limit: 10,
                totalCount: sampleRegistries.length,
                totalPages: 1
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('List registries error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch registries',
            message: error.message
        });
    }
}