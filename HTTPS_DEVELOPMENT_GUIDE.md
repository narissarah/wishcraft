# 🔒 HTTPS Development Setup for WishCraft

## 🚨 CSP Error Fix Complete

The "Refused to frame" CSP error has been **RESOLVED** by updating:

### ✅ What Was Fixed
1. **shopify.app.toml** - Updated URLs to use HTTPS
2. **.env** - Updated `SHOPIFY_APP_URL` to use HTTPS  
3. **CSP Headers** - Already properly configured for dynamic frame-ancestors

### 🛠 Development Setup

#### Option 1: Shopify CLI with Localhost (Recommended)
```bash
# Start development with HTTPS localhost support
shopify app dev --use-localhost

# Or use specific port
shopify app dev --use-localhost --localhost-port=3000
```

**Benefits:**
- Automatic HTTPS with self-signed certificates
- Works with Shopify's CSP requirements
- No external tunneling needed

#### Option 2: Standard Development (Uses Tunneling)
```bash
# Standard development (uses Cloudflare tunnel)
shopify app dev
```

**Benefits:**
- Works with webhooks and external integrations
- Accessible from any device
- Public HTTPS URL automatically generated

### 🔍 Verification Steps

1. **Check URLs in Browser:**
   - App should load at `https://localhost:3000` (not http://)
   - No browser security warnings after accepting self-signed cert

2. **Verify CSP Headers:**
   ```bash
   curl -I https://localhost:3000
   # Should see: Content-Security-Policy: frame-ancestors https://[shop].myshopify.com https://admin.shopify.com
   ```

3. **Test Embedding:**
   - App should load properly in Shopify admin
   - No console errors about frame-src violations

### ⚡ Performance Optimizations Applied

#### Production-Ready Logging
- ✅ Replaced console.log with conditional logging
- ✅ Only critical errors logged in production
- ✅ Development logs preserved for debugging

#### Bundle Optimization
- ✅ Removed build artifacts from repository
- ✅ Updated .gitignore to prevent build file commits
- ✅ Optimized server logging for performance

### 🎯 Shopify 100/100 Score Checklist

#### ✅ Security Headers
- Dynamic CSP frame-ancestors per shop
- Proper HTTPS configuration
- Secure cookie settings

#### ✅ Performance
- Optimized console logging
- Build artifacts excluded from repository
- Error-safe analytics implementation

#### ✅ Compliance
- 2025 Shopify requirements met
- Embedded app CSP properly configured
- GDPR webhook endpoints ready

### 🚀 Next Steps

1. **Start Development:**
   ```bash
   npm run dev
   # This runs: shopify app dev
   ```

2. **Install on Test Store:**
   - Use the generated app URL
   - Test OAuth flow
   - Verify no CSP errors

3. **Deploy to Production:**
   ```bash
   npm run deploy
   ```

### 🔧 Troubleshooting

#### If CSP Errors Still Occur:
1. Clear browser cache completely
2. Check that .env has `SHOPIFY_APP_URL=https://localhost:3000`
3. Verify shopify.app.toml has `application_url = "https://localhost:3000"`
4. Restart development server

#### Certificate Warnings:
- Accept the self-signed certificate in your browser
- This is normal for localhost development
- Production deployment will use valid certificates

Your WishCraft app is now properly configured for Shopify embedded development with HTTPS! 🎉