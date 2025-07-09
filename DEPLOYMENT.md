# WishCraft Production Deployment Guide

This guide covers the complete production deployment process for WishCraft, following Shopify's hosting recommendations and industry best practices.

## 🚀 Quick Deployment

For experienced users, deploy to production with:

```bash
# Railway deployment
npm run deploy:production railway

# Render deployment  
npm run deploy:production render

# Docker deployment
npm run deploy:production docker
```

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **PostgreSQL**: 13+ with SSL support
- **Redis**: 6+ for session storage and caching
- **Git**: For version control and deployment

### Required Environment Variables

Create `.env.production` file with these required variables:

```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=read_products,write_products,read_customers,write_customers,read_orders,write_orders
HOST=https://your-app-domain.com

# Database
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Security
SESSION_SECRET=your_64_char_random_string
ENCRYPTION_KEY=your_32_char_encryption_key
WEBHOOK_SECRET=your_webhook_verification_secret

# Monitoring (Optional but recommended)
DATADOG_API_KEY=your_datadog_key
SENTRY_DSN=your_sentry_dsn
SLACK_WEBHOOK_URL=your_slack_webhook
```

### Platform-Specific Setup

#### Railway Deployment
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link`
4. Set environment variables in Railway dashboard

#### Render Deployment
1. Connect GitHub repository in Render dashboard
2. Configure build and start commands
3. Set environment variables in Render dashboard
4. Configure custom domain (optional)

#### Docker Deployment
1. Install Docker and Docker Compose
2. Configure container registry access
3. Set up orchestration (Kubernetes/Docker Swarm)

## 🔧 Deployment Steps

### 1. Pre-Deployment Checks

The deployment script automatically performs these checks:

- ✅ Node.js version compatibility
- ✅ Environment variables validation
- ✅ TypeScript compilation
- ✅ ESLint code quality
- ✅ Unit test execution
- ✅ Security audit
- ✅ Performance budget validation
- ✅ Bundle size limits

### 2. Database Setup

#### Migration
```bash
# Run database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

#### Backup Strategy
- **Automated daily backups** at 2 AM UTC
- **30-day retention** for full backups
- **Multi-destination storage** (S3, GCS)
- **Encryption** with AES-256
- **Integrity verification** with test restores

### 3. Security Configuration

#### SSL/TLS
- **Automatic HTTPS enforcement**
- **HSTS headers** with 1-year max age
- **SSL certificate** auto-renewal
- **TLS 1.2+ only**

#### Content Security Policy
```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "https://cdn.shopify.com"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", "https://*.shopify.com"]
}
```

#### Rate Limiting
- **General requests**: 1000/15min per IP
- **API endpoints**: 100/15min per IP  
- **Webhooks**: 50/5min per IP
- **Progressive slowdown** for excessive requests

### 4. Performance Optimization

#### Caching Strategy
- **Static assets**: 1 year cache with immutable flag
- **API responses**: 5 minutes with stale-while-revalidate
- **Images**: 30 days with CDN optimization
- **Service Worker**: Offline-first for critical resources

#### Monitoring
- **Core Web Vitals** tracking
- **Real User Monitoring** (RUM)
- **Application Performance Monitoring** (APM)
- **Error tracking** with Sentry
- **Custom metrics** with StatsD

### 5. Health Checks

The application exposes these health check endpoints:

- `/health` - Application health
- `/health/db` - Database connectivity  
- `/health/shopify` - Shopify API status
- `/health/performance` - Performance metrics

## 📊 Monitoring & Alerting

### Performance Metrics
- **Response time**: Average < 2s, P95 < 3s
- **Error rate**: < 5% overall
- **Uptime**: > 99.9% availability
- **Memory usage**: < 80% of allocated
- **CPU usage**: < 80% average

### Alert Thresholds
- 🔴 **Critical**: Error rate > 10%, Response time > 5s
- 🟡 **Warning**: Error rate > 5%, Response time > 2s
- 📊 **Info**: Performance budget violations

### Notification Channels
- **Slack**: Real-time alerts and deployment notifications
- **Email**: Daily performance reports
- **PagerDuty**: Critical alerts for on-call response

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The deployment pipeline includes:

