# WishCraft Setup Commands

## Your Environment is Ready!

✅ **Dependencies installed**
✅ **Shopify API keys configured** 
✅ **Development store URL set**
✅ **Security secrets generated**

## Manual Setup Steps

Run these commands in your terminal:

### Step 1: Install PostgreSQL (if not already installed)
```bash
# Check if PostgreSQL is installed
psql --version

# If not installed, install it:
brew install postgresql@15
brew services start postgresql@15
```

### Step 2: Create Development Database
```bash
# Create the database
createdb wishcraft_development

# Test database connection
psql -d wishcraft_development -c "SELECT version();"
```

### Step 3: Run Database Migrations
```bash
# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate dev --name init

# Optional: View database in browser
npx prisma studio
```

### Step 4: Start Development Server
```bash
# Start the Shopify development server
npm run dev
```

This will:
- Start your WishCraft app
- Create a secure tunnel (ngrok)
- Show you an installation URL

### Step 5: Install App on Development Store
1. The `npm run dev` command will show you a URL like:
   ```
   https://wishcraft-dev.myshopify.com/admin/oauth/install_custom_app?client_id=3db6e18eb9c8f2a58a4db60b43795edc
   ```
2. Click this URL to install WishCraft on your dev store
3. Grant the requested permissions

## Testing Your Setup

Once the app is running, test these URLs:

- **Health Check**: http://localhost:3000/health
- **Database Health**: http://localhost:3000/health/db  
- **Monitoring Dashboard**: http://localhost:3000/admin/monitoring
- **Main App**: http://localhost:3000

## Troubleshooting

### Database Issues:
```bash
# Reset database if needed
npx prisma migrate reset

# Check database status
brew services list | grep postgresql
```

### App Issues:
```bash
# Check logs
npm run dev

# Clear cache
rm -rf node_modules/.cache
rm -rf build
```

### Environment Issues:
```bash
# Verify environment variables
grep -v "^#" .env | grep "="
```

## Next Steps After Setup

1. **Test Registry Creation**: Create a test registry in your app
2. **Add Products**: Add some products from your dev store
3. **Test Group Gifting**: Try the group gifting feature
4. **Check Monitoring**: View metrics at `/admin/monitoring`
5. **Deploy to Railway**: When ready for production

## Ready for Production?

When your app is working locally:
1. **Create Railway account**: https://railway.app
2. **Connect GitHub repo**: Import your wishcraft project
3. **Add environment variables**: Copy from your .env file
4. **Deploy**: Railway will build and deploy automatically

Your monitoring system is fully configured and will start tracking metrics as soon as the app is running!