#!/bin/bash
# Quick WishCraft Setup Script

echo "🚀 WishCraft Quick Setup"
echo "========================="

# Install PostgreSQL if not present
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    brew install postgresql@15
    brew services start postgresql@15
    echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
    export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
else
    echo "✅ PostgreSQL already installed"
fi

# Start PostgreSQL
echo "Starting PostgreSQL..."
brew services start postgresql@15

# Create database
echo "Creating database..."
createdb wishcraft_development 2>/dev/null || echo "Database already exists"

# Test database connection
echo "Testing database connection..."
psql -d wishcraft_development -c "SELECT version();"

# Install dependencies
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run migrations
echo "Running migrations..."
npx prisma migrate dev --name init

# Create seed file
echo "Creating seed file..."
cat > prisma/seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  
  // Create a test shop
  const shop = await prisma.shop.upsert({
    where: { domain: 'wishcraft-dev.myshopify.com' },
    update: {},
    create: {
      id: 'gid://shopify/Shop/1',
      domain: 'wishcraft-dev.myshopify.com',
      name: 'WishCraft Dev Store',
      email: 'admin@wishcraft-dev.myshopify.com',
      currencyCode: 'USD',
      timezone: 'America/New_York',
      settings: {
        create: {
          enablePasswordProtection: true,
          enableGiftMessages: true,
          enableSocialSharing: true,
          enableGroupGifting: true,
          enableAnalytics: true,
          primaryColor: '#667eea',
          accentColor: '#f3f3f3',
          fontFamily: 'Inter',
          defaultRegistryVisibility: 'public',
          maxItemsPerRegistry: 100,
          enableInventoryTracking: true,
          enableMultipleAddresses: true
        }
      }
    }
  })

  console.log('✅ Test shop created:', shop.name)
  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
EOF

# Run seed
echo "Seeding database..."
npx prisma db seed

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Install app on your development store"
echo "3. Start building!"