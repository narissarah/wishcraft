# 🚀 WishCraft Production Setup Guide
## Built for Shopify Compliant Deployment

This guide walks you through deploying WishCraft to production with Built for Shopify compliance.

---

## 📋 Pre-Deployment Requirements

### Required Accounts & Services
- [ ] **Vercel Account**: For serverless hosting
- [ ] **PostgreSQL Database**: Neon, Supabase, or similar
- [ ] **Shopify Partner Account**: For app registration
- [ ] **Domain Name**: For production URL (optional but recommended)

### Required Environment Variables
```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_SCOPES=read_products,write_customers,read_orders
SHOPIFY_APP_URL=https://your-domain.vercel.app

# Database Configuration (One of these)
DATABASE_URL=postgresql://username:password@host:5432/database
POSTGRES_PRISMA_URL=postgresql://username:password@host:5432/database?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:5432/database

# Security Configuration
SESSION_SECRET=your_32_character_secret_key_here
WEBHOOK_SECRET=your_webhook_secret_from_shopify

# Optional: Performance Monitoring
MONITORING_ENABLED=true
PERFORMANCE_ALERTS=true
```

---

## 🗄️ Database Setup

### Option 1: Neon PostgreSQL (Recommended)
1. Create account at [neon.tech](https://neon.tech)
2. Create new project and database
3. Copy connection strings:
   ```bash
   DATABASE_URL=postgresql://[user]:[password]@[host]/[db]
   POSTGRES_PRISMA_URL=postgresql://[user]:[password]@[host]/[db]?pgbouncer=true
   POSTGRES_URL_NON_POOLING=postgresql://[user]:[password]@[host]/[db]
   ```

### Option 2: Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings > Database
3. Copy connection string and add to environment variables

### Database Schema Deployment
```bash
# Generate Prisma client
npx prisma generate

# Deploy database schema
npx prisma db push

# Verify connection
npm run db:status
```

---

## 🚀 Vercel Deployment

### Step 1: Vercel Project Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to Vercel
vercel --prod
```

### Step 2: Environment Variables
Add all required environment variables in Vercel Dashboard:

1. Go to your project in Vercel Dashboard
2. Navigate to Settings > Environment Variables
3. Add each variable for Production environment:

**Critical Variables:**
```
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret
DATABASE_URL=your_database_url
SESSION_SECRET=your_session_secret
WEBHOOK_SECRET=your_webhook_secret
```

### Step 3: Custom Domain (Optional)
1. In Vercel Dashboard > Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `SHOPIFY_APP_URL` environment variable

---

## 🏪 Shopify App Configuration

### Step 1: Create Shopify App
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Create new app
3. Set app URL: `https://your-domain.vercel.app`
4. Set redirect URL: `https://your-domain.vercel.app/auth/callback`

### Step 2: Configure Webhooks
Add these mandatory GDPR webhooks:

```
Webhook URL: https://your-domain.vercel.app/api/webhooks/customers-data-request
Event: customers/data_request

Webhook URL: https://your-domain.vercel.app/api/webhooks/customers-redact
Event: customers/redact

Webhook URL: https://your-domain.vercel.app/api/webhooks/shop-redact  
Event: shop/redact
```

### Step 3: App Permissions
Set these scopes in Partner Dashboard:
- `read_products` - Access product catalog
- `write_customers` - Customer data management
- `read_orders` - Order tracking

---

## 🧪 Production Verification

### Automated Testing
```bash
# Run comprehensive deployment verification
npm run deploy:verify

# Run performance benchmark
npm run performance:test

# Check system health
npm run health:check
```

### Manual Verification Checklist
- [ ] App installation works correctly
- [ ] Registry creation functions properly
- [ ] Performance test page loads (`/performance`)
- [ ] Health check passes (`/health`)
- [ ] All API endpoints respond correctly
- [ ] Database connections are stable
- [ ] GDPR webhooks are configured

### Performance Validation
Visit these URLs to verify Built for Shopify compliance:
- **Performance Test**: `https://your-domain.vercel.app/performance`
- **Health Check**: `https://your-domain.vercel.app/health`
- **Optimized App**: `https://your-domain.vercel.app/app-optimized`

Expected results:
- LCP ≤ 2.5s (Target: 1.8s)
- CLS ≤ 0.1 (Target: 0.05)
- INP ≤ 200ms (Target: 150ms)

---

## 📊 Monitoring Setup

### Built-in Monitoring
WishCraft includes comprehensive monitoring:
- Real-time Core Web Vitals tracking
- Performance regression detection
- Database connectivity monitoring
- System health checks

### Monitoring Endpoints
- **Health Status**: `/health`
- **Performance Metrics**: `/api/performance-monitor`
- **Core Web Vitals**: `/performance`

### Alerting Configuration
Environment variables for monitoring:
```bash
MONITORING_ENABLED=true
PERFORMANCE_ALERTS=true
ALERT_EMAIL=your-email@domain.com
ALERT_THRESHOLD_LCP=2000  # Alert if LCP > 2s
ALERT_THRESHOLD_TTFB=500  # Alert if TTFB > 500ms
```

---

## 🔒 Security Checklist

### SSL/HTTPS
- [ ] Custom domain has valid SSL certificate
- [ ] All endpoints redirect HTTP to HTTPS
- [ ] Mixed content warnings resolved

### Environment Security
- [ ] All secrets are in environment variables (not hardcoded)
- [ ] Database credentials are secure
- [ ] Webhook secret is configured
- [ ] Session secret is 32+ characters

### App Security
- [ ] CSRF protection enabled
- [ ] Input validation implemented
- [ ] XSS protection active
- [ ] SQL injection prevention verified

---

## 🎯 Built for Shopify Submission

### Performance Documentation
Generate performance report:
```bash
npm run performance:test > performance-report.txt
```

### Required Screenshots
Capture these for App Store listing:
1. **Main Dashboard** - Registry management interface
2. **Performance Test** - Core Web Vitals compliance
3. **Mobile View** - Responsive design demo
4. **Registry Creation** - User-friendly forms
5. **Health Check** - System status display

### Submission Checklist
- [ ] Performance metrics documented
- [ ] GDPR webhooks configured
- [ ] Security measures documented
- [ ] User experience screenshots
- [ ] Technical documentation complete

---

## 🚨 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check database status
curl https://your-domain.vercel.app/api/db-status

# Verify environment variables
vercel env ls
```

**Performance Issues**
```bash
# Run performance benchmark
npm run performance:test

# Check specific endpoint
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.vercel.app/app
```

**Webhook Failures**
```bash
# Test webhook endpoint
curl -X POST https://your-domain.vercel.app/api/webhooks/customers-data-request \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: test" \
  -d '{"test": "data"}'
```

### Performance Optimization
If performance doesn't meet Built for Shopify requirements:

1. **Check TTFB**: Should be ≤ 400ms
   ```bash
   curl -w "%{time_starttransfer}\n" -o /dev/null -s https://your-domain.vercel.app/app
   ```

2. **Optimize Database**: Enable connection pooling
3. **Enable Caching**: Verify cache headers are set
4. **Check Bundle Size**: Use `/app-optimized` version

---

## 📈 Post-Deployment Optimization

### Performance Monitoring
- Monitor Core Web Vitals daily
- Set up alerts for performance regressions
- Track user experience metrics
- Optimize based on real user data

### Built for Shopify Maintenance
- Keep performance metrics above thresholds
- Update security measures regularly
- Maintain GDPR compliance
- Monitor for API changes

### Scaling Considerations
- Database connection pooling
- CDN optimization for static assets
- Edge function deployment
- Global performance consistency

---

## ✅ Deployment Success Criteria

Your deployment is successful when:
- [ ] All automated tests pass
- [ ] Performance metrics meet Built for Shopify requirements
- [ ] Health check returns status 200
- [ ] App installs correctly in test store
- [ ] GDPR webhooks respond correctly
- [ ] Real-time monitoring is active

**🎉 Congratulations! Your Built for Shopify compliant WishCraft app is now live! 🎉**

---

## 📞 Support & Resources

### Documentation
- `APP_STORE_SUBMISSION_CHECKLIST.md` - App Store submission guide
- `BUILT_FOR_SHOPIFY_APPLICATION.md` - Built for Shopify application
- `CORE_WEB_VITALS_OPTIMIZATION.md` - Performance optimization guide

### Testing Scripts
- `scripts/deployment-verification.js` - Comprehensive endpoint testing
- `scripts/performance-benchmark.js` - Performance compliance testing

### Monitoring URLs
- Health: `https://your-domain.vercel.app/health`
- Performance: `https://your-domain.vercel.app/performance`
- App: `https://your-domain.vercel.app/app`

**Built for Shopify Compliance Status**: ✅ **READY**