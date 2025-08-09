// One-time database setup endpoint for Neon
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed - use POST' });
    }

    try {
        console.log('🚀 Setting up Neon database tables...');
        
        const results = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            database: 'Neon PostgreSQL',
            setup_steps: []
        };

        // Step 1: Test connection
        console.log('Step 1: Testing database connection...');
        try {
            await prisma.$connect();
            results.setup_steps.push({
                step: 'Database Connection',
                status: 'SUCCESS',
                message: 'Connected to Neon database'
            });
        } catch (error) {
            results.setup_steps.push({
                step: 'Database Connection', 
                status: 'FAILED',
                error: error.message
            });
            throw error;
        }

        // Step 2: Create tables using raw SQL (since we can't run migrations)
        console.log('Step 2: Creating database tables...');
        try {
            // Create registries table
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS registries (
                    id VARCHAR(255) PRIMARY KEY,
                    shop VARCHAR(255) NOT NULL,
                    title VARCHAR(500) NOT NULL,
                    description TEXT,
                    slug VARCHAR(500) UNIQUE NOT NULL,
                    "eventType" VARCHAR(100) DEFAULT 'general',
                    "eventDate" TIMESTAMP,
                    visibility VARCHAR(50) DEFAULT 'public',
                    "shareUrl" TEXT,
                    "viewCount" INTEGER DEFAULT 0,
                    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;

            // Create indexes for registries
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_registries_shop ON registries(shop);`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_registries_slug ON registries(slug);`;

            results.setup_steps.push({
                step: 'Registries Table',
                status: 'SUCCESS',
                message: 'Created registries table and indexes'
            });

            // Create registry_items table
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS registry_items (
                    id VARCHAR(255) PRIMARY KEY,
                    "registryId" VARCHAR(255) NOT NULL,
                    "productId" VARCHAR(255) NOT NULL,
                    "productTitle" VARCHAR(500) NOT NULL,
                    "productHandle" VARCHAR(255),
                    price DECIMAL(10, 2) NOT NULL,
                    "compareAtPrice" DECIMAL(10, 2),
                    quantity INTEGER DEFAULT 1,
                    priority VARCHAR(50) DEFAULT 'medium',
                    purchased BOOLEAN DEFAULT FALSE,
                    "purchasedAt" TIMESTAMP,
                    "purchasedBy" VARCHAR(255),
                    notes TEXT,
                    "addedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_registry_items_registry 
                        FOREIGN KEY ("registryId") REFERENCES registries(id) ON DELETE CASCADE
                );
            `;

            // Create indexes for registry_items
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_registry_items_registry_id ON registry_items("registryId");`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_registry_items_product_id ON registry_items("productId");`;

            results.setup_steps.push({
                step: 'Registry Items Table',
                status: 'SUCCESS',
                message: 'Created registry_items table and indexes'
            });

            // Create analytics table
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS registry_analytics (
                    id SERIAL PRIMARY KEY,
                    "registryId" VARCHAR(255) NOT NULL,
                    "eventType" VARCHAR(100) NOT NULL,
                    "eventData" JSONB DEFAULT '{}',
                    "userAgent" TEXT,
                    "ipAddress" VARCHAR(45),
                    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_registry_analytics_registry 
                        FOREIGN KEY ("registryId") REFERENCES registries(id) ON DELETE CASCADE
                );
            `;

            // Create indexes for analytics
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_registry_analytics_registry_id ON registry_analytics("registryId");`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_registry_analytics_event_type ON registry_analytics("eventType");`;

            results.setup_steps.push({
                step: 'Analytics Table',
                status: 'SUCCESS',
                message: 'Created registry_analytics table and indexes'
            });

        } catch (error) {
            results.setup_steps.push({
                step: 'Table Creation',
                status: 'FAILED',
                error: error.message
            });
            throw error;
        }

        // Step 3: Verify tables exist
        console.log('Step 3: Verifying table creation...');
        try {
            const registryCount = await prisma.registry.count();
            const itemCount = await prisma.registryItem.count();
            
            results.setup_steps.push({
                step: 'Table Verification',
                status: 'SUCCESS',
                message: `Tables verified - registries: ${registryCount} rows, items: ${itemCount} rows`
            });

        } catch (error) {
            results.setup_steps.push({
                step: 'Table Verification',
                status: 'FAILED',
                error: error.message
            });
        }

        // Overall result
        const allPassed = results.setup_steps.every(step => step.status === 'SUCCESS');
        
        results.overall_status = allPassed ? 'DATABASE_SETUP_COMPLETE' : 'SETUP_FAILED';
        results.summary = {
            total_steps: results.setup_steps.length,
            successful: results.setup_steps.filter(s => s.status === 'SUCCESS').length,
            failed: results.setup_steps.filter(s => s.status === 'FAILED').length
        };

        console.log(`🚀 Database setup result: ${results.overall_status}`);
        
        return res.status(allPassed ? 200 : 500).json({
            success: allPassed,
            message: `Database setup ${allPassed ? 'completed successfully' : 'failed'}`,
            results: results
        });

    } catch (error) {
        console.error('Database setup error:', error);
        return res.status(500).json({
            success: false,
            error: 'Database setup failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    } finally {
        await prisma.$disconnect();
    }
}