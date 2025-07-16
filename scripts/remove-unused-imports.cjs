#!/usr/bin/env node

/**
 * Script to automatically remove common unused imports
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Common patterns for unused imports that can be safely removed
const unusedImportPatterns = [
  // Remove completely unused imports based on the analysis
  {
    pattern: /import\s+{\s*authenticate\s*}\s+from\s+['"]~\/shopify\.server['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('authenticate.') && !content.match(/authenticate\s*\(/),
  },
  {
    pattern: /import\s+{\s*json\s*}\s+from\s+['"]@remix-run\/node['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('json(') && !content.match(/return\s+json/),
  },
  {
    pattern: /import\s+{\s*db\s*}\s+from\s+['"]~\/lib\/db\.server['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('db.') && !content.match(/await\s+db/),
  },
  {
    pattern: /import\s+{\s*log\s*}\s+from\s+['"]~\/lib\/logger\.server['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('log.') && !content.match(/log\s*\(/),
  },
  {
    pattern: /import\s+{\s*useLoaderData\s*}\s+from\s+['"]@remix-run\/react['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('useLoaderData()') && !content.includes('useLoaderData<'),
  },
  {
    pattern: /import\s+{\s*useEffect\s*}\s+from\s+['"]react['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('useEffect('),
  },
  // Remove specific webhook-related imports if unused
  {
    pattern: /import\s+{\s*verifyWebhookRequest\s*}\s+from\s+['"]~\/lib\/webhook-security\.server['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('verifyWebhookRequest'),
  },
  {
    pattern: /import\s+{\s*validateWebhookTopic\s*}\s+from\s+['"]~\/lib\/webhook-security\.server['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('validateWebhookTopic'),
  },
  {
    pattern: /import\s+{\s*checkWebhookRateLimit\s*}\s+from\s+['"]~\/lib\/webhook-security\.server['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('checkWebhookRateLimit'),
  },
  {
    pattern: /import\s+{\s*getCircuitBreaker\s*}\s+from\s+['"][^'"]+['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('getCircuitBreaker'),
  },
  // Remove type imports if unused
  {
    pattern: /import\s+type\s*{\s*Metric\s*}\s+from\s+['"]web-vitals['"]\s*;?\s*\n/g,
    condition: (content) => !content.includes('Metric'),
  },
];

// Clean up import statements that have become empty
const cleanupPatterns = [
  // Clean up empty destructured imports
  {
    pattern: /import\s+{\s*}\s+from\s+['"][^'"]+['"]\s*;?\s*\n/g,
    replacement: '',
  },
  // Clean up imports with only commas left
  {
    pattern: /import\s+{\s*,+\s*}\s+from\s+['"][^'"]+['"]\s*;?\s*\n/g,
    replacement: '',
  },
  // Clean up double newlines
  {
    pattern: /\n\n\n+/g,
    replacement: '\n\n',
  },
];

// Find all TypeScript/JavaScript files
const files = glob.sync('app/**/*.{ts,tsx,js,jsx}', {
  ignore: ['node_modules/**/*', '**/*.test.*', '**/*.spec.*']
});

console.log(`Processing ${files.length} files to remove unused imports...\n`);

let totalRemovedImports = 0;
let filesModified = 0;

files.forEach(file => {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let removedImports = [];
  
  // Apply unused import patterns
  unusedImportPatterns.forEach(({ pattern, condition }) => {
    const matches = content.match(pattern) || [];
    matches.forEach(match => {
      if (condition(content)) {
        content = content.replace(match, '');
        removedImports.push(match.trim());
        totalRemovedImports++;
      }
    });
  });
  
  // Clean up import statements
  cleanupPatterns.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement);
  });
  
  // Special handling for multi-import statements
  // Fix imports like: import { foo, , bar } or import { foo, bar, }
  content = content.replace(/import\s+{\s*([^}]+)\s*}\s+from/g, (match, imports) => {
    const cleanedImports = imports
      .split(',')
      .map(imp => imp.trim())
      .filter(imp => imp && imp !== '')
      .join(', ');
    
    if (!cleanedImports) {
      return ''; // Remove empty import
    }
    
    return `import { ${cleanedImports} } from`;
  });
  
  // Remove any remaining empty lines at the start of files
  content = content.replace(/^\n+/, '');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesModified++;
    
    if (removedImports.length > 0) {
      console.log(`✅ ${file}`);
      removedImports.forEach(imp => {
        console.log(`   - Removed: ${imp}`);
      });
      console.log('');
    }
  }
});

console.log(`\n✨ Cleanup complete!`);
console.log(`📝 Modified ${filesModified} files`);
console.log(`🗑️  Removed ${totalRemovedImports} unused imports`);
console.log('\n💡 Run TypeScript compiler to check for any issues: npm run typecheck');