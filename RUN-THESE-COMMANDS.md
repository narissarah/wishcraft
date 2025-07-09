# 🚀 WishCraft Final Setup Commands

Your environment is **95% complete**! Just run these commands to finish:

## Step 1: Install PostgreSQL
```bash
brew install postgresql@15
brew services start postgresql@15
```

## Step 2: Create Database
```bash
createdb wishcraft_development
```

## Step 3: Setup Database Schema
```bash
npx prisma generate
npx prisma migrate dev --name init
```

## Step 4: Create Test Data
```bash
npx prisma db seed
```

## Step 5: Start Development Server
```bash
npm run dev
```

## ✅ What's Already Done:
- ✅ All dependencies installed  
- ✅ Environment variables configured
- ✅ Shopify API keys: `3db6e18eb9c8f2a58a4db60b43795edc`
- ✅ Development store: `wishcraft-dev.myshopify.com`
- ✅ Security secrets generated
- ✅ Complete monitoring system implemented
- ✅ Database schema ready
- ✅ Seed file created

## 🎯 After `npm run dev`:
The command will show you an installation URL like:
```
https://wishcraft-dev.myshopify.com/admin/oauth/install_custom_app?client_id=3db6e18eb9c8f2a58a4db60b43795edc
```

Click that URL to install WishCraft on your development store!

## 🔧 Troubleshooting:
If any command fails, you can also run:
```bash
chmod +x quick-setup.sh
./quick-setup.sh
```

Your app will be available at `http://localhost:3000` with full monitoring at `http://localhost:3000/admin/monitoring`!