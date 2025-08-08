# 🚀 Vercel + Database Auto-Sync Setup Guide

This guide will help you connect your database to Vercel so everything syncs automatically.

## 🎯 Option 1: Vercel Postgres (Recommended - Auto-Sync)

### Step 1: Add Vercel Postgres to Your Project
1. **Go to**: https://vercel.com/dashboard
2. **Select**: Your WishCraft project
3. **Click**: "Storage" tab
4. **Click**: "Create Database" → "Postgres"
5. **Name**: `wishcraft-db`
6. **Region**: Choose closest to your users
7. **Click**: "Create"

### Step 2: Auto-Environment Variables
✅ **Vercel automatically adds these for you:**
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL` 
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST` 
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

### Step 3: Add Required Security Variables
**Go to**: Settings → Environment Variables and add these:

```bash
# Copy these exact values:
DATABASE_URL=${POSTGRES_PRISMA_URL}
SESSION_SECRET=oKcubOexqzOHG2HbGFDcsE1naR0H9PoVB2DtOdj6OTA=
ENCRYPTION_KEY=M7laXLVt/w51zb/LNn+hMNnaViRZt2ShUz+rqRHf4hM=
ENCRYPTION_SALT=a87ccbefab4accbc456e704d35e5c7e237c560e8f12188ed85579045f0afd613
DATA_ENCRYPTION_KEY=1NQAM+egMpV7YE5JDMEH22hAVciuHJHkbyLwZVEKU+o=
DATA_ENCRYPTION_SALT=04c44d6fd79439169805905d3ae42e8b26a99a2caa9f6bc705dd671901e7871b
SEARCH_HASH_KEY=Vkx6aggOiRjhFWIgm5E8QXTH4VfbTDH8o7lAELEW5WI=
COLLABORATION_TOKEN_SECRET=VH3963CNPixB6VOd9AfEUKoiOnjvrtGvmwd9QfB/8e0=
NODE_ENV=production
NODE_NO_WARNINGS=1
```

---

## 🎯 Option 2: Neon Database (Free Alternative)

### Step 1: Create Neon Database
1. **Go to**: https://console.neon.tech/
2. **Sign in** with GitHub
3. **Create Project**: "wishcraft"
4. **Copy** the connection string (looks like):
   ```
   postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Add to Vercel Environment Variables
1. **Go to**: https://vercel.com/dashboard → Your project → Settings → Environment Variables
2. **Add**:
```bash
DATABASE_URL=postgresql://your-neon-connection-string
SESSION_SECRET=oKcubOexqzOHG2HbGFDcsE1naR0H9PoVB2DtOdj6OTA=
ENCRYPTION_KEY=M7laXLVt/w51zb/LNn+hMNnaViRZt2ShUz+rqRHf4hM=
ENCRYPTION_SALT=a87ccbefab4accbc456e704d35e5c7e237c560e8f12188ed85579045f0afd613
DATA_ENCRYPTION_KEY=1NQAM+egMpV7YE5JDMEH22hAVciuHJHkbyLwZVEKU+o=
DATA_ENCRYPTION_SALT=04c44d6fd79439169805905d3ae42e8b26a99a2caa9f6bc705dd671901e7871b
SEARCH_HASH_KEY=Vkx6aggOiRjhFWIgm5E8QXTH4VfbTDH8o7lAELEW5WI=
COLLABORATION_TOKEN_SECRET=VH3963CNPixB6VOd9AfEUKoiOnjvrtGvmwd9QfB/8e0=
NODE_ENV=production
NODE_NO_WARNINGS=1
```

---

## ✅ Step 3: Test Auto-Sync (Both Options)

### 3.1 Trigger Deployment
- **Push any change** to your repo, or
- **Go to Vercel Dashboard** → Deployments → "Redeploy"

### 3.2 Check Database Status
Visit: `https://wishcraft-jqqy1p5kz-narissarahs-projects.vercel.app/api/db-status`

**Look for**:
```json
{
  "success": true,
  "status": "ready",
  "message": "Database is ready to use"
}
```

---

## 🎉 Step 4: Switch to Real Database

Once you see `"success": true`, I'll help you:
1. **Switch** from mock API to real database
2. **Test** registry creation with persistence
3. **Enable** full Shopify product integration

---

## 🛠 Quick Commands (After Database is Connected)

```bash
# Test locally (optional)
export DATABASE_URL="your-connection-string"
npx prisma migrate deploy
npx prisma generate
```

---

## 🆘 Troubleshooting

### If DATABASE_URL shows "NOT_SET":
1. Check environment variables are saved in Vercel dashboard
2. Redeploy after adding variables
3. Verify connection string format

### If connection fails:
1. Check Vercel function logs
2. Verify database service is running
3. Test connection string format

---

## 💡 Why This Works

- **Vercel Postgres**: Auto-creates and syncs environment variables
- **Environment Variables**: Automatically available to all functions
- **No Manual Setup**: Database tables created automatically on first connection
- **Instant Persistence**: All registry data saves permanently

**Your current app works perfectly with mock data. Database connection just makes everything permanent!**