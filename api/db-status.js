// Simple database status check endpoint
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('Checking database configuration...');
        
        // Check if DATABASE_URL is configured
        const dbUrl = process.env.DATABASE_URL;
        const hasDbUrl = !!dbUrl;
        const dbUrlPreview = hasDbUrl ? dbUrl.substring(0, 30) + '...' : 'NOT_SET';
        
        // Check other required environment variables
        const envVars = {
            DATABASE_URL: hasDbUrl,
            SESSION_SECRET: !!process.env.SESSION_SECRET,
            ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
            SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
            SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
        };

        let status = 'ready';
        let message = 'Database is ready to use';
        
        if (!hasDbUrl) {
            status = 'needs_database_url';
            message = 'DATABASE_URL environment variable not configured';
        } else if (!envVars.SESSION_SECRET || !envVars.ENCRYPTION_KEY) {
            status = 'needs_secrets';
            message = 'Some security environment variables are missing';
        }

        const response = {
            success: status === 'ready',
            status,
            message,
            environment: {
                DATABASE_URL: dbUrlPreview,
                environmentVariables: envVars,
                nodeEnv: process.env.NODE_ENV || 'development'
            },
            nextSteps: getNextSteps(status),
            timestamp: new Date().toISOString()
        };

        console.log('Database status check result:', status);
        
        return res.status(200).json(response);

    } catch (error) {
        console.error('Database status check error:', error);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to check database status',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

function getNextSteps(status) {
    switch (status) {
        case 'needs_database_url':
            return [
                '1. Go to https://console.neon.tech/',
                '2. Create a new project named "wishcraft"',
                '3. Copy the connection string',
                '4. Add DATABASE_URL to Vercel environment variables',
                '5. Redeploy and test again'
            ];
        case 'needs_secrets':
            return [
                '1. Add missing environment variables to Vercel',
                '2. Use the generated secrets from DATABASE_SETUP_GUIDE.md',
                '3. Redeploy and test again'
            ];
        case 'ready':
            return [
                '1. Database is configured!',
                '2. Switch from mock API to real database',
                '3. Test registry creation with persistence'
            ];
        default:
            return ['Check the error message above for details'];
    }
}