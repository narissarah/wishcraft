# 🎁 WishCraft - Shopify Gift Registry App

**Built for Shopify 2025** - A comprehensive gift registry and wishlist management app for Shopify stores.

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x
- Shopify Partner account
- PostgreSQL database (Vercel Postgres recommended)

### Development Setup
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Set up database
npx prisma db push

# Start development server
npm run dev
```

### Production Deployment
```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# See .env.example for required variables
```

## 📋 Environment Variables

See `.env.example` for complete configuration template.

**Required**:
- `SHOPIFY_API_KEY` - From Shopify Partner Dashboard
- `SHOPIFY_API_SECRET` - From Shopify Partner Dashboard  
- `SHOPIFY_APP_URL` - Your Vercel domain
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - 32-character secret for sessions

## 🏗️ Architecture

- **Framework**: Remix (React-based full-stack framework)
- **Database**: PostgreSQL with Prisma ORM
- **Hosting**: Vercel serverless deployment
- **UI**: Shopify Polaris design system
- **Authentication**: Shopify App Bridge for embedded apps

## 📁 Project Structure

```
wishcraft/
├── app/                 # Remix application
│   ├── routes/         # App routes
│   ├── components/     # React components
│   ├── lib/           # Utilities and server code
│   └── styles/        # CSS files
├── prisma/            # Database schema and migrations
├── public/            # Static assets
├── docs/              # Project documentation
├── package.json       # Dependencies and scripts
├── remix.config.js    # Remix configuration
└── vercel.json        # Vercel deployment configuration
```

## 🛡️ Security Features

- GDPR compliant with mandatory webhooks
- Session token authentication
- CSRF protection
- Encrypted customer data
- HTTPS enforcement

## 📞 Support

For deployment issues or questions, refer to the documentation in the `/docs` directory.