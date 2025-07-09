# WishCraft - Shopify Gift Registry App

WishCraft is a native Shopify gift registry app that provides seamless integration with Shopify's inventory and order management. Built with modern 2025 best practices using Remix and GraphQL.

## Features

- 🎁 **Gift Registry Creation**: Customers can create personalized gift registries
- 🛍️ **Shopify Integration**: Real-time inventory sync with Shopify products
- 📧 **Email Notifications**: Automated notifications for registry updates
- 🔐 **Privacy Controls**: Password-protected registries and privacy settings
- 💳 **Order Tracking**: Track purchases and registry completion
- 📱 **Mobile Responsive**: Works seamlessly on all devices
- 🎨 **Theme Integration**: Native storefront integration with theme extensions

## Tech Stack

- **Framework**: Remix with React Router 7
- **API**: GraphQL Admin API (2025-07)
- **UI**: Polaris React v12+
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Shopify OAuth 2.0
- **Deployment**: Railway/Render ready

## Prerequisites

- Node.js 18.20+ or 20.10+
- PostgreSQL database
- Shopify Partner account
- Shopify development store

## Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd wishcraft
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your Shopify app credentials
   ```

3. **Database Setup**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Development**
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-app-domain.com
SCOPES=read_customers,write_orders,read_products,read_inventory,write_customers

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/wishcraft_dev

# App Configuration
NODE_ENV=development
PORT=3000
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run deploy` - Deploy to Shopify
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database
- `npm run db:seed` - Seed database with test data
- `npm run typecheck` - Run TypeScript checks
- `npm run test` - Run test suite
- `npm run test:coverage` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:all` - Run complete test suite
- `npm run lint` - Run linter
- `npm run lint:fix` - Fix linting issues

## Project Structure

```
wishcraft/
├── app/                    # Remix app directory
│   ├── routes/            # Route handlers
│   ├── components/        # Reusable UI components
│   ├── lib/              # Utility functions
│   ├── styles/           # CSS/styling
│   └── shopify.server.ts # Shopify configuration
├── prisma/               # Database schema and migrations
├── test/                 # Test files
├── public/               # Static assets
├── shopify.app.toml      # Shopify app configuration
└── package.json          # Dependencies and scripts
```

## Database Schema

The app uses PostgreSQL with Prisma ORM. Key entities:

- **Registry**: Main registry records with customer info
- **RegistryItem**: Individual gift items with Shopify product data
- **Purchase**: Purchase tracking for gift items
- **AppSettings**: App configuration per shop

## GraphQL Integration

The app uses Shopify's GraphQL Admin API with the following patterns:

- **Queries**: Product, customer, and order data retrieval
- **Mutations**: Creating metafields and managing data
- **Webhooks**: Real-time updates for orders, products, and customers

## Authentication & Authorization

- **OAuth 2.0**: Shopify-managed installation
- **Scopes**: Minimal required scopes for security
- **Session Management**: Prisma-based session storage
- **Webhooks**: HMAC signature verification

## Theme Integration

The app includes theme extensions for storefront integration:

- **App Blocks**: Embedded registry widgets
- **App Embed Blocks**: Global registry functionality
- **Liquid Templates**: Theme compatibility
- **Storefront API**: Public registry data access

## Testing

Our comprehensive testing strategy ensures 90%+ code coverage across all critical functionality:

### Unit Tests
```bash
npm run test:unit              # Run unit tests
npm run test:integration       # Run integration tests
npm run test:coverage          # Run with coverage report
```

### End-to-End Tests
```bash
npm run test:e2e              # Run all E2E tests
npm run test:e2e:headed       # Run with browser UI
npm run test:responsive       # Test mobile responsiveness
```

### Performance & Security Tests
```bash
npm run test:performance      # WebSocket performance tests
npm run test:security         # Authentication security tests
```

### All Tests
```bash
npm run test:all              # Run complete test suite
```

### Test Coverage
- **Unit Tests**: Business logic, utilities, and components
- **Integration Tests**: Shopify API interactions and webhooks
- **E2E Tests**: Complete user journeys (registry creation, group gifting, checkout)
- **Performance Tests**: WebSocket scalability and real-time features
- **Security Tests**: Authentication, authorization, and input validation
- **Mobile Tests**: Responsive design and touch interactions

Coverage reports are automatically generated and uploaded to Codecov on every CI run.

## Deployment

The app is ready for deployment on Railway or Render:

1. **Production Build**
   ```bash
   npm run build
   ```

2. **Deploy**
   ```bash
   npm run deploy
   ```

3. **Environment Variables**
   - Set production environment variables
   - Configure database connection
   - Update Shopify app URLs

## Security

- All webhook signatures are verified
- Minimal OAuth scopes requested
- Input validation and sanitization
- CSRF protection enabled
- Environment variables for sensitive data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript and ESLint conventions
4. Add tests for new features
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues:
- Check the [documentation](./docs/)
- Review [Shopify App development docs](https://shopify.dev/docs/apps)
- Open an issue in the repository

---

Built with ❤️ using Shopify's latest 2025 best practices.# Deployment trigger Wed  9 Jul 2025 05:35:01 EDT
