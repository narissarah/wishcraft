#!/bin/bash
cd "/Users/narissaranamkhan/Documents/Coding Projects/wishcraft"

git add -A
git commit -m "Simplify Shopify authentication to match official template

- Remove complex proxy wrappers and lazy initialization 
- Use direct shopifyApp() call matching official template
- Simplify auth.\$.tsx to use authenticate.admin() directly
- Remove dynamic imports and error handling complexity

This matches the official Shopify Remix template structure
and should resolve the authentication path conflicts.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "✅ Authentication fix committed!"
echo ""
echo "🚀 Now test your app at: https://wishcraft-ten.vercel.app"
echo "   The authentication error should be resolved."