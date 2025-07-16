#!/usr/bin/env node

/**
 * Remove console statements from production code
 * Preserves console statements in development/test files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to exclude from console removal
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'build',
  'public/build',
  '.shopify',
  'tests',
  'scripts',
  'edge',
  'logger.server.ts', // Logger file should keep console
  'error-handler.server.ts', // Error handler may need console
  'ErrorBoundaryExample.tsx', // Example file
  'vite.config',
  'server.js' // Server file may need some console
];

// Console methods to remove
const CONSOLE_METHODS = [
  'console.log',
  'console.debug',
  'console.info',
  'console.warn',
  'console.error',
  'console.trace',
  'console.table',
  'console.group',
  'console.groupEnd',
  'console.time',
  'console.timeEnd'
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function removeConsoleStatements(content, filePath) {
  let modified = false;
  let newContent = content;
  
  // Remove console statements but preserve error handling in specific contexts
  CONSOLE_METHODS.forEach(method => {
    const regex = new RegExp(`\\s*${method.replace('.', '\\.')}\\s*\\([^)]*\\)\\s*;?\\s*`, 'g');
    const matches = newContent.match(regex);
    
    if (matches) {
      // In error handlers, replace console.error with proper logging
      if (method === 'console.error' && filePath.includes('error')) {
        newContent = newContent.replace(regex, (match) => {
          if (match.includes('console.error')) {
            return match.replace('console.error', 'log.error');
          }
          return '';
        });
      } else {
        // Remove other console statements
        newContent = newContent.replace(regex, '');
      }
      modified = true;
    }
  });
  
  // Clean up empty lines left by removal
  newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return { content: newContent, modified };
}

function processFile(filePath) {
  if (shouldExcludeFile(filePath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: newContent, modified } = removeConsoleStatements(content, filePath);
    
    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
  
  return false;
}

function main() {
  console.log('🧹 Removing console statements from production code...\n');
  
  // Get all TypeScript and JavaScript files
  const files = execSync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx"', { encoding: 'utf8' })
    .split('\n')
    .filter(file => file.trim() && !shouldExcludeFile(file));
  
  let processedCount = 0;
  
  files.forEach(file => {
    if (processFile(file)) {
      processedCount++;
    }
  });
  
  console.log(`\n✅ Console cleanup complete! Processed ${processedCount} files.`);
  
  // Show remaining console statements in excluded files
  console.log('\n📋 Console statements preserved in:');
  const excludedFiles = [
    './app/lib/logger.server.ts',
    './tests/setup.ts',
    './server.js',
    './scripts/*'
  ];
  
  excludedFiles.forEach(file => {
    console.log(`   - ${file} (development/infrastructure)`);
  });
}

if (require.main === module) {
  main();
}