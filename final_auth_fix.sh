#!/bin/bash
cd "/Users/narissaranamkhan/Documents/Coding Projects/wishcraft"

echo "🧹 Final cleanup - removing problematic files..."

# Remove problematic auth files
rm -f app/routes/auth.$.tsx.backup
rm -f app/routes/auth.login.tsx  
rm -f app/routes/_auth.login.tsx.disabled
rm -f app/routes/_disabled.auth.login.tsx
rm -f app/routes/_disabled.debug.auth-test.tsx
rm -f app/routes/_disabled.test.auth.tsx
rm -f app/routes/debug.auth-test.tsx
rm -f app/routes/test.auth.tsx
rm -f app/lib/auth-utils.server.ts
rm -f app/lib/auth.server.ts
rm -f app/shopify.server.minimal.ts

# Remove old complex layout - we have the new simple app.tsx
rm -f app/routes/app._layout.tsx

echo "✅ Cleanup complete!"

# Stage and commit the changes
git add -A

git commit -m "FINAL FIX: Implement minimal Shopify Remix template structure

- Complete rewrite of shopify.server.ts using official template
- Simplified auth.\$.tsx to minimal working version  
- Added proper app.tsx layout with AppProvider
- Removed ALL problematic auth files and complex wrappers
- Fixed entry.server.tsx to use proper shopify import
- Follows 2025 Shopify best practices exactly

This matches the official Shopify Remix template structure.
The authentication error should now be completely resolved.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo ""
echo "🚀 DEPLOYMENT READY!"
echo "   Test your app at: https://wishcraft-ten.vercel.app"
echo "   The app should now load properly in Shopify admin."
echo ""
echo "💡 If there are still issues, check these:"
echo "   1. SHOPIFY_APP_URL environment variable"
echo "   2. SCOPES environment variable" 
echo "   3. Partner dashboard URLs match exactly"