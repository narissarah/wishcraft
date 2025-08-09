// Shopify-integrated registry API with Neon + Prisma (Fixed Model Names)
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

        // Handle different request methods
        if (req.method === 'POST') {
            return await handleCreateRegistry(req, res, shop);
        } else if (req.method === 'GET') {
            const { action } = req.query;
            
            switch (action) {
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
                case 'analytics':
                    return await handleAnalytics(req, res, shop);
                default:
                    // Default GET request lists registries
                    return await handleListRegistries(req, res, shop);
            }
        } else if (req.method === 'PUT') {
            return await handleMarkPurchased(req, res, shop);
        } else {
            return res.status(405).json({
                success: false,
                error: 'Method not allowed'
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

// Create registry with Prisma (Fixed model names)
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

        // First ensure the shop exists in the shops table
        let shopRecord = await prisma.shops.findUnique({
            where: { domain: shop }
        });

        if (!shopRecord) {
            // Create shop record if it doesn't exist
            shopRecord = await prisma.shops.create({
                data: {
                    id: `shop_${Date.now()}`,
                    domain: shop,
                    name: shop.replace('.myshopify.com', ''),
                    currencyCode: 'USD'
                }
            });
        }

        // Create registry in database using correct Prisma model
        const registry = await prisma.registries.create({
            data: {
                id: registryId,
                shopId: shopRecord.id,
                customerId: `customer_${Date.now()}`,
                customerEmail: 'customer@example.com',
                title,
                description: description || '',
                slug,
                eventType: eventType || 'general',
                eventDate: eventDate ? new Date(eventDate) : null,
                visibility,
                updatedAt: new Date()
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

// List registries from Neon (Fixed model names)
async function handleListRegistries(req, res, shop) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        // Get shop record first
        const shopRecord = await prisma.shops.findUnique({
            where: { domain: shop }
        });

        if (!shopRecord) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalCount: 0,
                    totalPages: 0
                },
                timestamp: new Date().toISOString()
            });
        }

        // Build search condition
        const whereClause = {
            shopId: shopRecord.id,
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        // Get registries with item count aggregation (Fixed model names)
        const [registries, totalCount] = await Promise.all([
            prisma.registries.findMany({
                where: whereClause,
                include: {
                    registry_items: {
                        select: {
                            id: true,
                            price: true,
                            quantity: true,
                            quantityPurchased: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: offset
            }),
            prisma.registries.count({ where: whereClause })
        ]);

        // Transform data to include computed fields
        const transformedRegistries = registries.map(registry => {
            const itemCount = registry.registry_items.length;
            const totalValue = registry.registry_items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            const purchasedValue = registry.registry_items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantityPurchased), 0);
            const completionRate = itemCount > 0 ? (registry.registry_items.reduce((sum, item) => sum + item.quantityPurchased, 0) / registry.registry_items.reduce((sum, item) => sum + item.quantity, 0) * 100) : 0;

            const { registry_items, ...registryData } = registry;
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

// Get single registry (Fixed model names)
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
        // Get shop record first
        const shopRecord = await prisma.shops.findUnique({
            where: { domain: shop }
        });

        if (!shopRecord) {
            return res.status(404).json({
                success: false,
                error: 'Shop not found'
            });
        }

        const registry = await prisma.registries.findFirst({
            where: {
                id: id,
                shopId: shopRecord.id
            },
            include: {
                registry_items: {
                    orderBy: { createdAt: 'desc' }
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

// Add item to registry (Fixed model names)
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
        // Get shop record first
        const shopRecord = await prisma.shops.findUnique({
            where: { domain: shop }
        });

        if (!shopRecord) {
            return res.status(404).json({
                success: false,
                error: 'Shop not found'
            });
        }

        // Verify registry exists and belongs to shop
        const registry = await prisma.registries.findFirst({
            where: {
                id: registryId,
                shopId: shopRecord.id
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

        // Add item to database using correct Prisma model
        const item = await prisma.registry_items.create({
            data: {
                id: itemId,
                registryId: registryId,
                productId: product.id,
                productHandle: product.handle,
                productTitle: product.title,
                price: product.price,
                compareAtPrice: product.compare_at_price,
                quantity: parseInt(quantity),
                priority: priority,
                updatedAt: new Date()
            }
        });

        // Update registry timestamp
        await prisma.registries.update({
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

// Get registry items (Fixed model names)
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
        // Get shop record first
        const shopRecord = await prisma.shops.findUnique({
            where: { domain: shop }
        });

        if (!shopRecord) {
            return res.status(404).json({
                success: false,
                error: 'Shop not found'
            });
        }

        // Get registry with items, verify shop access
        const registry = await prisma.registries.findFirst({
            where: {
                id: registryId,
                shopId: shopRecord.id
            },
            include: {
                registry_items: {
                    orderBy: { createdAt: 'desc' }
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
            data: registry.registry_items,
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

// Mark item as purchased (Fixed model names)
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
        const item = await prisma.registry_items.update({
            where: { id: itemId },
            data: {
                quantityPurchased: { increment: 1 },
                updatedAt: new Date()
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

// Get analytics data (Fixed model names)
async function handleAnalytics(req, res, shop) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { days = 30, registryId } = req.query;

    try {
        // Get shop record first
        const shopRecord = await prisma.shops.findUnique({
            where: { domain: shop }
        });

        if (!shopRecord) {
            return res.status(404).json({
                success: false,
                error: 'Shop not found'
            });
        }

        let analytics;

        if (registryId) {
            // Get analytics for specific registry
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            
            analytics = await prisma.analytics_events.groupBy({
                by: ['event'],
                where: {
                    registryId: registryId,
                    timestamp: {
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
            
            const shopRegistries = await prisma.registries.findMany({
                where: {
                    shopId: shopRecord.id,
                    createdAt: {
                        gte: startDate
                    }
                },
                include: {
                    registry_items: true
                }
            });
            
            // Calculate shop analytics
            const totalRegistries = shopRegistries.length;
            const allItems = shopRegistries.flatMap(r => r.registry_items);
            const totalItems = allItems.length;
            const totalQuantityRequested = allItems.reduce((sum, item) => sum + item.quantity, 0);
            const totalQuantityPurchased = allItems.reduce((sum, item) => sum + item.quantityPurchased, 0);
            const totalValue = allItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            const purchasedValue = allItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantityPurchased), 0);
            const totalViews = shopRegistries.reduce((sum, r) => sum + (r.views || 0), 0);
            
            analytics = {
                total_registries: totalRegistries,
                total_items: totalItems,
                purchased_items: totalQuantityPurchased,
                total_value: totalValue,
                purchased_value: purchasedValue,
                total_views: totalViews,
                avg_completion_rate: totalQuantityRequested > 0 ? (totalQuantityPurchased / totalQuantityRequested * 100) : 0
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