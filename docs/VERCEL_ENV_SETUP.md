# Vercel Environment Variables Setup for WishCraft

## Required Environment Variables for Vercel

Add these to your Vercel project settings under Environment Variables:

### 1. Database (Neon)
```
DATABASE_URL=postgresql://neondb_owner:npg_mazOgiTByR65@ep-cold-star-adf7wtwt-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```
**Important**: Use the pooled connection URL (with `-pooler` in the hostname) for better performance in serverless environments.

### 2. Shopify App Configuration
```
SHOPIFY_API_KEY=[Get from Shopify Partner Dashboard]
SHOPIFY_API_SECRET=[Get from Shopify Partner Dashboard]
SHOPIFY_APP_URL=https://wishcraft-ten.vercel.app
SHOPIFY_SCOPES=read_customers,read_products,read_orders,write_orders,read_inventory
```

### 3. Security Keys (Generate these)
```bash
# Generate secure random keys
openssl rand -hex 16  # Use for each key below
```

```
SESSION_SECRET=[32-character hex string]
ENCRYPTION_KEY=[32-character hex string]
SEARCH_HASH_KEY=[32-character hex string]
```

### 4. Environment
```
NODE_ENV=production
```

## DO NOT Add These Variables

The following Neon variables are NOT needed in Vercel (they're for Next.js Stack Auth):
- ❌ NEXT_PUBLIC_STACK_PROJECT_ID
- ❌ NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
- ❌ STACK_SECRET_SERVER_KEY
- ❌ DATABASE_URL_UNPOOLED
- ❌ PGHOST, PGUSER, PGDATABASE, PGPASSWORD
- ❌ POSTGRES_URL, POSTGRES_URL_NON_POOLING, etc.

## Verification Steps

1. After adding all variables, trigger a new deployment in Vercel
2. Check the deployment logs for any missing environment variable errors
3. Test the app installation flow in your development store

## Troubleshooting

### Database Connection Issues
- Ensure you're using the pooled connection URL (contains `-pooler`)
- The `?sslmode=require` parameter is mandatory for Neon
- Connection timeout is set to 10 seconds in the app

### Shopify Authentication Issues
- Verify the SHOPIFY_APP_URL matches your Vercel deployment URL exactly
- Ensure allowed redirection URLs in Shopify Partner Dashboard include:
  - `https://wishcraft-ten.vercel.app/auth/callback`
  - `https://wishcraft-ten.vercel.app/auth/login`

### Session Issues
- SESSION_SECRET must be exactly 32 characters
- Use a secure random generator, not a simple password