# Neon Vercel Integration - Complete Guide

## Your Current Setup ✅

Since you're using the Neon Vercel integration, you automatically get:

### 1. **Automatic Database Branching**
Every pull request and preview deployment gets its own database branch:
- Branch name format: `preview/<your-git-branch>`
- Isolated from production data
- Perfect for testing schema changes

### 2. **Environment Variables (Auto-Injected)**
Vercel automatically injects these for you:
```bash
# Primary (use these)
DATABASE_URL          # Pooled connection (up to 10,000 connections)
DATABASE_URL_UNPOOLED # Direct connection (for migrations)

# Also injected (for compatibility)
PGHOST, PGUSER, PGDATABASE, PGPASSWORD
```

### 3. **Connection Pooling**
- ✅ You're already using the pooled `DATABASE_URL`
- Handles up to 10,000 concurrent connections
- Perfect for serverless functions

## Features You're Getting Automatically

### 1. **Preview Deployments with Isolated Databases**
```
Git Branch → Vercel Preview → Neon Database Branch
main       → Production    → main database
feature/x  → Preview       → preview/feature-x database
```

### 2. **Automatic Scaling**
- **Compute**: Scales from 0.25 to 10 CU based on load
- **Storage**: Unlimited (pay for what you use)
- **Connections**: PgBouncer handles connection pooling

### 3. **Zero-Config Database for Each PR**
When you create a PR:
1. Vercel creates a preview deployment
2. Neon creates a database branch from production
3. Your preview has full data to test with
4. Branch is deleted when PR is closed (if configured)

## Optimizations You Can Enable

### 1. **Automatic Branch Cleanup**
In Vercel Dashboard → Settings → Integrations → Neon:
- Enable "Delete obsolete Neon branches"
- Saves costs by removing unused branches

### 2. **Use Neon Serverless Driver for Edge Functions**
```bash
npm install @neondatabase/serverless
```

```typescript
// app/routes/api.edge-function.ts
import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

export async function loader() {
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql`SELECT COUNT(*) FROM registries`;
  return Response.json(result);
}
```

### 3. **Add Build-Time Migrations**
In `vercel.json`:
```json
{
  "buildCommand": "npm run build && npx prisma migrate deploy"
}
```

### 4. **Monitor Database Performance**
1. Go to [Neon Console](https://console.neon.tech)
2. Click on your project
3. View:
   - Autoscaling graphs
   - Query insights
   - Branch management

## Best Practices for Your Shopify App

### 1. **Database Migrations**
```bash
# For preview branches (automatic)
# Vercel runs migrations on each preview deployment

# For production
# Add to your deployment workflow:
npx prisma migrate deploy
```

### 2. **Testing Schema Changes**
1. Create a feature branch: `git checkout -b feature/new-schema`
2. Push to GitHub
3. Vercel creates preview with isolated database
4. Test your schema changes safely
5. Merge when ready

### 3. **Connection String Usage**
```typescript
// Regular queries (use pooled)
const db = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

// Migrations or long transactions (use direct)
const migrationDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL_UNPOOLED
});
```

### 4. **Debugging Database Issues**
In Vercel Dashboard:
1. Go to Functions tab
2. View runtime logs
3. Check for connection errors

In Neon Console:
1. Go to Monitoring
2. Check active queries
3. View autoscaling graphs

## Advanced Features Available

### 1. **Time Travel Queries**
Query data from any point in the last 30 days:
```sql
SELECT * FROM registries AS OF SYSTEM TIME '-1 day';
```

### 2. **Read Replicas**
For heavy analytics:
1. Create read replica in Neon Console
2. Use for reporting queries
3. Scales independently from primary

### 3. **SQL Editor with AI**
- Access at: console.neon.tech → SQL Editor
- AI-powered query suggestions
- Schema exploration

### 4. **Datadog Integration**
1. Enable in Neon Console → Integrations
2. Get full APM monitoring
3. Track query performance

## Troubleshooting

### Branch Limit Reached
- Check Vercel Deployment Details for warnings
- Enable automatic cleanup
- Manually delete old branches in Neon Console

### Connection Timeouts
- Ensure using pooled connection
- Check if database scaled to zero (will auto-wake)
- Verify connection string format

### Preview Database Empty
- Neon creates branches from your default branch
- Ensure production has data
- Check branch creation logs in Vercel

## Cost Optimization

1. **Enable Auto-Suspend**: Database scales to zero after 5 minutes idle
2. **Delete Unused Branches**: Enable automatic cleanup
3. **Monitor Compute Usage**: Check Neon dashboard
4. **Use Caching**: Reduce database queries with Redis/memory cache

## Your Current Status

✅ **What's Working:**
- Pooled connections configured
- Database branching active
- Auto-scaling enabled
- Preview deployments have isolated databases

🔧 **Recommended Additions:**
1. Enable automatic branch cleanup
2. Add migration command to build process
3. Set up monitoring dashboard
4. Consider Neon serverless driver for edge routes

The Neon Vercel integration gives you enterprise-grade database features with zero configuration!