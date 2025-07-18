# Railway Deployment Troubleshooting Guide

## Current Issue
- Build succeeds but health check returns 500 error
- No container startup logs visible
- Error: "An error occurred processing your request"

## Debugging Steps

### 1. Test with Simple Server First
To isolate the issue, deploy the simple test server:

```bash
# Update railway.json to use simple Dockerfile
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.simple"
  }
}
```

Then deploy and check if basic health check works.

### 2. Check Environment Variables
Ensure these are set in Railway dashboard:
- `DATABASE_URL` - PostgreSQL connection string
- `SHOPIFY_API_KEY` - Your Shopify API key
- `SHOPIFY_API_SECRET` - Your Shopify API secret
- `SHOPIFY_APP_URL` - Your app URL (https://your-app.railway.app)
- `SESSION_SECRET` - Random string for sessions
- `ENCRYPTION_KEY` - Random 32-character string

### 3. Common Railway Issues & Solutions

#### Missing Logs
If deployment logs show "No deployment logs":
1. Check Railway CLI: `railway logs`
2. Check Observability tab in Railway dashboard
3. This might be a Railway infrastructure issue

#### Port Configuration
Railway dynamically assigns ports. Ensure your app:
1. Uses `process.env.PORT`
2. Binds to `0.0.0.0` not `localhost`
3. Doesn't hardcode port numbers

#### Health Check Failures
1. Increase timeout in railway.json (current: 300s)
2. Ensure health endpoint returns quickly
3. Don't depend on external services in health check

#### Database Connection
1. Railway PostgreSQL takes time to provision
2. Use connection retry logic
3. Don't fail health check on DB connection

### 4. Build Issues

#### Missing Build Files
Error: "Application build not found"
- Ensure `npm run build` creates `./build/index.js`
- Check Dockerfile copies build correctly
- Verify build command in package.json

#### Module Import Errors
- Use correct import paths
- Ensure all dependencies are installed
- Check for ES module compatibility

### 5. Deployment Commands

```bash
# Deploy with Railway CLI
railway up

# Check logs
railway logs

# Run locally with Railway environment
railway run npm start

# Open Railway dashboard
railway open
```

### 6. Emergency Fixes

If nothing works, try:

1. **Disable Prisma temporarily**:
   - Comment out Prisma imports and database checks
   - Deploy to verify basic server works

2. **Use legacy Node.js runtime**:
   - Change to `FROM node:20-slim` (older version)

3. **Increase memory limits**:
   - Hobby plan has 512MB limit
   - Check if app exceeds memory

4. **Simplify health check**:
   ```javascript
   app.get('/health', (req, res) => {
     res.status(200).send('OK');
   });
   ```

### 7. Working Configuration

Once basic deployment works, gradually add:
1. Database connection
2. Prisma client
3. Remix application
4. Full health checks

## Contact Railway Support

If issues persist:
1. Check Railway status page
2. Post in Railway Discord/Forum
3. Include:
   - Project ID
   - Deployment ID
   - Error messages
   - This troubleshooting log