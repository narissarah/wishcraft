# WishCraft Deployment Guide

## Overview
This guide covers the deployment process for WishCraft, a Shopify gift registry app, using Railway for hosting and GitHub Actions for CI/CD.

## Prerequisites

### Required Accounts
- GitHub account with repository access
- Railway account (https://railway.app)
- Shopify Partner account for app credentials

### Required Secrets

Configure the following secrets in your GitHub repository settings:

#### GitHub Secrets
```
RAILWAY_TOKEN=your_railway_token
SLACK_WEBHOOK=your_slack_webhook_url
SONAR_TOKEN=your_sonarcloud_token
COSIGN_PRIVATE_KEY=your_cosign_private_key
COSIGN_PASSWORD=your_cosign_password
```

#### Railway Environment Variables

##### Production Environment
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:port/database
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_APP_URL=https://wishcraft.up.railway.app
SESSION_SECRET=your_session_secret_minimum_32_characters
ENCRYPTION_KEY=your_encryption_key_32_characters_long
WEBHOOK_SECRET=your_webhook_secret
```

##### Staging Environment
```
NODE_ENV=staging
PORT=3000
DATABASE_URL=postgresql://user:password@staging-host:port/database
SHOPIFY_API_KEY=your_shopify_staging_api_key
SHOPIFY_API_SECRET=your_shopify_staging_api_secret
SHOPIFY_APP_URL=https://wishcraft-staging.up.railway.app
SESSION_SECRET=your_staging_session_secret
ENCRYPTION_KEY=your_staging_encryption_key
WEBHOOK_SECRET=your_staging_webhook_secret
```

## Deployment Process

### 1. Railway Setup

#### Initial Setup
1. Create a new Railway project
2. Connect your GitHub repository
3. Set up two environments: `production` and `staging`
4. Configure environment variables for each environment

#### Database Setup
1. Add PostgreSQL service to your Railway project
2. Configure database connection strings
3. Run database migrations:
   ```bash
   npm run db:migrate
   ```

### 2. GitHub Actions Setup

The CI/CD pipeline is configured in `.github/workflows/ci.yml` and includes:

#### Pipeline Stages
1. **Lint and Type Check** - Code quality validation
2. **Unit Tests** - Comprehensive test suite
3. **Security Tests** - Security scanning and audits
4. **Performance Tests** - Performance and load testing
5. **E2E Tests** - End-to-end testing
6. **Docker Build** - Container image creation
7. **Deploy Staging** - Staging environment deployment
8. **Deploy Production** - Production environment deployment

#### Branch Strategy
- `develop` branch → Staging deployment
- `main` branch → Production deployment

### 3. Deployment Commands

#### Manual Deployment
```bash
# Deploy to staging
railway up --service wishcraft-staging --environment staging

# Deploy to production
railway up --service wishcraft-production --environment production
```

#### Database Migrations
```bash
# Run migrations on staging
railway run --service wishcraft-staging npm run db:migrate

# Run migrations on production
railway run --service wishcraft-production npm run db:migrate
```

## Monitoring and Health Checks

### Health Endpoint
The application provides a health check endpoint at `/health` that returns:
- Application status
- Database connectivity
- Environment configuration
- System metrics

### Monitoring Setup
1. **Uptime Monitoring** - Configure external monitoring service
2. **Error Tracking** - Integrated error logging
3. **Performance Metrics** - Application performance monitoring
4. **Security Alerts** - Security incident notifications

## Security Considerations

### Environment Security
- All secrets are stored in Railway environment variables
- Database connections use SSL/TLS
- Application enforces HTTPS in production
- Rate limiting is implemented for API endpoints

### Container Security
- Multi-stage Docker builds for minimal attack surface
- Non-root user execution
- Security scanning in CI/CD pipeline
- Container image signing with Cosign

## Troubleshooting

### Common Issues

#### Deployment Failures
1. Check Railway logs:
   ```bash
   railway logs --service wishcraft-production
   ```

2. Verify environment variables are set correctly
3. Check database connectivity
4. Ensure all secrets are properly configured

#### Health Check Failures
1. Check database connectivity
2. Verify all required environment variables
3. Check application logs for errors
4. Ensure database migrations are up to date

#### Performance Issues
1. Monitor resource usage in Railway dashboard
2. Check database query performance
3. Review application logs for bottlenecks
4. Scale resources if needed

### Emergency Procedures

#### Rollback Process
1. Identify the last known good deployment
2. Revert to previous commit:
   ```bash
   git revert HEAD
   git push origin main
   ```
3. Monitor deployment in GitHub Actions
4. Verify application health

#### Database Recovery
1. Use Railway's automatic backups
2. Restore from backup:
   ```bash
   railway db:restore --service wishcraft-production
   ```
3. Run any necessary migrations
4. Verify data integrity

## Performance Optimization

### Railway Configuration
- **Memory**: 512MB minimum, 1GB recommended
- **CPU**: 1 vCPU minimum, 2 vCPUs recommended
- **Disk**: 1GB minimum for logs and temporary files

### Database Optimization
- Connection pooling configured
- Query optimization with indexes
- Regular database maintenance
- Monitoring slow queries

## Scaling Considerations

### Horizontal Scaling
- Railway auto-scaling based on traffic
- Database read replicas for high traffic
- CDN for static assets

### Vertical Scaling
- Increase Railway service resources
- Database instance scaling
- Memory and CPU optimization

## Backup and Recovery

### Automated Backups
- Daily database backups via Railway
- Application state backups
- Configuration backups

### Recovery Procedures
1. **Database Recovery**
   - Restore from Railway backup
   - Verify data integrity
   - Run health checks

2. **Application Recovery**
   - Redeploy from known good commit
   - Verify environment configuration
   - Test application functionality

## Security Best Practices

### Regular Security Tasks
1. **Weekly**
   - Review security alerts
   - Update dependencies
   - Check access logs

2. **Monthly**
   - Rotate secrets
   - Security scan review
   - Access audit

3. **Quarterly**
   - Penetration testing
   - Security policy review
   - Disaster recovery testing

## Support and Maintenance

### Regular Maintenance
- Weekly dependency updates
- Monthly security patches
- Quarterly performance reviews

### Support Contacts
- Technical Lead: [Your Email]
- DevOps Team: [DevOps Email]
- Security Team: [Security Email]

## Appendix

### Useful Commands
```bash
# Check application logs
railway logs --service wishcraft-production --tail

# Connect to database
railway connect --service wishcraft-production

# Run database migrations
railway run --service wishcraft-production npm run db:migrate

# Check environment variables
railway variables --service wishcraft-production

# Scale service
railway scale --service wishcraft-production --memory 1024
```

### Links
- [Railway Documentation](https://docs.railway.app)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Shopify App Development](https://shopify.dev/docs/apps)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)