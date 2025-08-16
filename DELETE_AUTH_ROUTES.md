# Fix Authentication Error

The persistent error "Detected call to shopify.authenticate.admin() from configured login path" is likely caused by having custom auth routes when Shopify expects to handle authentication automatically.

## Solution: Remove Custom Auth Routes

The Shopify library with `authPathPrefix: "/auth"` should automatically handle all `/auth/*` routes. Having custom route files might be interfering with this.

## Steps to Fix:

1. **Delete these files:**
   - `app/routes/auth.$.tsx`
   - `app/routes/auth.login.tsx`

2. **Keep the entry.server.tsx fix** that skips Shopify headers for auth routes

3. **Let Shopify handle auth automatically**

The Shopify library will automatically create and handle:
- `/auth/login` - For OAuth initiation
- `/auth/callback` - For OAuth callback
- `/auth/logout` - For logout

## Why This Should Work:

1. The error message suggests Shopify is detecting our custom routes
2. The library expects to control auth routes completely
3. Our custom routes might be conflicting with internal Shopify routing

## Manual Steps Required:

```bash
cd "/Users/narissaranamkhan/Documents/Coding Projects/wishcraft"
rm -f app/routes/auth.$.tsx app/routes/auth.login.tsx
git add -A
git commit -m "Remove custom auth routes to let Shopify handle authentication"
git push origin master
```

Then wait for deployment and try again.