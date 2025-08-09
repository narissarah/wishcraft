# 🔐 WishCraft Environment Setup Guide
## Production Secrets & Configuration Management

**Security Level**: Enterprise Grade  
**Compliance**: GDPR & Built for Shopify Requirements  
**Environment**: Production Ready  

---

## 🎯 **ENVIRONMENT VARIABLES OVERVIEW**

### **Required Environment Variables**
All environment variables must be configured in your Vercel project settings before deployment.

```bash
# Shopify App Configuration (REQUIRED)
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_SCOPES=read_products,write_customers,read_orders
SHOPIFY_APP_URL=https://your-domain.vercel.app

# Database Configuration (REQUIRED - Choose one)
DATABASE_URL=postgresql://username:password@host:5432/database
POSTGRES_PRISMA_URL=postgresql://username:password@host:5432/database?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:5432/database

# Security Configuration (REQUIRED)
SESSION_SECRET=your_32_character_session_secret_here
WEBHOOK_SECRET=your_shopify_webhook_secret_here

# Optional Performance & Monitoring
MONITORING_ENABLED=true
PERFORMANCE_ALERTS=true
ANALYTICS_ENABLED=true
LOG_LEVEL=info
```

---

## 🏪 **SHOPIFY APP CONFIGURATION**

### **Step 1: Create Shopify App**
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Click "Apps" → "Create app" → "Custom app"
3. Fill in app details:
   ```
   App name: WishCraft Gift Registry Manager
   App URL: https://your-domain.vercel.app
   Allowed redirection URLs: https://your-domain.vercel.app/auth/callback
   ```

### **Step 2: Configure App Settings**
```yaml
App Configuration:
  App URL: https://your-domain.vercel.app
  Allowed redirection URLs:
    - https://your-domain.vercel.app/auth/callback
    - https://your-domain.vercel.app/auth/shopify/callback
  
App Scopes (Required):
  - read_products: Access to product catalog for registry items
  - write_customers: Customer data management for registries  
  - read_orders: Order tracking for registry fulfillment

Webhooks (GDPR Mandatory):
  - customers/data_request → https://your-domain.vercel.app/api/webhooks/customers-data-request
  - customers/redact → https://your-domain.vercel.app/api/webhooks/customers-redact
  - shop/redact → https://your-domain.vercel.app/api/webhooks/shop-redact
```

### **Step 3: Get API Credentials**
1. In your app settings, copy the following:
   ```bash
   SHOPIFY_API_KEY=your_api_key_here
   SHOPIFY_API_SECRET=your_api_secret_here
   ```
2. Generate webhook secret in app settings:
   ```bash
   WEBHOOK_SECRET=your_webhook_secret_here
   ```

---

## 🗄️ **DATABASE SETUP OPTIONS**

