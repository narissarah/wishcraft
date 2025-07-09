# WishCraft Security Quick Start Guide

## 🚀 Getting Started

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Generate security keys and configure environment
./scripts/setup-security.sh

# Generate Prisma client
npm run db:generate

# Run database migrations (if you have a database configured)
npm run db:migrate
```

### 2. Verify Security Configuration
```bash
# Check all compliance requirements
./scripts/run-compliance-tests.sh

# Test security headers (start dev server first)
./scripts/test-security-headers.sh http://localhost:3000

# Check deployment readiness
./scripts/deployment-checklist.sh
```

### 3. Development with Security Features

#### Using Rate Limiting in Routes
```typescript
import { withRateLimit, RATE_LIMITS } from "~/lib/rate-limiter.server";

export const loader = withRateLimit(async ({ request }) => {
  // Your loader logic
}, RATE_LIMITS.api);
```

#### Using Security Headers
```typescript
import { applySecurityHeaders } from "~/lib/security-headers.server";

export const loader = async ({ request }) => {
  const response = await getYourData();
  return applySecurityHeaders(response, request);
};
```

#### Encrypting Sensitive Data
```typescript
import { encryptData, decryptData } from "~/lib/pci-compliance.server";

// Encrypt
const encrypted = encryptData(sensitiveData);

// Decrypt
const original = decryptData(encrypted);
```

#### Logging Security Events
```typescript
import { logSecurityEvent, SecurityEventType } from "~/lib/pci-compliance.server";

await logSecurityEvent(SecurityEventType.DATA_ACCESSED, {
  userId: user.id,
  resource: "registry",
  resourceId: registryId,
  ipAddress: request.headers.get("x-forwarded-for")
});
```

### 4. Monitoring Performance

The app automatically tracks Core Web Vitals. View metrics in:
- Browser console (development mode)
- Performance dashboard at `/admin/performance`
- Analytics endpoint at `/api/analytics/performance`

### 5. GDPR Compliance

Webhooks are automatically handled at:
- `/webhooks/customers/data_request` - Customer data export
- `/webhooks/customers/redact` - Customer data deletion
- `/webhooks/shop/redact` - Complete shop deletion

### 6. Security Best Practices

#### Environment Variables
- Never commit `.env` to version control
- Use strong 32+ character keys
- Rotate keys every 90 days
- Use different keys for each environment

#### Database Security
- Always use parameterized queries (Prisma handles this)
- Enable SSL for database connections
- Implement row-level security for multi-tenant data
- Regular backups with encryption

#### API Security
- All API routes have rate limiting
- HMAC validation on all webhooks
- GraphQL cost tracking to prevent abuse
- Input validation on all endpoints

### 7. Testing Security

```bash
# Run security-specific tests
npm run test:security

# Check for vulnerabilities
npm audit

# Test rate limiting
for i in {1..101}; do curl -s http://localhost:3000/api/test; done
```

### 8. Production Deployment

```bash
# Final security check
./scripts/deployment-checklist.sh

# Build for production
npm run build

# Deploy (update with your deployment method)
npm run deploy:production
```

### 9. Troubleshooting

#### Rate Limit Errors (429)
- Check `X-RateLimit-*` headers
- Implement exponential backoff
- Consider upgrading limits for specific endpoints

#### CORS/CSP Issues
- Check browser console for violations
- Verify nonce implementation
- Update CSP directives in security-headers.server.ts

#### Encryption Errors
- Verify ENCRYPTION_KEY is set
- Check key length (minimum 32 characters)
- Ensure consistent key usage

### 10. Emergency Procedures

#### Security Breach
1. Rotate all keys immediately
2. Review audit logs for suspicious activity
3. Enable emergency rate limiting
4. Notify affected users per GDPR requirements

#### Key Rotation
```bash
# Generate new keys
./scripts/setup-security.sh --rotate-keys

# Update production environment
# Restart application
```

### 📚 Additional Resources

- [Shopify Security Best Practices](https://shopify.dev/apps/store/security)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [PCI DSS Compliance Guide](https://www.pcisecuritystandards.org/)

### 🆘 Support

- Security Issues: security@wishcraft.app
- Documentation: [Internal Wiki]
- Slack: #wishcraft-security

---

Remember: Security is everyone's responsibility. When in doubt, ask!