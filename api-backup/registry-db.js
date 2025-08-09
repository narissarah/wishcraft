// Registry API with direct database connection
const { PrismaClient } = require('@prisma/client');

// Use any of the available Postgres URLs from Vercel
const getDatabaseUrl = () => {
  return process.env.DATABASE_URL || 
         process.env.POSTGRES_PRISMA_URL || 
         process.env.POSTGRES_URL || 
         process.env.POSTGRES_URL_NON_POOLING;
};

let prisma;

try {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl()
      }
    }
  });
} catch (error) {
  console.error('Prisma initialization error:', error);
  prisma = null;
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('Registry DB API:', req.method, req.url);
        
        const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'demo.myshopify.com';
        
        // Check if database is available
        if (!prisma) {
            return res.status(500).json({
                success: false,
                error: 'Database not configured',
                message: 'No database URL found in environment variables',
                availableUrls: {
                    DATABASE_URL: !!process.env.DATABASE_URL,
                    POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
                    POSTGRES_URL: !!process.env.POSTGRES_URL,
                    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING
                }
            });
        }

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
        console.error('Registry DB API error:', error);
        res.status(500).json({
            success: false,
            error: 'Registry operation failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Create registry in database
async function handleCreateRegistry(req, res, shop) {
    const { title, description, eventType, eventDate, visibility = 'public' } = req.body;
    
    if (!title) {
        return res.status(400).json({
            success: false,
            error: 'Title is required'
        });
    }

    try {
        // Connect to database
        await prisma.$connect();
        
        // Create or get shop
        const shopRecord = await prisma.shops.upsert({
            where: { domain: shop },
            update: { 
                name: shop,
                updatedAt: new Date()
            },
            create: {
                id: `shop_${Date.now()}`,
                domain: shop,
                name: shop,
                currencyCode: 'USD',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });

        // Generate registry data
        const registryId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

        // Create registry in database
        const registry = await prisma.registries.create({
            data: {
                id: registryId,
                title,
                description: description || '',
                slug,
                eventType: eventType || 'general',
                eventDate: eventDate ? new Date(eventDate) : null,
                visibility,
                shopId: shopRecord.id,
                customerId: `customer_${Date.now()}`,
                customerEmail: 'customer@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });

        console.log('Registry created in database:', registryId, 'for shop:', shop);

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
            message: error.message,
            dbError: error.code || 'Unknown database error'
        });
    } finally {
        await prisma?.$disconnect();
    }
}

// List registries from database
async function handleListRegistries(req, res, shop) {
    try {
        // Connect to database
        await prisma.$connect();
        
        // Get shop
        const shopRecord = await prisma.shops.findUnique({
            where: { domain: shop }
        });

        if (!shopRecord) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No shop found, returning empty list',
                timestamp: new Date().toISOString()
            });
        }

        // Get registries for this shop
        const registries = await prisma.registries.findMany({
            where: { shopId: shopRecord.id },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Found ${registries.length} registries for shop:`, shop);

        return res.status(200).json({
            success: true,
            data: registries,
            pagination: {
                page: 1,
                limit: 50,
                totalCount: registries.length,
                totalPages: 1
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('List registries error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch registries',
            message: error.message,
            dbError: error.code || 'Unknown database error'
        });
    } finally {
        await prisma?.$disconnect();
    }
}