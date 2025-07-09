# Railway Deployment Debugging Guide

This guide helps you debug the 502 error on Railway deployment.

## Quick Debugging Commands

```bash
# 1. Run all debugging scripts locally
npm run debug:all

# 2. Test database connection specifically
npm run debug:db

# 3. Run the debug server (with extensive logging)
npm run debug:server

# 4. Run Railway-specific debugging
npm run debug:deploy
```

## Debugging Steps

### 1. Check Railway Logs
```bash
railway logs --tail 100
```

### 2. Verify Environment Variables in Railway

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SHOPIFY_APP_URL` - Your app's public URL
- `SHOPIFY_API_KEY` - From Shopify Partners
- `SHOPIFY_API_SECRET` - From Shopify Partners
- `SCOPES` - Shopify API scopes
- `PORT` - Usually set automatically by Railway
- `NODE_ENV` - Should be "production"

### 3. Test with Minimal Server

Try deploying with the minimal server first:
```bash
# In package.json, temporarily change start script to:
"start": "node server-minimal.js"
```

This will help identify if the issue is with the server setup or dependencies.

### 4. Common Railway Issues and Solutions

#### Issue: Prisma Client Not Generated
**Symptoms**: Error about @prisma/client not found
**Solution**: 
```bash
# Ensure build command includes:
npx prisma generate
```

#### Issue: Database Connection Fails
**Symptoms**: P1001 error, connection timeout
**Solution**: 
```bash
# Add SSL mode to DATABASE_URL:
postgresql://user:password@host:port/database?sslmode=require
```

#### Issue: Port Binding
**Symptoms**: EADDRINUSE error
**Solution**: Use `process.env.PORT` not hardcoded port

#### Issue: Build Artifacts Missing
**Symptoms**: Cannot find build/index.js
**Solution**: Ensure `npm run build` completes successfully

### 5. Manual Debugging on Railway

1. SSH into Railway (if available):
```bash
railway shell
```

2. Run debugging scripts directly:
```bash
node scripts/debug-railway.js
```

### 6. Database-Specific Debugging

Test different connection configurations:
```bash
# Without SSL
DATABASE_URL=postgresql://user:pass@host/db node scripts/test-db-connection.js

# With SSL
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require node scripts/test-db-connection.js
```

### 7. Build Command Debugging

Try different build commands in railway.json:
```json
{
  "build": {
    "buildCommand": "npm ci && npx prisma generate && npm run build"
  }
}
```

### 8. Memory Issues

If the app runs out of memory during build:
```json
{
  "build": {
    "buildCommand": "NODE_OPTIONS='--max-old-space-size=1024' npm run build"
  }
}
```

## Deployment Checklist

- [ ] All environment variables set in Railway
- [ ] Database URL includes proper SSL settings
- [ ] Prisma client generated during build
- [ ] Build completes without errors
- [ ] Server uses `process.env.PORT`
- [ ] No hardcoded localhost references
- [ ] Health check endpoint responds

## Emergency Fallback

If nothing else works, try the Docker deployment:
```bash
# Use the Dockerfile instead of Nixpacks
railway up --detach
```

## Getting Help

1. Check Railway status: https://status.railway.app/
2. Railway Discord: https://discord.gg/railway
3. Check recent deployment logs for specific errors
4. Run `npm run debug:all` locally with production DATABASE_URL