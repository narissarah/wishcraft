# WishCraft - Native Shopify Gift Registry App

[![Shopify App](https://img.shields.io/badge/Shopify-App-7AB55C)](https://shopify.dev)
[![Built with Remix](https://img.shields.io/badge/Built%20with-Remix-000)](https://remix.run)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Shopify API](https://img.shields.io/badge/API-2025--07-green)](https://shopify.dev/api)

WishCraft is a production-ready Shopify gift registry app that provides seamless integration with Shopify's inventory and order management systems. Built with modern technologies and following Shopify's 2025 best practices, it offers superior native integration compared to third-party solutions.

## 🚀 Features

- **Native Shopify Integration**: Deep integration with Shopify's admin interface and storefront
- **Real-time Inventory Sync**: Automatic inventory tracking and availability updates
- **GDPR Compliant**: Full compliance with data privacy regulations
- **Performance Optimized**: Multi-level caching, optimized queries, and bundle splitting
- **Security First**: CSRF protection, webhook verification, and encrypted sessions
- **Mobile Responsive**: Works seamlessly across all devices
- **Gift Registry Management**: Create, share, and manage gift registries
- **Purchase Tracking**: Real-time tracking of registry purchases
- **Theme Extensions**: Easy storefront integration with Liquid blocks

## 📋 Prerequisites

- Node.js 18.20.0 or higher
- PostgreSQL 13 or higher
- Shopify Partner account
- Shopify development store for testing

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wishcraft-team/wishcraft.git
   cd wishcraft
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your credentials:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/wishcraft
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SHOPIFY_APP_URL=https://your-app-url.com
   SHOPIFY_SCOPES=read_customers,write_customers,read_products,read_orders,write_orders,read_inventory,write_content
   ```

4. **Set up the database**
   ```bash
   npm run db:migrate
   ```

5. **Generate SSL certificates for local development**
   ```bash
   npm run generate-certs
   ```

## 🚀 Development

Start the development server:

```bash
npm run dev
```

This will start:
- Shopify CLI tunnel for app preview
- Remix development server on https://localhost:3000
- Database migrations (if needed)

### Available Scripts

- `npm run dev` - Start development server with Shopify CLI
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database
- `npm run test` - Run test suite

## 📱 App Structure

```
wishcraft/
├── app/                    # Remix application
│   ├── routes/            # Route handlers and API endpoints
│   ├── components/        # React components
│   ├── lib/              # Business logic and utilities
│   └── styles/           # SCSS stylesheets
├── extensions/           # Shopify app extensions
│   └── theme-extension/  # Storefront theme extension
├── prisma/              # Database schema and migrations
├── public/              # Static assets
├── scripts/             # Utility scripts
└── tests/               # Test suites
```

## 🔒 Security

WishCraft implements multiple security layers:

- **CSRF Protection**: Double-submit cookie pattern with origin validation
- **Session Security**: Encrypted sessions with secure cookies
- **Webhook Verification**: HMAC signature verification on all webhooks
- **Rate Limiting**: Configurable rate limits for API endpoints
- **Content Security Policy**: Strict CSP headers for XSS prevention
- **Input Validation**: Comprehensive validation using Zod schemas

## 🎯 API Endpoints

### Registry Management
- `GET /api/registries` - List all registries
- `POST /api/registries` - Create a new registry
- `GET /api/registries/:id` - Get registry details
- `PUT /api/registries/:id` - Update registry
- `DELETE /api/registries/:id` - Delete registry

### Health Checks
- `GET /health` - Application health status
- `GET /health/liveness` - Kubernetes liveness probe
- `GET /health/readiness` - Kubernetes readiness probe

### Webhooks
All webhooks are automatically registered and verified:
- `/webhooks/app/uninstalled`
- `/webhooks/customers/data_request` (GDPR)
- `/webhooks/customers/redact` (GDPR)
- `/webhooks/shop/redact` (GDPR)
- `/webhooks/orders/create`
- `/webhooks/products/update`
- `/webhooks/inventory_levels/update`

## 🚢 Deployment

### Railway/Render (Recommended)

1. Push to GitHub
2. Connect your repository to Railway/Render
3. Set environment variables
4. Deploy

### Manual Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Run database migrations:
   ```bash
   npm run db:migrate
   ```

3. Start the production server:
   ```bash
   npm start
   ```

### Docker Deployment

```bash
docker build -t wishcraft .
docker run -p 3000:3000 --env-file .env wishcraft
```

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## 🔄 Database Migrations

Create a new migration:

```bash
npx prisma migrate dev --name your_migration_name
```

Apply migrations in production:

```bash
npx prisma migrate deploy
```

## 📊 Performance Monitoring

WishCraft includes built-in performance monitoring:

- Core Web Vitals tracking
- Custom performance metrics
- Error tracking with Sentry integration
- Structured logging with Winston

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- [Documentation](https://github.com/wishcraft-team/wishcraft/wiki)
- [Issue Tracker](https://github.com/wishcraft-team/wishcraft/issues)
- [Shopify Community](https://community.shopify.com)

## 🙏 Acknowledgments

- Built with [Remix](https://remix.run)
- UI components from [Shopify Polaris](https://polaris.shopify.com)
- Database ORM by [Prisma](https://www.prisma.io)

---

Built with ❤️ for the Shopify ecosystem