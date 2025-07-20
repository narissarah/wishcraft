# 🚨 Fix "localhost refused to connect" Error

## Quick Fix Instructions

The error you're seeing happens because Railway doesn't have the required environment variables. Here's how to fix it:

### Step 1: Generate Secrets (if not done already)
```bash
npm run generate-secrets
```

### Step 2: Copy these to Railway Dashboard

Go to your Railway project → Variables tab and add:

```env
# REQUIRED - This fixes the localhost error
SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app

# REQUIRED - Get these from Shopify Partners Dashboard
SHOPIFY_API_KEY=ac161e228a6b078fcdd3fa14586ded14
SHOPIFY_API_SECRET=[YOUR_SECRET_FROM_SHOPIFY]

# REQUIRED - Copy from generate-secrets output
SESSION_SECRET=[32+ character string]
ENCRYPTION_KEY=[32+ character string]
ENCRYPTION_SALT=[64 character hex string]
SHOPIFY_WEBHOOK_SECRET=[32+ character string]

# REQUIRED
SHOPIFY_SCOPES=read_customers,write_customers,read_products,read_orders,write_orders,read_inventory,write_content
NODE_ENV=production
```

### Step 3: Redeploy
After adding all variables, Railway will automatically redeploy.

### Step 4: Update Shopify App URLs
In your Shopify Partners Dashboard:
1. Go to your app settings
2. Set **App URL** to: `https://wishcraft-production.up.railway.app`
3. Set **Allowed redirection URL(s)** to:
   - `https://wishcraft-production.up.railway.app/auth/callback`
   - `https://wishcraft-production.up.railway.app/auth/shopify/callback`

### Step 5: Reinstall App
1. Uninstall the app from your development store
2. Reinstall it - it should now load from Railway instead of localhost

## Still Not Working?

Run this command to check what's missing:
```bash
railway logs | grep -E "Missing|Error|Failed"
```

Common issues:
- `SHOPIFY_API_SECRET` not set correctly
- Database connection issues (DATABASE_URL is auto-set by Railway)
- Old app installation still pointing to localhost (reinstall fixes this)

## Verify Success

Check the health endpoint:
```bash
curl https://wishcraft-production.up.railway.app/health
```

You should see:
```json
{
  "status": "healthy",
  "shopifyCompliant": true,
  "database": "connected"
}
```