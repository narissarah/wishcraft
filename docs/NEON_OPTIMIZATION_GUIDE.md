# Neon Database Optimization Guide for WishCraft

## Key Neon Features for Built for Shopify Compliance

### 1. **Database Branching for Safe Development**
```bash
# Create a development branch from production
neon branches create --name dev-feature-x --parent main

# Create a temporary branch for testing (auto-expires)
neon branches create --name test-migration --ttl 72h
```

**Benefits for Shopify Apps:**
- Test schema changes without affecting production
- Create isolated environments for each merchant
- Safe rollback capabilities

### 2. **Autoscaling for Traffic Spikes**
Your database automatically scales from 0.25 to 10 Compute Units based on:
- CPU usage
- Memory consumption
- Working set size

**Built for Shopify Benefit:** Handle Black Friday/Cyber Monday traffic automatically

### 3. **Connection Pooling (Critical for Serverless)**
```javascript
// Already implemented in your db.server.ts
const pooledConnectionString = process.env.DATABASE_URL; // Uses PgBouncer
```

**Current Setup:** ✅ You're using the pooled connection URL

### 4. **Performance Monitoring Integration**

Add these to your `app/lib/db-monitoring.server.ts`:
```typescript
import { db } from "~/lib/db.server";

export async function getDatabaseMetrics() {
  // Monitor cache hit rate
  const cacheStats = await db.$queryRaw`
    SELECT * FROM neon_stat_file_cache()
  `;
  
  // Get slow queries
  const slowQueries = await db.$queryRaw`
    SELECT query, mean_exec_time, calls
    FROM pg_stat_statements
    WHERE mean_exec_time > 100
    ORDER BY mean_exec_time DESC
    LIMIT 10
  `;
  
  return { cacheStats, slowQueries };
}

export async function getWorkingSetSize() {
  const result = await db.$queryRaw`
    SELECT 
      sum(heap_blks_read) as reads,
      sum(heap_blks_hit) as hits,
      sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) as hit_rate
    FROM pg_statio_user_tables
  `;
  
  return result;
}
```

### 5. **Read Replicas for Analytics**
```typescript
// For heavy analytics queries
const readReplicaUrl = process.env.DATABASE_URL_READ_REPLICA;

export const analyticsDb = new PrismaClient({
  datasources: {
    db: {
      url: readReplicaUrl,
    },
  },
});
```

### 6. **Neon Serverless Driver for Edge Functions**
```bash
npm install @neondatabase/serverless
```

```typescript
import { neon } from '@neondatabase/serverless';

// For Vercel Edge Functions
export const runtime = 'edge';

const sql = neon(process.env.DATABASE_URL);

export async function GET() {
  const result = await sql`SELECT COUNT(*) FROM registries`;
  return Response.json(result);
}
```

### 7. **Security Best Practices**

#### Enable Full SSL Verification
```typescript
// Already implemented in your connection string
const DATABASE_URL = "postgresql://...?sslmode=require";
```

#### Implement Row-Level Security
```sql
-- Add to your Prisma migrations
ALTER TABLE registries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shops can only see their own registries"
  ON registries
  FOR ALL
  USING (shop_id = current_setting('app.current_shop_id')::text);
```

### 8. **Backup and Recovery Strategy**
```typescript
// Implement point-in-time recovery wrapper
export async function createDatabaseCheckpoint(description: string) {
  // Use Neon API to create a branch as a checkpoint
  const response = await fetch('https://api.neon.tech/v2/projects/YOUR_PROJECT_ID/branches', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEON_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `checkpoint-${Date.now()}`,
      parent: 'main',
      description,
    }),
  });
  
  return response.json();
}
```

### 9. **Multi-Tenant Architecture Optimization**
```typescript
// Use Neon's connection string with application_name
export function getShopConnection(shopId: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('application_name', `shop_${shopId}`);
  
  return new PrismaClient({
    datasources: {
      db: { url: url.toString() }
    },
  });
}
```

### 10. **Development Workflow with Neon CLI**
```bash
# Install Neon CLI
npm install -g neonctl

# Login
neonctl auth

# Create feature branch
neonctl branches create --name feature/new-registry-type

# List branches
neonctl branches list

# Delete branch after merge
neonctl branches delete feature/new-registry-type
```

## Vercel Integration Benefits

1. **Automatic Preview Branches**: Each PR gets its own database
2. **Environment Variables**: Automatically injected
3. **Zero-Config Setup**: Works out of the box

## Cost Optimization Tips

1. **Use Scale-to-Zero**: Your database scales down after 5 minutes of inactivity
2. **Monitor Compute Usage**: Check Neon dashboard for usage patterns
3. **Optimize Queries**: Use the monitoring queries above to find slow queries
4. **Use Caching**: Implement Redis for frequently accessed data

## Monitoring Dashboard Setup

Create a monitoring page at `app/routes/app.admin.monitoring.tsx`:
```typescript
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import { getDatabaseMetrics, getWorkingSetSize } from "~/lib/db-monitoring.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  
  const [metrics, workingSet] = await Promise.all([
    getDatabaseMetrics(),
    getWorkingSetSize(),
  ]);
  
  return json({ metrics, workingSet });
}

export default function Monitoring() {
  const { metrics, workingSet } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <h2>Database Performance</h2>
      <p>Cache Hit Rate: {(workingSet.hit_rate * 100).toFixed(2)}%</p>
      {/* Add more metrics display */}
    </div>
  );
}
```

## Next Steps

1. **Enable pg_stat_statements**: Contact Neon support to enable for query monitoring
2. **Set up Neon CLI**: For branch management in development
3. **Configure Read Replicas**: For heavy analytics queries
4. **Implement Monitoring**: Add the monitoring dashboard
5. **Test Autoscaling**: Load test to verify scaling behavior