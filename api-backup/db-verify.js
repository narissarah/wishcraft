// Simple database verification endpoint
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Test direct SQL queries instead of Prisma models
        const result = await prisma.$queryRaw`
            SELECT 
                table_name,
                column_name,
                data_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN ('registries', 'registry_items', 'registry_analytics')
            ORDER BY table_name, ordinal_position;
        `;

        const tables = await prisma.$queryRaw`
            SELECT table_name
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('registries', 'registry_items', 'registry_analytics');
        `;

        // Count rows in each table
        const registryCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM registries;`;
        const itemCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM registry_items;`;
        const analyticsCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM registry_analytics;`;

        return res.status(200).json({
            success: true,
            message: 'Database verification successful',
            data: {
                tables_found: tables,
                columns: result,
                row_counts: {
                    registries: registryCount[0].count,
                    registry_items: itemCount[0].count,
                    registry_analytics: analyticsCount[0].count
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Database verification error:', error);
        return res.status(500).json({
            success: false,
            error: 'Database verification failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    } finally {
        await prisma.$disconnect();
    }
}