#!/bin/bash
# WishCraft Final Setup - Run Everything

set -e

echo "🚀 WishCraft Final Setup"
echo "========================="

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
brew install postgresql@15
brew services start postgresql@15

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
sleep 5

# Create database
echo "🗄️  Creating database..."
createdb wishcraft_development

# Test database connection
echo "🔍 Testing database connection..."
psql -d wishcraft_development -c "SELECT version();"

# Generate Prisma client
echo "⚙️  Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🔄 Running migrations..."
npx prisma migrate dev --name init

# Seed database
echo "🌱 Seeding database..."
npx prisma db seed

echo ""
echo "✅ SETUP COMPLETE!"
echo "==================="
echo ""
echo "🎉 Your WishCraft app is ready!"
echo ""
echo "Next step: Run 'npm run dev' to start the development server"
echo "Then visit the installation URL it shows you"
echo ""
echo "Monitoring dashboard: http://localhost:3000/admin/monitoring"
echo "Main app: http://localhost:3000"
echo ""