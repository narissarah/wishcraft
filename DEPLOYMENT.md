# WishCraft Deployment Guide

## Overview
WishCraft is ready for production deployment on multiple platforms. This guide covers deployment to Railway, Render, and Fly.io - all recommended by Shopify for hosting Shopify apps.

## Pre-Deployment Checklist

### ✅ Build Status
- [x] Application builds successfully
- [x] All dependencies installed
- [x] TypeScript compilation passes
- [x] Database schema migrations ready
- [x] Environment variables configured

### ✅ Production Readiness
- [x] Security headers implemented
- [x] Rate limiting configured
- [x] Error handling implemented
- [x] Health check endpoints available
- [x] Performance monitoring enabled
- [x] Circuit breakers implemented
- [x] Shopify 2025 compliance features

## Environment Variables

Copy `.env.production.example` to `.env.production` and configure:

### Required Variables
```bash
DATABASE_URL="postgresql://..."
SHOPIFY_API_KEY="your-key"
SHOPIFY_API_SECRET="your-secret"
SHOPIFY_APP_URL="https://your-domain.com"
SESSION_SECRET="32-char-random-string"
ENCRYPTION_KEY="32-char-random-string"
```

### Generate Secure Secrets
```bash
openssl rand -hex 32  # For SESSION_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
openssl rand -hex 32  # For CSRF_SECRET
```

## Deployment Options

### 1. Railway (Recommended)

Railway provides automatic deployments with PostgreSQL database included.

#### Setup Steps:
1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize Railway Project:**
   ```bash
   railway init
   railway link
   ```

3. **Add PostgreSQL Database:**
   ```bash
   railway add postgresql
   ```

4. **Set Environment Variables:**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set SESSION_SECRET=$(openssl rand -hex 32)
   railway variables set ENCRYPTION_KEY=$(openssl rand -hex 32)
   railway variables set SHOPIFY_API_KEY=your-key
   railway variables set SHOPIFY_API_SECRET=your-secret
   railway variables set SHOPIFY_APP_URL=https://your-domain.railway.app
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

#### Post-Deployment:
1. Run database migrations:
   ```bash
   railway run npx prisma migrate deploy
   ```

2. Check health:
   ```bash
   curl https://your-domain.railway.app/health
   ```

### 2. Render

Render provides free PostgreSQL and automatic deployments from Git.

#### Setup Steps:
1. **Connect Repository:**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build:**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Environment: `Node`

3. **Add PostgreSQL Database:**
   - Click "New +" → "PostgreSQL"
   - Use the connection string in your web service

4. **Set Environment Variables:**
   Use the Render dashboard to set all required environment variables.

5. **Deploy:**
   Render will automatically deploy on every push to main branch.

### 3. Fly.io

Fly.io provides global edge deployment with PostgreSQL.

#### Setup Steps:
1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Launch App:**
   ```bash
   fly launch
   ```

3. **Create PostgreSQL Database:**
   ```bash
   fly postgres create --name wishcraft-db
   fly postgres attach --app wishcraft wishcraft-db
   ```

4. **Set Environment Variables:**
   ```bash
   fly secrets set SESSION_SECRET=$(openssl rand -hex 32)
   fly secrets set ENCRYPTION_KEY=$(openssl rand -hex 32)
   fly secrets set SHOPIFY_API_KEY=your-key
   fly secrets set SHOPIFY_API_SECRET=your-secret
   ```

5. **Deploy:**
   ```bash
   fly deploy
   ```

## Database Setup

### Run Migrations
After deployment, run database migrations:

```bash
# Railway
railway run npx prisma migrate deploy

# Render
# SSH into your service and run:
npx prisma migrate deploy

# Fly.io
fly ssh console
npx prisma migrate deploy
```

### Verify Database
Check database connection:
```bash
curl https://your-domain.com/health/db
```

## SSL/TLS Configuration

All recommended platforms provide automatic SSL certificates:
- **Railway**: Automatic SSL with custom domains
- **Render**: Free SSL certificates
- **Fly.io**: Automatic SSL with Let's Encrypt

## Domain Configuration

### Custom Domain Setup
1. **Railway**: Add custom domain in dashboard
2. **Render**: Add custom domain in service settings
3. **Fly.io**: Use `fly domains add your-domain.com`

### DNS Configuration
Point your domain to the platform:
- **Railway**: CNAME to `your-app.railway.app`
- **Render**: CNAME to `your-app.onrender.com`
- **Fly.io**: A record to provided IP address

## Monitoring and Health Checks

### Health Endpoints
- `/health` - Application health
- `/health/db` - Database health
- `/api/metrics` - Performance metrics
- `/api/deployment/readiness` - Deployment readiness

### Performance Monitoring
- P95 response time monitoring
- Circuit breaker status
- Error rate tracking
- Memory usage monitoring

## Shopify App Configuration

### Update App URL
In your Shopify Partner dashboard:
1. Navigate to your app
2. Update "App URL" to your production domain
3. Update "Allowed redirection URLs"

### Webhook Configuration
Update webhook endpoints to use your production domain:
```
https://your-domain.com/webhooks/app/uninstalled
https://your-domain.com/webhooks/customers/data_request
https://your-domain.com/webhooks/customers/redact
https://your-domain.com/webhooks/shop/redact
```

## Security Considerations

### Environment Variables
- Never commit `.env` files
- Use platform-specific secret management
- Rotate secrets regularly

### Database Security
- Use connection pooling
- Enable SSL connections
- Regular backups

### Rate Limiting
- Configured for Shopify API compliance
- Automatic rate limit handling
- Circuit breaker protection

## Troubleshooting

### Common Issues

1. **Build Failures:**
   ```bash
   # Check build logs
   npm run build
   
   # Verify dependencies
   npm install
   ```

2. **Database Connection:**
   ```bash
   # Test database connectivity
   curl https://your-domain.com/health/db
   ```

3. **Environment Variables:**
   ```bash
   # Verify all required vars are set
   curl https://your-domain.com/api/deployment/readiness
   ```

### Performance Issues
- Check P95 metrics: `/api/performance/metrics`
- Monitor circuit breaker status
- Review error logs

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificate active
- [ ] Custom domain configured
- [ ] Shopify app URLs updated
- [ ] Webhook endpoints updated
- [ ] Health checks passing
- [ ] Performance monitoring active
- [ ] Error tracking enabled
- [ ] Backup strategy implemented

## Support

For deployment issues:
1. Check the deployment platform's documentation
2. Review application logs
3. Test health endpoints
4. Monitor performance metrics

## Next Steps

After successful deployment:
1. Set up monitoring and alerting
2. Configure backup strategy
3. Plan for scaling
4. Implement CI/CD pipeline
5. Monitor Shopify compliance metrics