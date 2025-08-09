# Vercel Deployment Guide for WishCraft

## Overview
This guide provides step-by-step instructions for deploying the WishCraft Shopify app to Vercel.

## Prerequisites

- Vercel account
- Database with connection pooling support (Supabase, Neon, or PgBouncer)
- Shopify Partner account
- All environment variables ready

## Deployment Steps

### 1. Database Setup

Ensure your database supports connection pooling for serverless:

**For Supabase:**
```
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1"
```

**For Neon:**
```
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&connection_limit=1"
```

**For traditional PostgreSQL:**
Add PgBouncer or use a managed service with pooling support.

### 2. Install Vercel CLI

```bash
npm i -g vercel
```

### 3. Environment Variables Setup

Create a `.env.production` file with all required variables:

```env
# Core Shopify Variables (REQUIRED)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app.vercel.app
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Database (REQUIRED - with pooling)
DATABASE_URL=your_pooled_database_url

# Security Keys (REQUIRED - minimum 32 characters)
SESSION_SECRET=your_session_secret_min_32_chars
ENCRYPTION_KEY=your_encryption_key_min_32_chars

# Optional but Recommended
CRON_SECRET=your_cron_secret_for_scheduled_jobs
REDIS_URL=redis://default:password@host:6379
LOG_LEVEL=info

# Deployment Platform
DEPLOYMENT_PLATFORM=vercel
NODE_ENV=production
```

### 4. Update Shopify App Configuration

1. Go to your [Shopify Partner Dashboard](https://partners.shopify.com)
2. Select your app
3. Update the following URLs:

**App URL:**
```
https://your-app.vercel.app
```

**Redirect URLs (add all):**
```
https://your-app.vercel.app/auth/callback
https://your-app.vercel.app/auth/shopify/callback
https://your-app.vercel.app/api/auth/callback
```

### 5. Deploy to Vercel

```bash
# 1. Link to Vercel project
vercel link

# 2. Set environment variables (for each variable)
vercel env add SHOPIFY_API_KEY production
vercel env add SHOPIFY_API_SECRET production
vercel env add SHOPIFY_APP_URL production
# ... repeat for all variables

# 3. Deploy to production
vercel --prod
```

### 6. Verify Deployment

After deployment completes:

1. **Check deployment URL**: Vercel will provide a URL like `https://wishcraft-abc123.vercel.app`
2. **Run database migrations**: The build process should handle this automatically
3. **Verify cron jobs**: Check Vercel dashboard → Functions → Cron tab
4. **Test the app**: Install on a development store

### 7. Configure Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update Shopify app URLs with the custom domain
4. Update `SHOPIFY_APP_URL` environment variable

## Cron Jobs

The app includes two scheduled jobs configured in `vercel.json`:

1. **Inventory Sync**: Runs every 6 hours
   - Endpoint: `/api/cron/sync-inventory`
   - Schedule: `0 */6 * * *`

2. **Session Cleanup**: Runs daily at 2 AM
   - Endpoint: `/api/cron/cleanup-sessions`
   - Schedule: `0 2 * * *`

To secure cron jobs, set the `CRON_SECRET` environment variable.

## Monitoring

### Vercel Dashboard
- **Functions**: Monitor execution times and errors
- **Analytics**: Track Core Web Vitals
- **Logs**: Real-time function logs

### Key Metrics to Monitor
- Cold start frequency and duration
- Database connection pool usage
- API response times
- Error rates by function

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure connection pooling is enabled
   - Check `DATABASE_URL` format
   - Verify connection limits

2. **Cold Start Performance**
   - Normal for serverless functions
   - Monitor frequency in Vercel Analytics
   - Consider upgrading to Vercel Pro for better performance

3. **Environment Variable Issues**
   - Use `vercel env ls` to list all variables
   - Ensure no typos or missing values
   - Check variable names match exactly

4. **Webhook Failures**
   - Verify `SHOPIFY_WEBHOOK_SECRET` is correct
   - Check function logs for errors
   - Ensure webhook URLs are updated in Shopify

### Debug Commands

```bash
# List all environment variables
vercel env ls

# View deployment logs
vercel logs

# List all deployments
vercel ls

# Inspect a specific deployment
vercel inspect <deployment-url>
```

## Performance Optimization

### 1. Edge Functions
Consider moving lightweight endpoints to Edge Functions for better performance.

### 2. Database Optimization
- Use connection pooling
- Implement caching with Redis
- Optimize queries with proper indexes

### 3. Bundle Size
- Monitor bundle size in build output
- Use dynamic imports for large components
- Leverage Vercel's automatic code splitting

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **CRON_SECRET**: Always set for production
3. **Database**: Use connection pooling with SSL
4. **Monitoring**: Set up alerts for errors and performance

## Rollback Procedure

If issues occur after deployment:

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>

# Or use Vercel Dashboard for one-click rollback
```

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Shopify App Development](https://shopify.dev/docs/apps)
- [Remix on Vercel](https://vercel.com/guides/deploying-remix-with-vercel)

## Final Notes

- Test thoroughly in development before production deployment
- Monitor closely for the first 48 hours
- Keep database backups before major updates
- Document any custom configurations

---

**Successfully deployed?** 🎉 Your WishCraft app is now running on Vercel's global edge network!