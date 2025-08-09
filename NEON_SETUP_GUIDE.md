# 🚀 Neon Serverless Postgres Setup Guide for WishCraft

Complete step-by-step guide to set up Neon Serverless PostgreSQL with Prisma for your WishCraft Shopify app.

## 📋 Prerequisites

✅ Vercel account and CLI installed  
✅ WishCraft project deployed to Vercel  
✅ Shopify Partners account with app created  
✅ GitHub account (for Neon integration)

---

## 🗄️ Step 1: Create Neon Database

### 1.1 Sign Up for Neon
1. Go to [Neon Console](https://console.neon.tech/)
2. Sign up with your GitHub account (recommended)
3. Verify your email address

### 1.2 Create New Project
1. Click **"Create Project"**
2. Project Name: **`wishcraft-db`**
3. Database Name: **`wishcraft`** (default)
4. Region: **`US East (Ohio) - aws-us-east-2`** (recommended for Vercel)
5. Postgres Version: **`16`** (latest)
6. Click **"Create Project"**

### 1.3 Get Connection String
After project creation, you'll see the connection details:
1. Copy the **"Connection string"** from the dashboard
2. It looks like: `postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/wishcraft?sslmode=require`
3. **Save this safely** - you'll need it for environment variables

---

## 🔧 Step 2: Configure Environment Variables

### 2.1 Update Vercel Environment Variables
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your **`wishcraft`** project
3. Go to **Settings** → **Environment Variables**
4. Add/Update these variables:

```bash
# Neon Database (Primary)
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/wishcraft?sslmode=require

# Shopify Configuration
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_APP_URL=https://your-vercel-app.vercel.app

# Security Keys (Use the generated ones)
SESSION_SECRET=t7pKcrVtsJuyJ21eFCA7m846vfOTEglxNPe6tFijveQ=
ENCRYPTION_KEY=JpXjutW5AV75GpAlFViLyQSSBBTdrCC4YSDhl6yZ6wk=
ENCRYPTION_SALT=4f0f6b682ec50c75c021c9014b925c1445fce1f1d005262a28b0c573ba103c62
DATA_ENCRYPTION_KEY=ZOzIpYzafT+roeWUF7hFka324TwQgeM9PZyj8pdJKqY=
DATA_ENCRYPTION_SALT=ca55e48830ebd01b7964149c0ee9e8b30f5ab2f6a300eb9b82ffa4a586e99ddd
SEARCH_HASH_KEY=uNnWSEcu+cidKoLnZt8+HmcV9pYaQM6eysRyMN79I6U=
COLLABORATION_TOKEN_SECRET=2K8svKC8jnf+DDlLmg3I/DAksiiYMBlvAPS0gIKayp8=
SHOPIFY_WEBHOOK_SECRET=NiFJnQl+By65pILfT3PmsWzfdLKOQHj7LPyZ1Jv1cKo=

# Environment
NODE_ENV=production
NODE_NO_WARNINGS=1
```

### 2.2 Update Local Environment (Optional)
If developing locally, create `.env.local`:
```bash
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/wishcraft?sslmode=require
SHOPIFY_API_KEY=your_local_api_key
SHOPIFY_API_SECRET=your_local_api_secret
```

---

## 🗃️ Step 3: Set Up Prisma Schema

### 3.1 Verify Prisma Configuration
Your `prisma/schema.prisma` should look like this:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Registry {
  id          String    @id
  shop        String    
  title       String    
  description String?   
  slug        String    @unique
  eventType   String    @default("general")
  eventDate   DateTime?
  visibility  String    @default("public")
  shareUrl    String?   
  viewCount   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // Relations
  items       RegistryItem[]
  analytics   RegistryAnalytics[]
  
  @@index([shop])
  @@index([slug])
  @@map("registries")
}

model RegistryItem {
  id            String    @id
  registryId    String    
  productId     String    
  productTitle  String    
  productHandle String?   
  price         Decimal   @db.Decimal(10, 2)
  compareAtPrice Decimal? @db.Decimal(10, 2)
  quantity      Int       @default(1)
  priority      String    @default("medium")
  purchased     Boolean   @default(false)
  purchasedAt   DateTime?
  purchasedBy   String?   
  notes         String?   
  addedAt       DateTime  @default(now())
  
  // Relations
  registry      Registry  @relation(fields: [registryId], references: [id], onDelete: Cascade)
  
  @@index([registryId])
  @@index([productId])
  @@index([purchased])
  @@map("registry_items")
}

model RegistryAnalytics {
  id         Int      @id @default(autoincrement())
  registryId String   
  eventType  String   
  eventData  Json?    @default("{}")
  userAgent  String?  
  ipAddress  String?  
  createdAt  DateTime @default(now())
  
  // Relations
  registry   Registry @relation(fields: [registryId], references: [id], onDelete: Cascade)
  
  @@index([registryId])
  @@index([eventType])
  @@index([createdAt])
  @@map("registry_analytics")
}
```

### 3.2 Run Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Deploy schema to Neon
npx prisma db push
```

---

## 🧪 Step 4: Test Database Connection

### 4.1 Deploy Updated App
```bash
cd /path/to/wishcraft
vercel --prod
```

### 4.2 Test Database Connection
Visit your test endpoint:
```
https://your-app.vercel.app/api/db-test
```

### 4.3 Expected Successful Response
```json
{
  "success": true,
  "message": "Database tests completed: ALL_TESTS_PASSED",
  "results": {
    "timestamp": "2025-08-08T19:30:00.000Z",
    "environment": "production",
    "database": "Neon PostgreSQL with Prisma",
    "overall_status": "ALL_TESTS_PASSED",
    "summary": {
      "total_tests": 6,
      "passed": 6,
      "failed": 0
    },
    "tests": [
      {
        "name": "Environment Variables",
        "status": "PASSED",
        "details": {
          "database_url": "SET",
          "node_env": "SET"
        }
      },
      {
        "name": "Database Connection",
        "status": "PASSED",
        "details": {
          "message": "Successfully connected to Neon database"
        }
      },
      {
        "name": "Simple Query Test",
        "status": "PASSED",
        "details": {
          "message": "Query execution successful"
        }
      },
      {
        "name": "Database Tables",
        "status": "PASSED",
        "details": {
          "tables": {
            "registry": "EXISTS (0 rows)",
            "registryItem": "EXISTS (0 rows)",
            "registryAnalytics": "EXISTS (0 rows)"
          }
        }
      },
      {
        "name": "CRUD Operations",
        "status": "PASSED",
        "details": {
          "create": "SUCCESS",
          "read": "SUCCESS",
          "update": "SUCCESS",
          "delete": "SUCCESS"
        }
      },
      {
        "name": "Performance Test",
        "status": "PASSED",
        "details": {
          "query_duration_ms": 45,
          "performance": "GOOD"
        }
      }
    ]
  }
}
```

---

## 🎯 Step 5: Test WishCraft App

### 5.1 Access Your App
Visit: `https://your-app.vercel.app/app`

### 5.2 Test Registry Features
1. **Create Registry**: Click "Create New Registry" - should save to Neon
2. **View Registries**: Click "View All Registries" - should load from Neon
3. **Add Items**: Registry items should persist in database
4. **Analytics**: Real analytics should be tracked

### 5.3 Update Shopify Partners
Use your latest deployment URL:
- **App URL**: `https://your-app.vercel.app/app`
- **Redirect URLs**: 
  - `https://your-app.vercel.app/auth/callback`
  - `https://your-app.vercel.app/auth/shopify/callback`

---

## 📊 Step 6: Monitor Database Performance

### 6.1 Neon Console Monitoring
1. Go to [Neon Console](https://console.neon.tech/)
2. Select your project
3. Check **Monitoring** tab for:
   - Query performance
   - Connection usage
   - Storage usage

### 6.2 Prisma Studio (Optional)
For database management:
```bash
# Run locally to manage data
npx prisma studio
```

---

## 🚀 Benefits of Neon + Prisma Setup

### ✅ **Neon Advantages:**
- **Serverless**: Auto-scaling with zero cold starts
- **Free Tier**: 0.5 GB storage, 1 database branch
- **Instant Branching**: Database branches for development
- **Fast**: Sub-10ms latency globally
- **Secure**: Built-in connection pooling and SSL

### ✅ **Prisma Advantages:**
- **Type Safety**: Full TypeScript support
- **Auto-generated Client**: No manual SQL writing
- **Migrations**: Version controlled schema changes
- **IDE Support**: IntelliSense and autocomplete
- **Connection Pooling**: Optimized for serverless

### ✅ **Combined Benefits:**
- **Production Ready**: Enterprise-grade reliability
- **Developer Experience**: Modern tooling and workflows  
- **Scalable**: Handles growth automatically
- **Cost Effective**: Pay only for what you use
- **Built for Shopify**: Optimized for app development

---

## 🔧 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│                 │    │                  │    │                 │
│   Shopify       │    │   WishCraft      │    │   Neon          │
│   Admin         ├────┤   Vercel App     ├────┤   PostgreSQL    │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                               │ Prisma ORM
                               │
                       ┌───────▼───────┐
                       │               │
                       │  API Routes   │
                       │  (Serverless) │
                       │               │
                       └───────────────┘
```

## 🛠️ Database Schema Summary

### **Core Tables:**
1. **`registries`** - Main registry data
2. **`registry_items`** - Items in registries  
3. **`registry_analytics`** - Usage tracking

### **Key Features:**
- Automatic timestamps (`createdAt`, `updatedAt`)
- Foreign key constraints for data integrity
- Optimized indexes for query performance
- JSON fields for flexible analytics data
- Cascade deletes for cleanup

---

## ✅ Final Verification Checklist

- [ ] Neon project created and configured
- [ ] `DATABASE_URL` environment variable set in Vercel
- [ ] All security environment variables configured
- [ ] Prisma schema deployed with `db push`
- [ ] Database test endpoint returns all tests passed
- [ ] WishCraft app loads and functions correctly
- [ ] Registry creation/listing works with real persistence
- [ ] Shopify Partners app URLs updated
- [ ] Monitoring set up in Neon console

## 🎉 Success!

Your WishCraft app now runs on:
✅ **Neon Serverless PostgreSQL** - Enterprise database  
✅ **Prisma ORM** - Modern type-safe data access  
✅ **Vercel Serverless** - Global edge deployment  
✅ **Built for Shopify** - 2025 compliant and ready  

**Production Ready!** 🚀

---

## 📞 Troubleshooting

### Common Issues:

**Database Connection Failed**
- Verify `DATABASE_URL` is correct in Vercel
- Check Neon project is active (not suspended)
- Ensure connection string includes `?sslmode=require`

**Prisma Client Error**
- Run `npx prisma generate` after schema changes
- Redeploy app after Prisma updates

**App Loading Issues**
- Check all environment variables are set
- Verify Shopify API keys are correct
- Ensure app URL matches deployment

**Performance Issues**
- Check Neon connection limits
- Monitor query performance in Neon console
- Consider connection pooling optimization

---

**Support**: Check [Neon Docs](https://neon.tech/docs) and [Prisma Docs](https://www.prisma.io/docs) for detailed guides.