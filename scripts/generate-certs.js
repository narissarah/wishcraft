import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const certsDir = join(projectRoot, 'certs');

// Create certs directory if it doesn't exist
if (!existsSync(certsDir)) {
  mkdirSync(certsDir, { recursive: true });
}

console.log('🔒 Generating SSL certificates for local development...');

try {
  // Use openssl to generate self-signed certificates
  const certPath = join(certsDir, 'localhost.pem');
  const keyPath = join(certsDir, 'localhost-key.pem');
  
  // Generate private key and certificate in one command
  execSync(`openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -sha256 -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`, {
    stdio: 'inherit'
  });
  
  console.log('✅ SSL certificates generated successfully!');
  console.log(`   Certificate: ${certPath}`);
  console.log(`   Key: ${keyPath}`);
  
  // Update .gitignore
  const gitignorePath = join(projectRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignoreContent = require('fs').readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('certs/') && !gitignoreContent.includes('*.pem')) {
      require('fs').appendFileSync(gitignorePath, '\n# SSL certificates\ncerts/\n*.pem\n');
      console.log('\n✅ Updated .gitignore to exclude certificates');
    }
  }
} catch (error) {
  console.error('❌ Failed to generate certificates:', error.message);
  process.exit(1);
}