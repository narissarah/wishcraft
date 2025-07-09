# WishCraft - Shopify Gift Registry App

## Project Overview
WishCraft is a native Shopify gift registry app that provides seamless integration with Shopify's inventory and order management. It's inspired by MyRegistry but with superior Shopify integration, real-time inventory sync, and native admin experience.

## Tech Stack (2025 Best Practices)
- **Framework**: Remix with React Router 7
- **API**: GraphQL Admin API (mandatory 2025)
- **UI**: Polaris React v12+ for admin, Polaris Web Components for storefront
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Shopify OAuth 2.0 + Customer Account API
- **Real-time**: Webhooks + WebSocket for collaborative features
- **Deployment**: Railway/Render (Shopify recommended)

## Development Environment
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run test`: Run test suite
- `npm run shopify app dev`: Start Shopify CLI development
- `npm run db:migrate`: Run database migrations
- `npm run db:reset`: Reset database
- `npm run typecheck`: Run TypeScript checks

## Code Style Guidelines
- Use TypeScript for all new files
- Use ES modules (import/export) syntax
- Follow Shopify's GraphQL naming conventions
- Use Polaris React components exclusively for admin UI
- Implement proper error boundaries in React
- Follow container/presentational component pattern

## Shopify Best Practices
- Always use GraphQL Admin API (REST is legacy)
- Implement proper webhook HMAC verification
- Use Customer Account API for authentication
- Follow Polaris design system exactly
- Use Theme App Extensions for storefront integration
- Implement proper rate limiting and error handling
- Use Shopify Functions for business logic when possible

## Security Requirements
- Validate all webhook signatures with HMAC
- Use minimal OAuth scopes (read_customers, write_orders, read_products)
- Implement proper CSRF protection
- Never store API credentials in client-side code
- Use Shopify's fraud protection systems

## Database Schema Patterns
- Use app-prefixed namespaces for metafields
- Store Shopify IDs as strings (they're Global IDs)
- Implement soft deletes for important data
- Use proper indexing for performance
- Follow GDPR compliance patterns

## Workflow Requirements
- Always run tests before committing
- Use conventional commit messages
- Follow GitFlow branching strategy
- Request permission before destructive operations
- Use Context7 for latest Shopify documentation
- Implement TDD for all new features

## MCP Server Usage
- Use "use context7" to access latest Shopify docs
- Use Context7 for Polaris React component documentation
- Always verify GraphQL schema with latest API docs
- Check Shopify changelog before implementing new features

## Project Architecture
wishcraft/
├── app/                    # Remix app directory
│   ├── routes/            # Route handlers
│   ├── components/        # Reusable UI components
│   ├── lib/              # Utility functions
│   └── styles/           # CSS/styling
├── prisma/               # Database schema and migrations
├── extensions/           # Shopify app extensions
│   ├── theme-extension/  # Storefront integration
│   └── admin-extension/  # Admin UI extension
├── functions/            # Shopify Functions
├── tests/               # Test files
└── docs/                # Project documentation

## Current Phase: Initial Setup
We're currently setting up the development environment and creating the foundational architecture.

## Next Steps
1. Initialize Shopify app with CLI
2. Set up database schema
3. Implement OAuth authentication
4. Create basic admin interface
5. Develop registry CRUD operations
