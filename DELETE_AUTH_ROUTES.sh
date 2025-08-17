#!/bin/bash
cd "/Users/narissaranamkhan/Documents/Coding Projects/wishcraft"

echo "🗑️  Removing ALL custom auth routes to let Shopify handle authentication..."

# Remove all auth route files
rm -f app/routes/auth.$.tsx
rm -f app/routes/auth.login.tsx
rm -f app/routes/auth.$.tsx.backup
rm -f app/routes/test.auth.tsx
rm -f app/routes/debug.auth-test.tsx

echo "✅ Auth routes removed. Shopify will now handle authentication automatically."

# List remaining routes
echo ""
echo "📁 Remaining routes:"
ls app/routes/ | grep -v ".disabled"

echo ""
echo "🚀 Now commit and push:"
echo "git add -A"
echo "git commit -m 'Remove all custom auth routes - let Shopify handle authentication'"
echo "git push origin master"