// Neon + Prisma database connection test endpoint
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🧪 Testing Neon + Prisma database connection...');
        
        const results = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            database: 'Neon PostgreSQL with Prisma',
            tests: []
        };

        // Test 1: Check environment variables
        console.log('Test 1: Environment variables');
        const envTest = {
            name: 'Environment Variables',
            status: 'checking',
            details: {}
        };

        envTest.details.database_url = process.env.DATABASE_URL ? 'SET' : 'MISSING';
        envTest.details.node_env = process.env.NODE_ENV ? 'SET' : 'MISSING';

        envTest.status = envTest.details.database_url === 'SET' ? 'PASSED' : 'FAILED';
        results.tests.push(envTest);

        // Test 2: Database connection
        console.log('Test 2: Database connection');
        const connectionTest = {
            name: 'Database Connection',
            status: 'checking',
            details: {}
        };

        try {
            await prisma.$connect();
            connectionTest.status = 'PASSED';
            connectionTest.details.message = 'Successfully connected to Neon database';
        } catch (error) {
            connectionTest.status = 'FAILED';
            connectionTest.details.error = error.message;
        }
        results.tests.push(connectionTest);

        // Test 3: Query test (simple)
        console.log('Test 3: Simple query');
        const queryTest = {
            name: 'Simple Query Test',
            status: 'checking',
            details: {}
        };

        try {
            const result = await prisma.$queryRaw`SELECT 1 as test_value`;
            queryTest.status = 'PASSED';
            queryTest.details.result = result[0];
            queryTest.details.message = 'Query execution successful';
        } catch (error) {
            queryTest.status = 'FAILED';
            queryTest.details.error = error.message;
        }
        results.tests.push(queryTest);

        // Test 4: Check if tables exist
        console.log('Test 4: Table existence check');
        const tableTest = {
            name: 'Database Tables',
            status: 'checking',
            details: {
                tables: {}
            }
        };

        try {
            // Check if registry table exists by trying to count rows
            const registryCount = await prisma.registry.count();
            tableTest.details.tables.registry = `EXISTS (${registryCount} rows)`;

            const itemCount = await prisma.registryItem.count();
            tableTest.details.tables.registryItem = `EXISTS (${itemCount} rows)`;

            // Try analytics table (might not exist yet)
            try {
                const analyticsCount = await prisma.registryAnalytics.count();
                tableTest.details.tables.registryAnalytics = `EXISTS (${analyticsCount} rows)`;
            } catch (e) {
                tableTest.details.tables.registryAnalytics = 'NOT EXISTS OR ERROR';
            }

            tableTest.status = 'PASSED';
            tableTest.details.message = 'All required tables exist';
        } catch (error) {
            tableTest.status = 'FAILED';
            tableTest.details.error = error.message;
        }
        results.tests.push(tableTest);

        // Test 5: Create and query test data (if connection successful)
        if (connectionTest.status === 'PASSED' && tableTest.status === 'PASSED') {
            console.log('Test 5: CRUD operations test');
            const crudTest = {
                name: 'CRUD Operations',
                status: 'checking',
                details: {}
            };

            try {
                const testId = `test_${Date.now()}`;
                const testSlug = `test-registry-${Date.now()}`;

                // Create test registry
                const testRegistry = await prisma.registry.create({
                    data: {
                        id: testId,
                        shop: 'test-shop.myshopify.com',
                        title: 'Database CRUD Test Registry',
                        description: 'This is a test registry for database validation',
                        slug: testSlug,
                        eventType: 'general',
                        visibility: 'public',
                        shareUrl: `https://test.example.com/registry/${testSlug}`
                    }
                });

                crudTest.details.create = 'SUCCESS';
                crudTest.details.registry_id = testRegistry.id;

                // Read test registry
                const foundRegistry = await prisma.registry.findUnique({
                    where: { id: testId }
                });

                crudTest.details.read = foundRegistry ? 'SUCCESS' : 'FAILED';

                // Update test registry
                const updatedRegistry = await prisma.registry.update({
                    where: { id: testId },
                    data: { title: 'Updated Test Registry' }
                });

                crudTest.details.update = updatedRegistry.title === 'Updated Test Registry' ? 'SUCCESS' : 'FAILED';

                // Clean up - delete test registry
                await prisma.registry.delete({
                    where: { id: testId }
                });

                crudTest.details.delete = 'SUCCESS';
                crudTest.status = 'PASSED';
                crudTest.details.message = 'All CRUD operations successful';

            } catch (error) {
                crudTest.status = 'FAILED';
                crudTest.details.error = error.message;
            }
            results.tests.push(crudTest);
        }

        // Test 6: Performance test
        console.log('Test 6: Performance test');
        const perfTest = {
            name: 'Performance Test',
            status: 'checking',
            details: {}
        };

        try {
            const startTime = Date.now();
            
            // Run a simple aggregation query
            const stats = await prisma.registry.aggregate({
                _count: { id: true },
                where: {
                    shop: { not: null }
                }
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            perfTest.status = 'PASSED';
            perfTest.details.query_duration_ms = duration;
            perfTest.details.total_registries = stats._count.id;
            perfTest.details.performance = duration < 1000 ? 'GOOD' : 'SLOW';
        } catch (error) {
            perfTest.status = 'FAILED';
            perfTest.details.error = error.message;
        }
        results.tests.push(perfTest);

        // Overall result
        const allPassed = results.tests.every(test => test.status === 'PASSED');
        const somePassed = results.tests.some(test => test.status === 'PASSED');

        results.overall_status = allPassed ? 'ALL_TESTS_PASSED' : (somePassed ? 'PARTIAL_SUCCESS' : 'ALL_TESTS_FAILED');
        results.summary = {
            total_tests: results.tests.length,
            passed: results.tests.filter(t => t.status === 'PASSED').length,
            failed: results.tests.filter(t => t.status === 'FAILED').length
        };

        console.log(`🧪 Neon + Prisma test results: ${results.overall_status}`);
        
        return res.status(200).json({
            success: allPassed,
            message: `Database tests completed: ${results.overall_status}`,
            results: results
        });

    } catch (error) {
        console.error('Database test error:', error);
        return res.status(500).json({
            success: false,
            error: 'Database test failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    } finally {
        await prisma.$disconnect();
    }
}