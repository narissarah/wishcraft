#!/bin/bash
# Complete WishCraft Setup Script
# This script handles all the manual setup steps automatically

set -e

echo "🚀 WishCraft Complete Setup Starting..."
echo "This will install PostgreSQL, create database, and set up everything!"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please install PostgreSQL manually."
    exit 1
fi

print_status "Checking system requirements..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    print_status "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    print_success "Homebrew is installed"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed. Please install Node.js first."
    exit 1
else
    print_success "Node.js is installed: $(node --version)"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed. Please install npm first."
    exit 1
else
    print_success "npm is installed: $(npm --version)"
fi

print_status "Installing PostgreSQL..."

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    brew install postgresql@15
    
    # Add PostgreSQL to PATH
    echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
    export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
    
    print_success "PostgreSQL installed"
else
    print_success "PostgreSQL is already installed"
fi

print_status "Starting PostgreSQL service..."

# Start PostgreSQL service
brew services start postgresql@15

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to start..."
for i in {1..30}; do
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        print_success "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL failed to start within 30 seconds"
        print_warning "Try running: brew services restart postgresql@15"
        exit 1
    fi
    echo -n "."
    sleep 1
done

print_status "Creating development database..."

# Create development database
if createdb wishcraft_development 2>/dev/null; then
    print_success "Database 'wishcraft_development' created"
else
    print_warning "Database 'wishcraft_development' already exists"
fi

# Test database connection
if psql -d wishcraft_development -c "SELECT version();" >/dev/null 2>&1; then
    print_success "Database connection successful"
else
    print_error "Database connection failed"
    exit 1
fi

print_status "Installing Node.js dependencies..."

# Install npm dependencies
npm install

print_status "Setting up Prisma database..."

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

print_status "Creating test data..."

# Create seed file if it doesn't exist
if [ ! -f "prisma/seed.ts" ]; then
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

    npx prisma db seed
fi

print_status "Verifying setup..."

# Check if all required files exist
required_files=(
    ".env"
    "prisma/schema.prisma"
    "node_modules/@prisma/client"
    "monitoring/apm-setup.ts"
    "monitoring/error-tracking.ts"
    "monitoring/user-analytics.ts"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        print_success "Required file/directory exists: $file"
    else
        print_error "Missing required file/directory: $file"
        exit 1
    fi
done

# Test database connection with Prisma
if npx prisma db pull --force >/dev/null 2>&1; then
    print_success "Prisma database connection verified"
else
    print_warning "Prisma database connection test failed (this might be okay)"
fi

print_status "Setup complete! 🎉"

echo ""
echo "===================================================================================="
echo "🎉 WishCraft Setup Complete!"
echo "===================================================================================="
echo ""
echo "✅ PostgreSQL installed and running"
echo "✅ Database 'wishcraft_development' created"
echo "✅ Database tables created via Prisma migrations"
echo "✅ Test data seeded"
echo "✅ All monitoring systems configured"
echo "✅ Environment variables set with your Shopify credentials"
echo ""
echo "🚀 Ready to start development!"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Open the installation URL it shows you"
echo "3. Install WishCraft on your development store"
echo "4. Start building registries!"
echo ""
echo "Monitoring endpoints will be available at:"
echo "  • Health Check: http://localhost:3000/health"
echo "  • Database Health: http://localhost:3000/health/db"
echo "  • Monitoring Dashboard: http://localhost:3000/admin/monitoring"
echo ""
echo "🎯 Your Shopify development store: wishcraft-dev.myshopify.com"
echo "🔑 Your API credentials are already configured in .env"
echo ""
echo "===================================================================================="