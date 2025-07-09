# Railway Deployment Checklist for WishCraft

## Pre-Deployment Checklist

### 1. Environment Variables Configuration
Ensure all these environment variables are set in Railway:

#### Required Shopify Variables
- [ ] `SHOPIFY_API_KEY` - From Partners dashboard
- [ ] `SHOPIFY_API_SECRET` - From Partners dashboard  
- [ ] `SHOPIFY_APP_URL` - Set to `https://wishcraft-production.up.railway.app`
- [ ] `SHOPIFY_WEBHOOK_SECRET` - Generate secure random string
- [ ] `SHOPIFY_API_VERSION` - Set to `2025-07`
- [ ] `SCOPES` - Set to `read_customers,read_orders,write_orders,read_products,read_inventory,write_metaobjects`

#### Required Security Variables
- [ ] `SESSION_SECRET` - Generate 32+ character secure string
- [ ] `ENCRYPTION_KEY` - Generate base64 encoded key
- [ ] `JWT_SECRET` - Generate 32+ character secure string

#### Database Configuration
- [ ] `DATABASE_URL` - Ensure it includes `?sslmode=require` for Railway PostgreSQL
  - Format: `postgresql://USER:PASS@HOST:PORT/DB?sslmode=require`

#### Server Configuration
- [ ] `NODE_ENV` - Set to `production`
- [ ] `PORT` - Railway will auto-set this
- [ ] `HOST` - Set to `0.0.0.0`

#### Optional Performance Monitoring
- [ ] `PERFORMANCE_WEBHOOK_URL` - For performance alerts
- [ ] `SECURITY_WEBHOOK_URL` - For security alerts
- [ ] `ENABLE_BUILT_FOR_SHOPIFY_MONITORING` - Set to `true`

### 2. Railway Configuration
- [ ] Remove old `railway.json` file (if exists)
- [ ] Use `deploy/railway.toml` configuration
- [ ] Ensure it points to main `Dockerfile` (not Dockerfile.simple)

### 3. Code Deployment Steps

1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "Fix Railway deployment and Built for Shopify compliance"
   git push origin master
   ```

2. **Deploy to Railway:**
   ```bash
   railway link
   railway up
   ```

3. **Verify deployment:**
   ```bash
   railway logs
   ```

### 4. Post-Deployment Verification

#### Health Checks
- [ ] Visit `https://wishcraft-production.up.railway.app/health`
- [ ] Visit `https://wishcraft-production.up.railway.app/health/db`

#### Shopify App Installation
- [ ] Install app on test store
- [ ] Verify OAuth flow works
- [ ] Test webhook functionality

#### Performance Verification
- [ ] Run Lighthouse audit
- [ ] Check Core Web Vitals:
  - LCP < 2.5s
  - CLS < 0.1
  - INP < 200ms

### 5. Built for Shopify Requirements

#### Security Requirements ✅
- [x] HMAC webhook verification
- [x] Helmet.js security headers
- [x] Rate limiting implemented
- [x] CSRF protection
- [x] Security monitoring service

#### Performance Requirements ✅
- [x] Performance monitoring
- [x] Bundle size limits
- [x] Compression enabled
- [x] Built for Shopify metrics tracking

#### OAuth Scopes
- [x] Using minimal required scopes
- [x] Scopes documented in app configuration

### 6. Common Issues and Solutions

#### 502 Bad Gateway
- Check Railway logs: `railway logs`
- Verify PORT binding in server.js
- Ensure database connection has SSL mode

#### Database Connection Failed
- Verify DATABASE_URL includes `?sslmode=require`
- Check database service is running
- Verify connection pooling settings

#### HMAC Verification Failed
- Ensure SHOPIFY_WEBHOOK_SECRET matches Partners dashboard
- Check webhook URL configuration in Shopify

### 7. Monitoring Commands

```bash
# View logs
railway logs

# Check service status
railway status

# View environment variables
railway variables

# SSH into container (if needed)
railway run bash
```

## Deployment Complete! 🎉

Once all items are checked, your WishCraft app should be successfully deployed and compliant with Built for Shopify requirements.