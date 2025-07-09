# WishCraft Setup Instructions

## ✅ Completed Setup

The WishCraft Shopify app has been successfully initialized with the following 2025 best practices:

### 🏗️ Project Structure Created
- ✅ Remix app with TypeScript configuration
- ✅ Shopify GraphQL Admin API integration (2025-07)
- ✅ Polaris React v12+ UI components
- ✅ PostgreSQL database with Prisma ORM
- ✅ OAuth 2.0 authentication setup
- ✅ Webhook endpoints configured
- ✅ Theme extension ready structure
- ✅ Test suite configuration

### 📁 Key Files Created
- `shopify.app.toml` - Shopify app configuration
- `package.json` - Dependencies and scripts
- `app/shopify.server.ts` - Shopify authentication
- `prisma/schema.prisma` - Database schema
- `app/lib/graphql/` - GraphQL queries and mutations
- `app/routes/` - Remix routes for admin and webhooks
- Test configuration with Vitest

## 🚀 Next Steps

To complete the setup and test with your development store:

### 1. Install Dependencies
```bash
npm install
```

### 2. Shopify CLI Authentication
```bash
# Login to Shopify (this will open a browser)
shopify auth login

# Link to your app (or create a new one)
shopify app config link
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# These will be populated automatically after linking with Shopify CLI
```

### 4. Database Setup
```bash
# Set up PostgreSQL database
createdb wishcraft_dev

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### 5. Start Development
```bash
# Start the development server
npm run dev

# This will:
# - Start the Remix server
# - Create ngrok tunnel
# - Update app URLs automatically
# - Install app on your development store
```

### 6. Testing Checklist

Once the app is running:

- [ ] App loads in Shopify admin
- [ ] Authentication works correctly
- [ ] Dashboard shows shop information
- [ ] GraphQL queries execute successfully
- [ ] Webhooks are registered
- [ ] Database connections work
- [ ] Tests pass: `npm run test`
- [ ] TypeScript checks pass: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

## 🔧 Configuration Details

### OAuth Scopes
The app requests minimal scopes:
- `read_customers` - Access customer data for registries
- `write_orders` - Create orders from registry items
- `read_products` - Display products in registries
- `read_inventory` - Check product availability
- `write_customers` - Update customer registry preferences

### Webhook Events
Configured to listen for:
- `app/uninstalled` - Clean up app data
- `orders/create` - Track registry purchases
- `customers/create` - Set up new customer profiles
- `products/update` - Update registry item information

### Database Schema
Key entities:
- **Registry** - Main registry records
- **RegistryItem** - Individual gift items
- **Purchase** - Purchase tracking
- **AppSettings** - Shop configuration
- **Session** - Shopify session storage

## 🎯 Features Ready for Development

The app structure supports:
- 🎁 Gift registry creation and management
- 🛍️ Product selection from Shopify catalog
- 👥 Customer registry management
- 📧 Email notifications (when configured)
- 🎨 Theme extension integration
- 📱 Mobile-responsive admin interface
- 🔐 Privacy controls and permissions
- 📊 Analytics and reporting foundation

## 🔗 Useful Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run deploy          # Deploy to Shopify

# Database
npm run db:migrate      # Run migrations
npm run db:reset        # Reset database
npm run db:seed         # Seed sample data

# Code Quality
npm run typecheck       # TypeScript validation
npm run test           # Run test suite
npm run lint           # Check code style
npm run lint:fix       # Fix linting issues

# Shopify CLI
shopify app info       # Show app information
shopify app logs       # View app logs
shopify app deploy     # Deploy app
```

## 📚 Documentation

- [Shopify App Development](https://shopify.dev/docs/apps)
- [Remix Framework](https://remix.run/docs)
- [Polaris Design System](https://polaris.shopify.com/)
- [Prisma ORM](https://www.prisma.io/docs)

## 🆘 Troubleshooting

### Common Issues:

1. **Authentication Errors**
   - Ensure you're logged in: `shopify auth login`
   - Check app configuration: `shopify app config link`

2. **Database Connection**
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env
   - Run migrations: `npm run db:migrate`

3. **Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version: `node --version` (needs 18.20+)

4. **GraphQL Errors**
   - Verify API scopes in shopify.app.toml
   - Check GraphQL query syntax
   - Ensure proper authentication

The WishCraft app is now ready for development! 🎉