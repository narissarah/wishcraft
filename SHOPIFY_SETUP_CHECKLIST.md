# ✅ SHOPIFY APP SETUP CHECKLIST

## 🎯 CURRENT STATUS
- ✅ **CSP Headers:** Fixed and working
- ✅ **Database:** Connected successfully  
- ✅ **Health Check:** Passing
- ⚠️ **OAuth:** Needs configuration in Shopify

## 📋 REMAINING SETUP STEPS

### 1️⃣ **Railway Environment Variables**
Check if these are set in Railway dashboard:
- [ ] `SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app`
- [ ] `SHOPIFY_API_KEY=3db6e18eb9c8f2a58a4db60b43795edc`
- [ ] `SHOPIFY_API_SECRET=bfbd378b59e74cd0e23e5fdd4cbfcbf7`
- [ ] `SHOPIFY_WEBHOOK_SECRET=hfvoIrkf6LUJdvl//9VwjBGyHyjT74fPpCK4enK5Vfo=`
- [ ] `SESSION_SECRET=j6tJg/BOIjMH8+03ajJScM4E7t/SV95RQV2SrV0LUOw=`
- [ ] `DATABASE_URL` (should end with `?sslmode=require`)

### 2️⃣ **Shopify Partners Dashboard**
1. Go to: https://partners.shopify.com
2. Find your "WishCraft" app
3. Go to "App Setup" → "URLs"
4. Update these URLs:

**App URL:**
```
https://wishcraft-production.up.railway.app
```

**Allowed redirection URL(s):**
```
https://wishcraft-production.up.railway.app/auth/callback
https://wishcraft-production.up.railway.app/auth/shopify/callback
https://wishcraft-production.up.railway.app/auth
https://wishcraft-production.up.railway.app/auth/shopify
```

### 3️⃣ **Install App in Test Store**
1. In Partners Dashboard, click "Test on development store"
2. Select your test store
3. Click "Install app"
4. Approve the permissions

### 4️⃣ **Verify Installation**
1. Go to your test store admin
2. Click "Apps" in left menu
3. Click "WishCraft"
4. App should load without errors!

## 🧪 TROUBLESHOOTING

### If you see "Application Error":
1. Check browser console (F12)
2. Look for specific error messages
3. Common issues:
   - **"Invalid API key"** → Check SHOPIFY_API_KEY in Railway
   - **"Invalid redirect"** → URLs don't match in Partners Dashboard
   - **"Shop not found"** → Database needs initialization

### Quick Checks:
```bash
# Check if app is healthy
curl https://wishcraft-production.up.railway.app/health

# Check CSP headers
curl -I https://wishcraft-production.up.railway.app | grep frame-ancestors
```

## 🎉 SUCCESS INDICATORS
When everything is working:
- No "Application Error" in Shopify admin
- No CSP console errors
- App loads with "Welcome to WishCraft! 🎁"
- Can create registries and add products

## 📞 NEED HELP?
If issues persist after following this checklist:
1. Screenshot the browser console errors
2. Check Railway logs for specific errors
3. Verify all URLs match exactly (no trailing slashes!)
4. Ensure app is installed in the test store