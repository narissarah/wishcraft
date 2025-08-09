// Shopify-integrated registry API with Neon + Prisma
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('Registry API endpoint called:', req.method, req.url, req.query);
        
        const shop = req.query.shop || req.headers['x-shopify-shop-domain'];
        if (!shop) {
            return res.status(400).json({ error: 'Shop parameter required' });
        }

        const { action } = req.query;
        
        // Route based on action parameter
        switch (action) {
            case 'create':
                return await handleCreateRegistry(req, res, shop);
            case 'list':
                return await handleListRegistries(req, res, shop);
            case 'get':
                return await handleGetRegistry(req, res, shop);
            case 'add-item':
                return await handleAddItem(req, res, shop);
            case 'get-items':
                return await handleGetItems(req, res, shop);
            case 'get-products':
                return await handleGetProducts(req, res, shop);
            case 'mark-purchased':
                return await handleMarkPurchased(req, res, shop);
            case 'analytics':
                return await handleAnalytics(req, res, shop);
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
    } finally {
        await prisma.$disconnect();
    }
}

// Fetch real Shopify products (placeholder - integrate with Shopify Admin API)
async function fetchShopifyProducts(shop, limit = 20) {
    try {
        // Mock data for now - replace with actual Shopify Admin API calls
        const products = [
            {
                id: 'gid://shopify/Product/7982542799032',
                title: 'Ceramic Dinnerware Set - 16 Piece',
                handle: 'ceramic-dinnerware-set-16-piece',
                price: 89.99,
                compare_at_price: 129.99,
                images: [{ src: 'https://images.unsplash.com/photo-1586296835409-fe3fe6b35b56?w=400' }],
                inventory_quantity: 15,
                status: 'active',
                vendor: 'Kitchen Essentials',
                product_type: 'Dinnerware'
            },
            {
                id: 'gid://shopify/Product/7982542799033',
                title: 'Premium Stainless Steel Blender',
                handle: 'premium-stainless-steel-blender',
                price: 199.99,
                compare_at_price: 249.99,
                images: [{ src: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400' }],
                inventory_quantity: 8,
                status: 'active',
                vendor: 'KitchenAid',
                product_type: 'Appliances'
            },
            {
                id: 'gid://shopify/Product/7982542799034',
                title: 'Organic Cotton Bath Towel Set',
                handle: 'organic-cotton-bath-towel-set',
                price: 45.99,
                compare_at_price: 65.99,
                images: [{ src: 'https://images.unsplash.com/photo-1631889993959-41b4b719c1df?w=400' }],
                inventory_quantity: 22,
                status: 'active',
                vendor: 'EcoHome',
                product_type: 'Bath & Body'
            },
            {
                id: 'gid://shopify/Product/7982542799035',
                title: 'Programmable Coffee Maker with Built-in Grinder',
                handle: 'programmable-coffee-maker-built-in-grinder',
                price: 159.99,
                compare_at_price: 199.99,
                images: [{ src: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400' }],
                inventory_quantity: 5,
                status: 'active',
                vendor: 'Cuisinart',
                product_type: 'Appliances'
            },
            {
                id: 'gid://shopify/Product/7982542799036',
                title: 'Smart WiFi Security Camera System',
                handle: 'smart-wifi-security-camera-system',
                price: 129.99,
                compare_at_price: 179.99,
                images: [{ src: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400' }],
                inventory_quantity: 12,
                status: 'active',
                vendor: 'TechSecure',
                product_type: 'Electronics'
            }
        ];

        return products;
        
    } catch (error) {
        console.error('Error fetching Shopify products:', error);
        return [];
    }
}

// Get real products handler
async function handleGetProducts(req, res, shop) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { limit = 20, page = 1, search = '' } = req.query;
    
    try {
        let products = await fetchShopifyProducts(shop, limit);
        
        // Filter by search if provided
        if (search) {
            products = products.filter(product => 
                product.title.toLowerCase().includes(search.toLowerCase()) ||
                product.product_type.toLowerCase().includes(search.toLowerCase()) ||
                product.vendor.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        return res.status(200).json({
            success: true,
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: products.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch products',
            message: error.message
        });
    }
}

// Create registry with Prisma
async function handleCreateRegistry(req, res, shop) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { title, description, eventType, eventDate, visibility = 'public' } = req.body;
    
    if (!title) {
        return res.status(400).json({
            success: false,
            error: 'Title is required'
        });
    }

    try {
        // Generate registry ID and slug
        const registryId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

        // Create registry in database using Prisma
        const registry = await prisma.registry.create({
            data: {
                id: registryId,
                shop: shop,
                title,
                description: description || '',
                slug,
                eventType: eventType || 'general',
                eventDate: eventDate ? new Date(eventDate) : null,
                visibility,
                shareUrl: `https://wishcraft-a4zcu6u5h-narissarahs-projects.vercel.app/registry/${slug}`
            }
        });

        console.log('Registry created in Neon:', registryId, 'for shop:', shop);

        return res.status(201).json({
            success: true,
            message: 'Registry created successfully',
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

// List registries from Neon
async function handleListRegistries(req, res, shop) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        // Build search condition
        const whereClause = {
            shop: shop,
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        // Get registries with item count aggregation
        const [registries, totalCount] = await Promise.all([
            prisma.registry.findMany({
                where: whereClause,
                include: {
                    items: {
                        select: {
                            id: true,
                            price: true,
                            quantity: true,
                            purchased: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: offset
            }),
            prisma.registry.count({ where: whereClause })
        ]);

        // Transform data to include computed fields
        const transformedRegistries = registries.map(registry => {
            const itemCount = registry.items.length;
            const totalValue = registry.items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            const purchasedValue = registry.items.filter(item => item.purchased).reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            const completionRate = itemCount > 0 ? (registry.items.filter(item => item.purchased).length / itemCount * 100) : 0;

            const { items, ...registryData } = registry;
            return {
                ...registryData,
                item_count: itemCount,
                total_value: totalValue,
                purchased_value: purchasedValue,
                completion_rate: Math.round(completionRate * 10) / 10
            };
        });

        return res.status(200).json({
            success: true,
            data: transformedRegistries,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit))
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

// Get single registry
async function handleGetRegistry(req, res, shop) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Registry ID is required'
        });
    }

    try {
        const registry = await prisma.registry.findFirst({
            where: {
                id: id,
                shop: shop
            },
            include: {
                items: {
                    orderBy: { addedAt: 'desc' }
                }
            }
        });
        
        if (!registry) {
            return res.status(404).json({
                success: false,
                error: 'Registry not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: registry,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Get registry error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get registry',
            message: error.message
        });
    }
}

// Add item to registry
async function handleAddItem(req, res, shop) {
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

    try {
        // Verify registry exists and belongs to shop
        const registry = await prisma.registry.findFirst({
            where: {
                id: registryId,
                shop: shop
            }
        });
        
        if (!registry) {
            return res.status(404).json({
                success: false,
                error: 'Registry not found'
            });
        }

        // Get product details
        const products = await fetchShopifyProducts(shop);
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Create item ID
        const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // Add item to database using Prisma
        const item = await prisma.registryItem.create({
            data: {
                id: itemId,
                registryId: registryId,
                productId: product.id,
                productTitle: product.title,
                productHandle: product.handle,
                price: product.price,
                compareAtPrice: product.compare_at_price,
                quantity: parseInt(quantity),
                priority: priority
            }
        });

        // Update registry timestamp
        await prisma.registry.update({
            where: { id: registryId },
            data: { updatedAt: new Date() }
        });

        return res.status(201).json({
            success: true,
            message: 'Item added to registry successfully',
            data: item,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Add item error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to add item to registry',
            message: error.message
        });
    }
}

// Get registry items
async function handleGetItems(req, res, shop) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { registryId } = req.query;
    
    if (!registryId) {
        return res.status(400).json({
            success: false,
            error: 'Registry ID is required'
        });
    }

    try {
        // Get registry with items, verify shop access
        const registry = await prisma.registry.findFirst({
            where: {
                id: registryId,
                shop: shop
            },
            include: {
                items: {
                    orderBy: { addedAt: 'desc' }
                }
            }
        });
        
        if (!registry) {
            return res.status(404).json({
                success: false,
                error: 'Registry not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: registry.items,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Get items error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get registry items',
            message: error.message
        });
    }
}

// Mark item as purchased
async function handleMarkPurchased(req, res, shop) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { itemId, purchasedBy } = req.body;
    
    if (!itemId) {
        return res.status(400).json({
            success: false,
            error: 'Item ID is required'
        });
    }

    try {
        const item = await prisma.registryItem.update({
            where: { id: itemId },
            data: {
                purchased: true,
                purchasedAt: new Date(),
                purchasedBy: purchasedBy
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Item marked as purchased',
            data: item,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Mark purchased error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to mark item as purchased',
            message: error.message
        });
    }
}

// Get analytics data
async function handleAnalytics(req, res, shop) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { days = 30, registryId } = req.query;

    try {
        let analytics;

        if (registryId) {
            // Get analytics for specific registry
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            
            analytics = await prisma.registryAnalytics.groupBy({
                by: ['eventType'],
                where: {
                    registryId: registryId,
                    createdAt: {
                        gte: startDate
                    }
                },
                _count: {
                    id: true
                }
            });
        } else {
            // Get analytics for entire shop
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            
            const shopRegistries = await prisma.registry.findMany({
                where: {
                    shop: shop,
                    createdAt: {
                        gte: startDate
                    }
                },
                include: {
                    items: true
                }
            });
            
            // Calculate shop analytics
            const totalRegistries = shopRegistries.length;
            const allItems = shopRegistries.flatMap(r => r.items);
            const totalItems = allItems.length;
            const purchasedItems = allItems.filter(item => item.purchased).length;
            const totalValue = allItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            const purchasedValue = allItems.filter(item => item.purchased).reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            const totalViews = shopRegistries.reduce((sum, r) => sum + (r.viewCount || 0), 0);
            
            analytics = {
                total_registries: totalRegistries,
                total_items: totalItems,
                purchased_items: purchasedItems,
                total_value: totalValue,
                purchased_value: purchasedValue,
                total_views: totalViews,
                avg_completion_rate: totalItems > 0 ? (purchasedItems / totalItems * 100) : 0
            };
        }

        return res.status(200).json({
            success: true,
            data: analytics,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get analytics',
            message: error.message
        });
    }
}