# WishCraft Vercel Deployment Checklist

## Pre-Deployment Verification ✓

### Code Quality Checks
- [x] No console statements in production code
- [x] All imports correctly reference centralized config
- [x] TypeScript compilation successful (after fixes)
- [x] CSRF protection added to all API endpoints
- [x] Rate limiting added to CSP report endpoint

### Database Preparation
- [ ] Backup current database
- [ ] Review migration scripts in `/prisma/migrations/`
- [ ] Rollback scripts available in `/prisma/rollback/`
- [ ] Test migrations in staging environment first

### Environment Variables
Required for Vercel:
```bash
# Core Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SHOPIFY_WEBHOOK_SECRET=

# Database (add pooling params for Vercel)
DATABASE_URL=

# Security (min 32 chars)
SESSION_SECRET=
ENCRYPTION_KEY=

# Optional but recommended
CRON_SECRET=
REDIS_URL=
LOG_LEVEL=info
```

## Vercel Deployment

### 1. Pre-deployment Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login
```

### 2. Database Setup
Update DATABASE_URL for connection pooling:
```
# For Supabase
postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1

# For Neon
postgresql://user:pass@host:5432/db?sslmode=require&connection_limit=1
```

### 3. Deploy to Vercel
```bash
# Link project
vercel link

# Set environment variables
vercel env add SHOPIFY_API_KEY production
vercel env add SHOPIFY_API_SECRET production
# ... add all other env vars

# Deploy
vercel --prod
```

### 4. Update Shopify App Settings
1. Go to Partners Dashboard
2. Update App URL to: `https://your-app.vercel.app`
3. Update Redirect URLs:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/auth/shopify/callback`

### 5. Post-deployment Verification
- [ ] Database migrations applied successfully
- [ ] All environment variables set
- [ ] Webhooks re-registered
- [ ] Cron jobs scheduled (check Vercel dashboard)
- [ ] Performance metrics acceptable
- [ ] No cold start issues

## Monitoring Checklist

### First 24 Hours
Monitor closely for:
- [ ] 403 errors (CSRF protection)
- [ ] Rate limiting on CSP endpoint
- [ ] Database connection issues
- [ ] Memory usage patterns
- [ ] Cold start performance
- [ ] Error rates

### Key Metrics to Track
- Response times (P50, P95, P99)
- Error rates by endpoint
- Database connection pool usage
- Memory consumption
- Cold start frequency

## Rollback Plan

### If Issues Occur:

**Use Vercel's instant rollback**
```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback <deployment-url>
```

3. **Database Rollback** (if needed):
```bash
# Backup current state first
pg_dump $DATABASE_URL > backup_emergency.sql

# Run rollback script
psql $DATABASE_URL < prisma/rollback/[migration]_rollback.sql
```

## Security Verification

After deployment, verify:
- [ ] CSRF tokens required on all mutations
- [ ] No exposed console.log statements
- [ ] Environment variables not exposed
- [ ] Rate limiting working correctly
- [ ] All API endpoints authenticated

## Performance Verification

Check Core Web Vitals:
- [ ] CLS < 0.1
- [ ] INP < 200ms
- [ ] LCP < 2.5s
- [ ] FCP < 1.8s
- [ ] TTFB < 600ms

## Final Sign-off

- [ ] All checks passed
- [ ] No critical errors in logs
- [ ] Performance acceptable
- [ ] Security measures verified
- [ ] Documentation updated

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Platform**: Vercel
**Version**: 1.2.0
**Status**: [ ] Success [ ] Rolled Back