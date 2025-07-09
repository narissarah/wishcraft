#!/bin/bash

# WishCraft Security Setup Script
# This script helps generate secure keys and configure security settings

set -e

echo "🔒 WishCraft Security Configuration Setup"
echo "========================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
fi

# Function to generate secure key
generate_key() {
    openssl rand -base64 32
}

# Generate keys if not already set
echo ""
echo "🔑 Generating secure keys..."

# Check and set SESSION_SECRET
if grep -q "SESSION_SECRET=your_32_character_session_secret_here\|SESSION_SECRET=generate_with_openssl" .env; then
    SESSION_SECRET=$(generate_key)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
    else
        # Linux
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
    fi
    echo "✅ Generated SESSION_SECRET"
else
    echo "⏭️  SESSION_SECRET already configured"
fi

# Check and set JWT_SECRET
if grep -q "JWT_SECRET=your_jwt_secret_for_customer_auth\|JWT_SECRET=generate_with_openssl" .env; then
    JWT_SECRET=$(generate_key)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    else
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    fi
    echo "✅ Generated JWT_SECRET"
else
    echo "⏭️  JWT_SECRET already configured"
fi

# Check and set ENCRYPTION_KEY
if grep -q "ENCRYPTION_KEY=your_encryption_key_here\|ENCRYPTION_KEY=generate_with_openssl" .env; then
    ENCRYPTION_KEY=$(generate_key)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    else
        sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    fi
    echo "✅ Generated ENCRYPTION_KEY"
else
    echo "⏭️  ENCRYPTION_KEY already configured"
fi

# Set security flags
echo ""
echo "🛡️  Configuring security settings..."

# Enable HTTPS enforcement
if ! grep -q "^FORCE_HTTPS=true" .env; then
    echo "FORCE_HTTPS=true" >> .env
    echo "✅ Enabled HTTPS enforcement"
fi

# Enable audit logging
if ! grep -q "^ENABLE_AUDIT_LOGGING=true" .env; then
    echo "ENABLE_AUDIT_LOGGING=true" >> .env
    echo "✅ Enabled audit logging"
fi

# Install security dependencies
echo ""
echo "📦 Installing security dependencies..."
npm install

# Run security audit
echo ""
echo "🔍 Running security audit..."
npm audit

# Generate self-signed certificate for local development
if [ "$1" == "--dev-cert" ]; then
    echo ""
    echo "🔐 Generating self-signed certificate for development..."
    mkdir -p certs
    openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=WishCraft/CN=localhost"
    echo "✅ Generated development certificates in ./certs/"
fi

# Create security headers test file
echo ""
echo "📄 Creating security headers test script..."
cat > scripts/test-security-headers.sh << 'EOF'
#!/bin/bash
# Test security headers

URL=${1:-http://localhost:3000}

echo "Testing security headers for $URL"
echo "================================"

curl -s -I "$URL" | grep -E "X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Strict-Transport-Security|Content-Security-Policy|Permissions-Policy"

echo ""
echo "Full headers:"
curl -s -I "$URL"
EOF

chmod +x scripts/test-security-headers.sh

# PCI compliance check
echo ""
echo "📋 Running PCI compliance check..."
cat > scripts/pci-compliance-check.js << 'EOF'
import { validatePCICompliance } from '../app/lib/pci-compliance.server.js';

const result = validatePCICompliance();
console.log('PCI Compliance Check:');
console.log('====================');
console.log(`Level: ${result.level}`);
console.log(`Compliant: ${result.compliant ? '✅ Yes' : '❌ No'}`);

if (result.requirements.length > 0) {
    console.log('\nRequired actions:');
    result.requirements.forEach((req, i) => {
        console.log(`${i + 1}. ${req}`);
    });
}
EOF

# Create .gitignore entries
echo ""
echo "📝 Updating .gitignore..."
if ! grep -q "^certs/" .gitignore 2>/dev/null; then
    echo -e "\n# Security certificates\ncerts/\n*.pem\n*.key" >> .gitignore
fi

# Summary
echo ""
echo "✅ Security configuration complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the generated keys in .env"
echo "2. Update SHOPIFY_WEBHOOK_SECRET with the value from your Shopify admin"
echo "3. Configure your production domain in COOKIE_DOMAIN"
echo "4. Set up monitoring with Sentry (SENTRY_DSN)"
echo "5. Run './scripts/test-security-headers.sh' to verify headers"
echo ""
echo "🔒 Security reminders:"
echo "- Never commit .env to version control"
echo "- Rotate keys every 90 days"
echo "- Monitor audit logs regularly"
echo "- Keep dependencies updated"
echo ""
echo "Run 'npm run test:security' to run security tests"