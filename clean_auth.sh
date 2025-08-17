#!/bin/bash
cd "/Users/narissaranamkhan/Documents/Coding Projects/wishcraft"

echo "🧹 Removing ALL problematic auth files..."

# Remove all problematic auth files
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

echo "✅ Problematic files removed"

# List remaining routes
echo ""
echo "📁 Remaining route files:"
ls -la app/routes/ | grep -E "\.(tsx|ts|jsx|js)$"