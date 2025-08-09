// Simple database connection test
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

    try {
        console.log('Testing database connection...');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        console.log('DATABASE_URL preview:', process.env.DATABASE_URL?.substring(0, 50) + '...');

        // Test basic connection
        await prisma.$connect();
        console.log('Database connected successfully');

        // Test a simple query
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('Query result:', result);

        // Try to check if tables exist
        let tables;
        try {
            tables = await prisma.$queryRaw`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            `;
            console.log('Available tables:', tables);
        } catch (tableError) {
            console.log('Could not list tables:', tableError.message);
        }

        res.status(200).json({
            success: true,
            message: 'Database connection successful',
            data: {
                connected: true,
                testQuery: result,
                tables: tables || 'Unable to list tables',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            success: false,
            error: 'Database connection failed',
            message: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        });
    } finally {
        await prisma.$disconnect();
    }
}