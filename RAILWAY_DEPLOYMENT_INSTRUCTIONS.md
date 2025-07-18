# Railway Deployment Instructions for WishCraft

## 🚀 Quick Deploy

### Method 1: Simple Deployment (Recommended)
1. Use the simple Dockerfile:
   ```bash
   cp Dockerfile.simple Dockerfile
   ```

2. Update `railway.json` to use the simple Dockerfile:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "DOCKERFILE",
       "dockerfilePath": "Dockerfile"
     },
     "deploy": {
       "startCommand": "npm run start:production",
       "healthcheckPath": "/health",
       "healthcheckTimeout": 300,
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 3
     }
   }
   ```

### Method 2: Advanced Deployment (More Features)
1. Use the complex Dockerfile:
   ```bash
   cp Dockerfile.complex Dockerfile
   ```

## 🔧 Environment Variables Setup

### Required Variables
Set these in your Railway dashboard:

```bash
# Core Shopify Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-app.railway.app
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here

# Database (Auto-provided by Railway PostgreSQL)
DATABASE_URL=postgresql://...

# Security (Generate these)
SESSION_SECRET=your_32_char_session_secret_here
JWT_SECRET=your_32_char_jwt_secret_here
ENCRYPTION_KEY=your_32_char_encryption_key_here

# Environment
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

### Optional but Recommended
```bash
# Performance
REDIS_URL=redis://...  # If using Redis addon
SENTRY_DSN=your_sentry_dsn_here

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_GROUP_GIFTING_ENABLED=true
FEATURE_SOCIAL_SHARING_ENABLED=true
```

## 🛠️ Troubleshooting Common Issues

### Issue 1: Build Hangs or Times Out
**Symptoms**: Build process gets stuck during Docker build
**Solution**: 
1. Use the simple Dockerfile
2. Check Railway build logs for memory constraints
3. Reduce Docker build context size

### Issue 2: Prisma Client Generation Fails
**Symptoms**: "Prisma schema validation" errors
**Solution**:
1. Ensure DATABASE_URL is set in Railway
2. Use the complex Dockerfile with Prisma fallbacks
3. Check binary targets in schema.prisma

### Issue 3: Health Check Failures
**Symptoms**: App builds but fails health checks
**Solution**:
1. Ensure /health endpoint exists in your app
2. Increase healthcheckTimeout in railway.json
3. Check server.js for proper health check implementation

### Issue 4: Memory/Resource Constraints
**Symptoms**: Build fails with memory errors
**Solution**:
1. Upgrade Railway plan for more resources
2. Optimize package.json dependencies
3. Use multi-stage Docker builds

## 📋 Pre-Deployment Checklist

- [ ] Environment variables are set in Railway dashboard
- [ ] DATABASE_URL is configured (PostgreSQL addon)
- [ ] SHOPIFY_APP_URL matches your Railway domain
- [ ] Security secrets are generated and set
- [ ] railway.json is configured correctly
- [ ] Dockerfile is optimized for Railway
- [ ] Health check endpoint is implemented
- [ ] Build process completes locally

## 🚨 Emergency Rollback

If deployment fails:
1. Check Railway logs for specific errors
2. Revert to previous working Dockerfile
3. Use Railway's rollback feature
4. Verify environment variables

## 📊 Performance Optimization

### Build Performance
- Use .dockerignore to exclude unnecessary files
- Leverage Docker layer caching
- Minimize build context size

### Runtime Performance
- Enable Node.js clustering
- Use Redis for caching
- Implement proper error handling

## 🔍 Debugging Steps

1. **Check Railway Logs**: Look for specific error messages
2. **Verify Environment**: Ensure all required variables are set
3. **Test Locally**: Run `npm run build` and `npm run start:production`
4. **Database Connection**: Verify DATABASE_URL is accessible
5. **Health Check**: Test /health endpoint manually

## 🌟 2025 Shopify Compliance Notes

- Uses GraphQL API (2025-07 version)
- Implements proper webhook security
- Follows Built for Shopify standards
- Includes performance monitoring
- GDPR/privacy compliance ready

## 📞 Support

If you encounter issues:
1. Check Railway status page
2. Review build logs carefully
3. Verify environment variables
4. Test build process locally
5. Consult Shopify app development docs

## 🔄 Continuous Deployment

Railway will automatically redeploy when you push to your connected Git branch. Ensure:
- Tests pass before pushing
- Environment variables are updated if needed
- Health checks are working
- Database migrations are handled properly