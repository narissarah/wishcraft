# Railway Deployment Debug Guide

## 🚨 Current Issue
Your Railway deployment is failing during the `npm ci` stage in the Docker build process.

## 🔍 Root Causes Identified

1. **Conflicting Railway Configurations**
   - `railway.json` (using NIXPACKS)
   - `deploy/railway.toml` (using DOCKERFILE)
   - Railway is confused about which to use

2. **Platform-Specific Dependencies**
   - Your `package-lock.json` was generated on macOS
   - Railway uses Alpine Linux in Docker
   - Native modules (like Prisma) need platform-specific binaries

3. **npm ci vs npm install**
   - `npm ci` fails silently without detailed errors
   - Platform mismatches cause it to fail

## ✅ Quick Fix Steps

```bash
# Run the automated fix script
./fix-railway-deployment.sh
```

## 🔧 Manual Fix Steps

### 1. Remove Conflicting Config
```bash
mv railway.json railway.json.backup
```

### 2. Clean Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
npx prisma generate
```

### 3. Update DATABASE_URL if needed
```bash
# Ensure SSL mode is included
railway variables --set "DATABASE_URL=postgresql://...?sslmode=require"
```

### 4. Deploy
```bash
railway up
```

## 🐛 If Deployment Still Fails

### Option 1: Use NIXPACKS Instead
```bash
# Restore railway.json
mv railway.json.backup railway.json
# Remove Docker config
mv deploy/railway.toml deploy/railway.toml.backup
# Deploy with NIXPACKS
railway up
```

### Option 2: Debug Docker Build
```bash
# Build locally to see errors
docker build -t wishcraft-debug .
```

### Option 3: Simplified Dockerfile
Create a `Dockerfile.simple`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Then update railway.toml:
```toml
[build]
dockerfilePath = "./Dockerfile.simple"
```

## 📊 Monitoring Deployment

```bash
# Watch logs during deployment
railway logs

# Check deployment status
railway status

# Test deployed app
curl -I https://wishcraft-production.up.railway.app/health
```

## 🔑 Environment Variables Required

```bash
DATABASE_URL=postgresql://...?sslmode=require
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret
SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app
SESSION_SECRET=your_session_secret
```

## 🆘 Emergency Rollback

```bash
# List deployments
railway deployments

# Rollback to previous
railway down
```

## 💡 Pro Tips

1. **Always test locally first:**
   ```bash
   npm run build
   npm start
   ```

2. **Check Railway service logs:**
   ```bash
   railway logs --service wishcraft
   ```

3. **Verify database connection:**
   ```bash
   railway run npm run debug:db
   ```

4. **If using custom domains:**
   ```bash
   railway domain
   ```

## 🎯 Success Indicators

- ✅ Railway deployment shows "Deployed"
- ✅ Health check returns 200: `curl https://wishcraft-production.up.railway.app/health`
- ✅ Database connection successful
- ✅ No errors in Railway logs

## 📞 Still Having Issues?

1. Check Railway status page: https://railway.app/status
2. Review deployment logs in detail
3. Try NIXPACKS instead of Docker
4. Simplify Dockerfile to isolate issues