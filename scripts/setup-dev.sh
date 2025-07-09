#!/bin/bash

# WishCraft Development Environment Setup Script
# This script sets up the complete development environment for WishCraft

set -e  # Exit on any error

echo "🎯 Setting up WishCraft development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18.20.0 or later."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="18.20.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        print_error "Node.js version $NODE_VERSION is too old. Please upgrade to $REQUIRED_VERSION or later."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check if PostgreSQL is installed
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL is not installed. Please install PostgreSQL or use a cloud database."
        print_status "You can install PostgreSQL with:"
        print_status "  macOS: brew install postgresql"
        print_status "  Ubuntu: sudo apt install postgresql postgresql-contrib"
        print_status "  Or use a cloud service like Railway, Supabase, or Neon"
    fi
    
    # Check Shopify CLI
    if ! command -v shopify &> /dev/null; then
        print_error "Shopify CLI is not installed. Installing now..."
        npm install -g @shopify/cli @shopify/theme
        if [ $? -eq 0 ]; then
            print_success "Shopify CLI installed successfully"
        else
            print_error "Failed to install Shopify CLI"
            exit 1
        fi
    fi
    
    print_success "All requirements met!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success ".env file created from .env.example"
            print_warning "Please edit .env file with your actual values before continuing"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_warning ".env file already exists"
    fi
    
    # Generate session secret if not present
    if ! grep -q "your_32_character_session_secret_here" .env 2>/dev/null; then
        print_status "Session secret already configured"
    else
        SESSION_SECRET=$(openssl rand -base64 32)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/your_32_character_session_secret_here/$SESSION_SECRET/" .env
        else
            # Linux
            sed -i "s/your_32_character_session_secret_here/$SESSION_SECRET/" .env
        fi
        print_success "Generated session secret"
    fi
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Check if DATABASE_URL is configured
    if grep -q "postgresql://username:password@localhost:5432/wishcraft" .env; then
        print_warning "DATABASE_URL still has default values. Please configure your database connection."
        print_status "Options:"
        print_status "  1. Local PostgreSQL: postgresql://username:password@localhost:5432/wishcraft"
        print_status "  2. Railway: Use their provided DATABASE_URL"
        print_status "  3. Supabase: Use their provided connection string"
        print_status "  4. Neon: Use their provided connection string"
        return
    fi
    
    # Try to run Prisma commands
    print_status "Generating Prisma client..."
    if npx prisma generate; then
        print_success "Prisma client generated"
    else
        print_error "Failed to generate Prisma client"
        exit 1
    fi
    
    print_status "Running database migrations..."
    if npx prisma db push --accept-data-loss; then
        print_success "Database schema updated"
    else
        print_warning "Database migration failed. Please check your DATABASE_URL and database connection."
    fi
}

# Setup Shopify app
setup_shopify_app() {
    print_status "Setting up Shopify app configuration..."
    
    # Check if app is already configured
    if grep -q "YOUR_CLIENT_ID" shopify.app.toml; then
        print_status "Shopify app not yet configured. Run 'shopify app dev' to complete setup."
    else
        print_success "Shopify app configuration found"
    fi
}

# Run tests
run_tests() {
    print_status "Running tests to verify setup..."
    
    if npm run typecheck; then
        print_success "TypeScript compilation successful"
    else
        print_error "TypeScript compilation failed"
        exit 1
    fi
    
    if npm test -- --run; then
        print_success "Tests passed"
    else
        print_warning "Some tests failed. This is normal for initial setup."
    fi
}

# Create development script
create_dev_script() {
    print_status "Creating development scripts..."
    
    cat > scripts/dev.sh << 'EOF'
#!/bin/bash
# WishCraft Development Server

echo "🚀 Starting WishCraft development server..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run scripts/setup-dev.sh first."
    exit 1
fi

# Start development server
shopify app dev
EOF

    chmod +x scripts/dev.sh
    print_success "Development script created at scripts/dev.sh"
}

# Main setup function
main() {
    echo "=================================================================================="
    echo "🎯 WishCraft Development Environment Setup"
    echo "=================================================================================="
    echo ""
    
    check_requirements
    echo ""
    
    install_dependencies
    echo ""
    
    setup_environment
    echo ""
    
    setup_database
    echo ""
    
    setup_shopify_app
    echo ""
    
    run_tests
    echo ""
    
    create_dev_script
    echo ""
    
    echo "=================================================================================="
    print_success "🎉 Development environment setup complete!"
    echo "=================================================================================="
    echo ""
    print_status "Next steps:"
    echo "  1. Edit .env file with your actual values"
    echo "  2. Configure your database connection"
    echo "  3. Run 'shopify app dev' to start development"
    echo "  4. Visit your Partner Dashboard to complete app setup"
    echo ""
    print_status "Useful commands:"
    echo "  npm run dev          - Start development server"
    echo "  npm run db:migrate   - Run database migrations"
    echo "  npm run db:reset     - Reset database"
    echo "  npm run typecheck    - Check TypeScript"
    echo "  npm test             - Run tests"
    echo "  npm run lint         - Run linter"
    echo ""
    print_status "Documentation:"
    echo "  📖 Project docs: ./docs/"
    echo "  🔧 Setup guide: ./SETUP_INSTRUCTIONS.md"
    echo "  🎨 Theme extensions: ./THEME_EXTENSIONS_README.md"
    echo ""
}

# Run main function
main