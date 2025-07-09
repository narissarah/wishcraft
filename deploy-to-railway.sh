#!/bin/bash

echo "🚀 Deploying WishCraft to Railway"
echo "================================"
echo ""
echo "This script will help you deploy your app to Railway."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   brew install railway"
    echo "   or"
    echo "   npm install -g @railway/cli"
    exit 1
fi

echo "📋 Current git status:"
git status --short

echo ""
echo "🔧 Next steps:"
echo ""
echo "1. First, you need to set up GitHub authentication."
echo "   Go to: https://github.com/settings/tokens"
echo "   Create a 'Classic' personal access token with 'repo' scope"
echo ""
echo "2. Then run these commands:"
echo ""
echo "   # Set up GitHub with your token"
echo "   git remote set-url origin https://narissarah:<YOUR_TOKEN>@github.com/narissarah/wishcraft.git"
echo "   git push --set-upstream origin master"
echo ""
echo "3. If Railway is connected to your GitHub:"
echo "   - Go to https://railway.app/dashboard"
echo "   - Find your wishcraft project"
echo "   - It should auto-deploy when you push to GitHub"
echo ""
echo "4. Alternative: Deploy directly with Railway CLI:"
echo "   railway login"
echo "   railway link"
echo "   railway up"
echo ""
echo "Your app has been fixed with:"
echo "✅ Custom Express server for proper port binding"
echo "✅ Health check endpoints (/health)"
echo "✅ Correct 0.0.0.0:PORT configuration for Railway"
echo ""
echo "After deployment, your app should be accessible at:"
echo "https://wishcraft-production.up.railway.app"