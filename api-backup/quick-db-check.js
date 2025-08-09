// Quick database check - minimal response
export default function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    
    try {
        const dbUrl = process.env.DATABASE_URL;
        const postgresUrl = process.env.POSTGRES_URL;
        const postgresPrismaUrl = process.env.POSTGRES_PRISMA_URL;
        
        return res.status(200).json({
            timestamp: new Date().toISOString(),
            database_status: {
                DATABASE_URL: dbUrl ? `${dbUrl.substring(0, 30)}...` : 'NOT_SET',
                POSTGRES_URL: postgresUrl ? `${postgresUrl.substring(0, 30)}...` : 'NOT_SET',
                POSTGRES_PRISMA_URL: postgresPrismaUrl ? `${postgresPrismaUrl.substring(0, 30)}...` : 'NOT_SET',
                has_database_url: !!dbUrl,
                has_postgres_url: !!postgresUrl,
                has_postgres_prisma_url: !!postgresPrismaUrl,
                recommendation: !dbUrl && postgresPrismaUrl ? 'ADD: DATABASE_URL=${POSTGRES_PRISMA_URL}' : 'Check URLs above'
            },
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                VERCEL: process.env.VERCEL,
                SESSION_SECRET: !!process.env.SESSION_SECRET,
                SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY
            }
        });
    } catch (error) {
        return res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}