### **Option 1: Neon PostgreSQL (Recommended)**
1. **Create Account**: Go to [neon.tech](https://neon.tech)
2. **Create Database**: 
   - Project name: `wishcraft-production`
   - Region: Choose closest to your users
   - PostgreSQL version: Latest stable
3. **Get Connection Strings**:
   ```bash
   # From Neon dashboard, copy these values:
   DATABASE_URL=postgresql://[username]:[password]@[host]/[database]?sslmode=require
   POSTGRES_PRISMA_URL=postgresql://[username]:[password]@[host]/[database]?pgbouncer=true&sslmode=require
   POSTGRES_URL_NON_POOLING=postgresql://[username]:[password]@[host]/[database]?sslmode=require
   ```

### **Option 2: Supabase PostgreSQL**
1. **Create Project**: Go to [supabase.com](https://supabase.com)
2. **Get Connection String**: 
   - Go to Settings → Database
   - Copy connection string
   ```bash
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   ```

### **Option 3: Heroku PostgreSQL**
1. **Create Heroku App**: `heroku create wishcraft-db`
2. **Add Postgres**: `heroku addons:create heroku-postgresql:mini`
3. **Get Database URL**: `heroku config:get DATABASE_URL`

### **Database Schema Deployment**
```bash
# After setting up database, deploy schema:
npx prisma migrate deploy

# Or for serverless environments:
npx prisma db push

# Verify connection:
npx prisma db pull
```

---

## 🔒 **SECURITY CONFIGURATION**

### **Session Secret Generation**
```bash
# Generate secure 32-character session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Example output:
SESSION_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### **Webhook Secret Configuration**
1. In Shopify Partner Dashboard → Your App → App setup
2. Scroll down to "Webhooks" section
3. Generate webhook secret
4. Copy to environment variables:
   ```bash
   WEBHOOK_SECRET=your_generated_webhook_secret
   ```

### **HTTPS and SSL Configuration**
- Vercel automatically provides SSL certificates
- All HTTP traffic is automatically redirected to HTTPS
- Custom domains require DNS configuration

---

## 🚀 **VERCEL DEPLOYMENT CONFIGURATION**

### **Step 1: Install Vercel CLI**
```bash
npm install -g vercel
vercel login
```

### **Step 2: Configure Environment Variables**
```bash
# Navigate to your project directory
cd /path/to/wishcraft

# Set environment variables (interactive)
vercel env add SHOPIFY_API_KEY
vercel env add SHOPIFY_API_SECRET
vercel env add DATABASE_URL
vercel env add SESSION_SECRET
vercel env add WEBHOOK_SECRET

# Or use Vercel dashboard:
# 1. Go to vercel.com/dashboard
# 2. Select your project
# 3. Settings → Environment Variables
# 4. Add each variable for "Production" environment
```

### **Step 3: Deploy to Production**
```bash
# Deploy to production
vercel --prod

# Or use the automated script
./scripts/deploy-production.sh production
```

---

## 📊 **MONITORING & ANALYTICS CONFIGURATION**

### **Performance Monitoring Setup**
```bash
# Optional monitoring configuration
MONITORING_ENABLED=true
PERFORMANCE_ALERTS=true
ALERT_THRESHOLD_LCP=2000  # Alert if LCP > 2s
ALERT_THRESHOLD_CLS=0.08  # Alert if CLS > 0.08
ALERT_THRESHOLD_INP=175   # Alert if INP > 175ms
ALERT_THRESHOLD_TTFB=500  # Alert if TTFB > 500ms
```

### **Analytics Configuration**
```bash
# Privacy-compliant analytics
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90
GDPR_COMPLIANT_TRACKING=true

# Optional: External analytics integration
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX  # If using GA4
MIXPANEL_TOKEN=your_mixpanel_token  # If using Mixpanel
```

### **Logging Configuration**
```bash
# Production logging
LOG_LEVEL=info  # options: debug, info, warn, error
LOG_FORMAT=json  # Structured logging for production
ERROR_REPORTING=true
```

---

## 🛡️ **SECURITY BEST PRACTICES**

### **Environment Variable Security**
- ✅ **Never commit secrets to version control**
- ✅ **Use different secrets for development/production**
- ✅ **Rotate secrets regularly (quarterly)**
- ✅ **Use strong, randomly generated secrets**
- ✅ **Limit access to production environment variables**

### **Database Security**
- ✅ **Use SSL/TLS for all database connections**
- ✅ **Enable connection pooling for performance**
- ✅ **Use read-only replicas for reporting (if needed)**
- ✅ **Regular database backups (automated)**
- ✅ **Monitor for suspicious database activity**

### **API Security**
- ✅ **HTTPS enforcement across all endpoints**
- ✅ **Rate limiting on API endpoints**
- ✅ **Input validation and sanitization**
- ✅ **CSRF protection with session tokens**
- ✅ **Regular security audits and updates**

---

## 🔍 **ENVIRONMENT VALIDATION**

### **Pre-Deployment Validation Script**
```bash
#!/bin/bash
# validate-environment.sh

echo "🔍 Validating Environment Configuration..."

# Check required environment variables
required_vars=(
    "SHOPIFY_API_KEY"
    "SHOPIFY_API_SECRET"
    "DATABASE_URL"
    "SESSION_SECRET"
    "WEBHOOK_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

echo "✅ All required environment variables present"

# Validate database connection
echo "🔍 Testing database connection..."
if npx prisma db pull > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Validate session secret strength
if [ ${#SESSION_SECRET} -lt 32 ]; then
    echo "⚠️ Session secret should be at least 32 characters"
fi

echo "🎉 Environment validation completed successfully!"
```

### **Post-Deployment Verification**
```bash
# Test all critical endpoints
endpoints=(
    "https://your-domain.vercel.app/"
    "https://your-domain.vercel.app/app"
    "https://your-domain.vercel.app/performance"
    "https://your-domain.vercel.app/health"
)

for endpoint in "${endpoints[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
    if [ "$status" -eq 200 ]; then
        echo "✅ $endpoint - OK"
    else
        echo "❌ $endpoint - Status: $status"
    fi
done
```

---

## 🏗️ **INFRASTRUCTURE AS CODE**

### **Environment Configuration Template**
```yaml
# vercel.json environment template
{
  "env": {
    "SHOPIFY_API_KEY": "@shopify-api-key",
    "SHOPIFY_API_SECRET": "@shopify-api-secret",
    "DATABASE_URL": "@database-url",
    "SESSION_SECRET": "@session-secret",
    "WEBHOOK_SECRET": "@webhook-secret"
  },
  "build": {
    "env": {
      "MONITORING_ENABLED": "true",
      "PERFORMANCE_ALERTS": "true"
    }
  }
}
```

### **Automated Environment Setup**
```bash
#!/bin/bash
# setup-production-environment.sh

echo "🚀 Setting up WishCraft production environment..."

# Verify Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Login to Vercel
vercel login

# Link project
vercel link

# Set up environment variables
echo "Setting up environment variables..."
vercel env add SHOPIFY_API_KEY production
vercel env add SHOPIFY_API_SECRET production
vercel env add DATABASE_URL production
vercel env add SESSION_SECRET production
vercel env add WEBHOOK_SECRET production

# Optional monitoring variables
vercel env add MONITORING_ENABLED production "true"
vercel env add PERFORMANCE_ALERTS production "true"

echo "✅ Production environment setup completed!"
```

---

## 📋 **ENVIRONMENT CHECKLIST**

### **Pre-Deployment Checklist**
- [ ] **Shopify App Created**: App registered in Partner Dashboard
- [ ] **API Credentials**: SHOPIFY_API_KEY and SHOPIFY_API_SECRET configured
- [ ] **Database Setup**: PostgreSQL database provisioned and accessible
- [ ] **Database Schema**: Prisma schema deployed successfully
- [ ] **Security Secrets**: SESSION_SECRET and WEBHOOK_SECRET generated
- [ ] **Environment Variables**: All required variables set in Vercel
- [ ] **HTTPS Configuration**: SSL certificates active and verified
- [ ] **Webhook Endpoints**: All GDPR webhooks configured in Shopify

### **Post-Deployment Verification**
- [ ] **Application Access**: All endpoints responding with 200 status
- [ ] **Database Connectivity**: Database queries executing successfully
- [ ] **Performance Monitoring**: Core Web Vitals tracking active
- [ ] **Security Headers**: HTTPS enforcement and security headers set
- [ ] **Error Handling**: Error tracking and logging operational
- [ ] **Monitoring Dashboards**: Performance and health monitoring active

---

## 🚨 **TROUBLESHOOTING COMMON ISSUES**

### **Database Connection Issues**
```bash
# Test database connection
npx prisma db pull

# Common fixes:
# 1. Check DATABASE_URL format
# 2. Verify database is accessible from Vercel
# 3. Ensure SSL mode is enabled for production
# 4. Check connection pooling settings
```

### **Shopify Authentication Issues**
```bash
# Verify app configuration
curl -X GET "https://your-domain.vercel.app/auth/shopify?shop=your-test-shop"

# Common fixes:
# 1. Check SHOPIFY_API_KEY matches Partner Dashboard
# 2. Verify allowed redirection URLs include /auth/callback
# 3. Ensure app URL matches production domain
# 4. Check app permissions (scopes) are correct
```

### **Webhook Verification Issues**
```bash
# Test webhook endpoint
curl -X POST "https://your-domain.vercel.app/api/webhooks/customers-data-request" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: test" \
  -d '{"test": "data"}'

# Common fixes:
# 1. Verify WEBHOOK_SECRET matches Shopify configuration
# 2. Check HMAC signature verification implementation
# 3. Ensure webhook URLs are accessible publicly
# 4. Verify content-type headers are correct
```

---

## 📞 **SUPPORT & RESOURCES**

### **Environment Setup Support**
- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Shopify App Development**: [shopify.dev/docs/apps](https://shopify.dev/docs/apps)
- **PostgreSQL Hosting**: Provider-specific documentation
- **Built for Shopify Requirements**: [shopify.dev/docs/apps/store/requirements](https://shopify.dev/docs/apps/store/requirements)

### **Security Resources**
- **OWASP Security Guidelines**: [owasp.org](https://owasp.org)
- **GDPR Compliance**: [gdpr.eu](https://gdpr.eu)
- **Shopify Security Best Practices**: [shopify.dev/docs/apps/best-practices/security](https://shopify.dev/docs/apps/best-practices/security)

---

**🔐 Environment Configuration Complete: Production-Ready Security & Performance! 🔐**

*This comprehensive environment setup ensures enterprise-grade security, Built for Shopify compliance, and production-ready performance for WishCraft deployment.*