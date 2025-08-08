#!/bin/bash

echo "🎁 WishCraft Database Setup"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the WishCraft project root directory"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Setting up Prisma..."
npx prisma generate

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set in environment variables"
    echo "Please set up your Neon database first:"
    echo "1. Visit https://console.neon.tech/"
    echo "2. Create a new project"
    echo "3. Copy the connection string"
    echo "4. Set DATABASE_URL in your .env file or Vercel dashboard"
    echo ""
    echo "Example:"
    echo "export DATABASE_URL=\"postgresql://user:password@host.neon.tech/dbname?sslmode=require\""
    exit 1
fi

echo "🗄️  Running database migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Database setup complete!"
    echo "🧪 Testing database connection..."
    
    # Test if we can connect
    npx prisma db seed || echo "ℹ️  No seed file found (optional)"
    
    echo ""
    echo "🎉 WishCraft database is ready!"
    echo "You can now switch from mock to real database API"
else
    echo "❌ Database migration failed"
    echo "Check your DATABASE_URL and try again"
    exit 1
fi