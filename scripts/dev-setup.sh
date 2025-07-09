#!/bin/bash
# Development setup script for WishCraft

set -e

echo "🚀 Setting up WishCraft development environment..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install postgresql@15
        brew services start postgresql@15
        echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
        export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
    else
        echo "Please install PostgreSQL manually for your operating system"
        exit 1
    fi
else
    echo "✅ PostgreSQL already installed"
fi

# Start PostgreSQL service
echo "🔄 Starting PostgreSQL service..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew services start postgresql@15 || brew services restart postgresql@15
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start within 30 seconds"
        exit 1
    fi
    sleep 1
done

# Create database
echo "🗄️  Creating development database..."
createdb wishcraft_development 2>/dev/null || echo "Database already exists"

# Run Prisma migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev --name init

# Generate Prisma client
echo "🔄 Generating Prisma client..."
npx prisma generate

# Seed database (if seed file exists)
if [ -f "prisma/seed.ts" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Update SHOPIFY_API_KEY and SHOPIFY_API_SECRET in .env"
echo "2. Create a Shopify Partner account and app"
echo "3. Run 'npm run dev' to start the development server"