1. **Security Scan** - Dependency vulnerabilities
2. **Quality Checks** - TypeScript, ESLint, tests
3. **Build** - Application build and Docker image
4. **Deploy** - Platform-specific deployment
5. **Health Check** - Post-deployment verification
6. **Monitoring** - Performance tracking setup

### Deployment Strategies

#### Blue-Green Deployment
- **Zero-downtime** deployments
- **Instant rollback** capability
- **Health check** validation before traffic switch

#### Rolling Updates
- **Gradual deployment** across instances
- **Automatic rollback** on failure
- **Configurable** update pace

## 🗄️ Backup & Recovery

### Database Backups
```bash
# Manual backup
./deploy/backup.sh full

# Schema-only backup
./deploy/backup.sh schema

# Data-only backup  
./deploy/backup.sh data
```

### Disaster Recovery
- **RTO** (Recovery Time Objective): < 1 hour
- **RPO** (Recovery Point Objective): < 4 hours
- **Multi-region** deployment capability
- **Automated failover** procedures

## 🔍 Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check logs
railway logs --environment=production

# Verify environment variables
railway vars --environment=production

# Test build locally
npm run build
```

#### Database Connection Issues
```bash
# Test database connectivity
npx prisma db pull

# Check SSL configuration
psql $DATABASE_URL -c "SELECT version();"

# Verify migrations
npx prisma migrate status
```

#### Performance Issues
```bash
# Check performance metrics
npm run performance:report

# Run performance audit
npm run performance:audit

# Check bundle size
npm run bundle:analyze
```

### Log Analysis

#### Structured Logging
```json
{
  "timestamp": "2025-01-05T10:30:00.000Z",
  "level": "error",
  "message": "Database query timeout",
  "service": "wishcraft",
  "environment": "production",
  "queryName": "getRegistries",
  "duration": 5000,
  "error": "QueryTimeout"
}
```

#### Log Aggregation
- **Datadog Logs**: Centralized log management
- **Search & Filter**: Quick issue identification
- **Alerting**: Automated error detection
- **Retention**: 30-day log retention

## 📈 Scaling

### Horizontal Scaling
- **Auto-scaling**: CPU and memory based
- **Load balancing**: Multiple instance distribution
- **Session management**: Redis-based sessions
- **Database**: Connection pooling optimization

### Vertical Scaling
- **Memory**: 2GB → 8GB based on load
- **CPU**: 2 vCPU → 8 vCPU for peak traffic
- **Storage**: Auto-expanding disk allocation

### CDN & Caching
- **Global CDN**: CloudFlare or CloudFront
- **Edge caching**: Static asset optimization
- **API caching**: GraphQL response caching
- **Image optimization**: WebP/AVIF conversion

## 🔐 Security Best Practices

### Runtime Security
- **Container scanning**: Vulnerability detection
- **Dependency updates**: Automated security patches
- **Secret management**: Environment-based secrets
- **Network isolation**: VPC and firewall rules

### Compliance
- **GDPR**: Data protection compliance
- **SOC 2**: Security framework adherence
- **PCI DSS**: Payment data security (if applicable)
- **Shopify Partners**: App review requirements

## 📞 Support & Maintenance

### Regular Maintenance
- **Weekly**: Dependency updates and security patches
- **Monthly**: Performance optimization reviews
- **Quarterly**: Disaster recovery testing
- **Annually**: Security audit and penetration testing

### Emergency Contacts
- **On-call Engineer**: alerts@wishcraft.com
- **Platform Support**: Railway/Render support
- **Security Issues**: security@wishcraft.com

## 📚 Additional Resources

- [Shopify App Architecture](https://shopify.dev/docs/apps/architecture)
- [Railway Deployment Docs](https://docs.railway.app/)
- [Render Deployment Guide](https://render.com/docs)
- [Performance Best Practices](./PERFORMANCE.md)
- [Security Guidelines](./SECURITY.md)

---

## 🚀 Deploy Commands Reference

```bash
# Full production deployment
./deploy/deploy.sh production railway

# Dry run (test without deploying)
./deploy/deploy.sh production railway --dry-run

# Skip tests (not recommended)
./deploy/deploy.sh production railway --skip-tests

# Emergency deployment (skip backup)
./deploy/deploy.sh production railway --skip-backup

# Docker deployment
./deploy/deploy.sh production docker

# Manual health check
curl -f https://your-app.com/health
```

Remember to always test deployments in a staging environment before deploying to production!