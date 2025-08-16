#!/bin/bash
cd "/Users/narissaranamkhan/Documents/Coding Projects/wishcraft"

# Rename auth files to disable them
mv app/routes/auth.$.tsx app/routes/auth.$.tsx.disabled 2>/dev/null || true
mv app/routes/auth.login.tsx app/routes/auth.login.tsx.disabled 2>/dev/null || true

echo "Auth routes have been disabled"
echo "The Shopify library will now handle authentication automatically"

# Show what files remain
echo ""
echo "Current route files:"
ls app/routes/ | grep -E "(auth|app)" | grep -v disabled