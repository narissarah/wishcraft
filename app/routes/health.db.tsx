// Database health check endpoint
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function loader({ request }: LoaderFunctionArgs) {
  const start = Date.now();
  
  try {
    // Test database connectivity with a simple query
    await prisma.$queryRaw`SELECT 1 as test`;
    
    const responseTime = Date.now() - start;
    
    const health = {
      status: 'healthy',
      service: 'database',
      timestamp: new Date().toISOString(),
      responseTime,
      details: {
        provider: 'postgresql',
        connectionPool: {
          // Add connection pool stats if available
          active: 'N/A',
          idle: 'N/A',
          waiting: 'N/A'
        }
      }
    };

    return json(health, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - start;
    
    return json(
      {
        status: 'unhealthy',
        service: 'database',
        timestamp: new Date().toISOString(),
        responseTime,
        error: error instanceof Error ? error.message : 'Database connection failed'
      },
      { status: 503 }
    );
  } finally {
    await prisma.$disconnect();
  }
}