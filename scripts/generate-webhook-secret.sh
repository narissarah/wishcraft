#!/bin/bash

# Generate Shopify Webhook Secret
# This creates a secure webhook secret for HMAC validation

echo "🔐 Generating Shopify Webhook Secret"
echo "===================================="
echo ""

# Generate a secure random secret
WEBHOOK_SECRET=$(openssl rand -base64 32)

echo "Your new webhook secret:"
echo ""
echo "  $WEBHOOK_SECRET"
echo ""
echo "Instructions:"
echo "1. Copy this secret"
echo "2. Add it to your .env file as SHOPIFY_WEBHOOK_SECRET=$WEBHOOK_SECRET"
echo "3. Go to your Shopify Partner Dashboard"
echo "4. Navigate to your app settings"
echo "5. Update the webhook notification URL with this secret"
echo ""
echo "⚠️  Important: This secret is used to verify that webhooks are from Shopify"
echo "⚠️  Keep it secure and never commit it to version control"

# Optionally update .env file
read -p "Do you want to update your .env file now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if grep -q "^SHOPIFY_WEBHOOK_SECRET=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/SHOPIFY_WEBHOOK_SECRET=.*/SHOPIFY_WEBHOOK_SECRET=$WEBHOOK_SECRET/" .env
        else
            sed -i "s/SHOPIFY_WEBHOOK_SECRET=.*/SHOPIFY_WEBHOOK_SECRET=$WEBHOOK_SECRET/" .env
        fi
        echo "✅ Updated SHOPIFY_WEBHOOK_SECRET in .env"
    else
        echo "SHOPIFY_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> .env
        echo "✅ Added SHOPIFY_WEBHOOK_SECRET to .env"
    fi
fi