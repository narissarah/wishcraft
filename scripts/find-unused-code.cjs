#!/usr/bin/env node

/**
 * Script to find unused imports and dead code
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Common unused imports to check for
const commonUnusedImports = [
  'console',
  'debugger',
  // Common unused React imports
  'Fragment',
  'StrictMode',
  'Profiler',
  'Suspense',
  // Common unused Node imports
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'dgram',
  'dns',
  'domain',
  'events',
  'http2',
  'https',
  'net',
  'os',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib'
];

// Find all TypeScript/JavaScript files
const files = glob.sync('app/**/*.{ts,tsx,js,jsx}', {
  ignore: ['node_modules/**/*', '**/*.test.*', '**/*.spec.*']
});

console.log(`Analyzing ${files.length} files for unused code...\n`);

let totalUnusedImports = 0;
let totalEmptyFiles = 0;
let totalUnusedExports = 0;
let filesWithIssues = [];

files.forEach(file => {
  const filePath = path.resolve(file);
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for empty or near-empty files
  const trimmedContent = content.trim();
  if (trimmedContent.length < 50 && !trimmedContent.includes('export')) {
    issues.push('Empty or near-empty file');
    totalEmptyFiles++;
  }
  
  // Find all imports
  const importRegex = /import\s+(?:({[^}]*})|([^,\s]+)|\*\s+as\s+([^\s]+))\s+from\s+['"][^'"]+['"]/g;
  const importedItems = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) {
      // Destructured imports
      const items = match[1].replace(/[{}]/g, '').split(',').map(item => {
        const parts = item.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      });
      importedItems.push(...items);
    } else if (match[2]) {
      // Default import
      importedItems.push(match[2].trim());
    } else if (match[3]) {
      // Namespace import
      importedItems.push(match[3].trim());
    }
  }
  
  // Check if imported items are used
  const unusedImports = [];
  importedItems.forEach(item => {
    if (!item) return;
    
    // Create regex to find usage (avoid matching within the import statement itself)
    const usageRegex = new RegExp(`(?<!import[^;]*?)\\b${item}\\b`, 'g');
    const matches = content.match(usageRegex) || [];
    
    // If only found once (in the import), it's unused
    if (matches.length <= 1) {
      unusedImports.push(item);
      totalUnusedImports++;
    }
  });
  
  if (unusedImports.length > 0) {
    issues.push(`Unused imports: ${unusedImports.join(', ')}`);
  }
  
  // Check for unused exports (simple check)
  const exportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const exportedItems = [];
  
  while ((match = exportRegex.exec(content)) !== null) {
    exportedItems.push(match[1]);
  }
  
  // For exports, we'd need to check other files to see if they're imported
  // This is a simplified check - just flag files with many exports
  if (exportedItems.length > 5) {
    // Check if this is a barrel export file (index.ts)
    if (!file.endsWith('index.ts') && !file.endsWith('index.tsx')) {
      issues.push(`File has ${exportedItems.length} exports - verify all are used`);
    }
  }
  
  // Check for commented out code blocks
  const commentedCodeRegex = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
  const commentedCode = content.match(commentedCodeRegex) || [];
  const suspiciousComments = commentedCode.filter(comment => {
    // Check if comment contains code-like patterns
    return /(?:function|const|let|var|class|import|export|if|for|while|return)\s+\w+/.test(comment);
  });
  
  if (suspiciousComments.length > 3) {
    issues.push(`${suspiciousComments.length} blocks of commented-out code found`);
  }
  
  // Check for TODO/FIXME comments
  const todoRegex = /\/\/\s*(TODO|FIXME|HACK|XXX|BUG):/gi;
  const todos = content.match(todoRegex) || [];
  if (todos.length > 0) {
    issues.push(`${todos.length} TODO/FIXME comments found`);
  }
  
  // Check for console statements (should have been removed already)
  const consoleRegex = /console\.(log|error|warn|info|debug|trace|table|dir)/g;
  const consoleStatements = content.match(consoleRegex) || [];
  if (consoleStatements.length > 0) {
    issues.push(`${consoleStatements.length} console statements found`);
  }
  
  // Check for debugger statements
  if (/\bdebugger\b/.test(content)) {
    issues.push('Debugger statement found');
  }
  
  if (issues.length > 0) {
    filesWithIssues.push({ file, issues });
  }
});

// Report results
console.log('=== Unused Code Analysis Results ===\n');

console.log(`Total files analyzed: ${files.length}`);
console.log(`Files with issues: ${filesWithIssues.length}`);
console.log(`Total unused imports: ${totalUnusedImports}`);
console.log(`Empty/near-empty files: ${totalEmptyFiles}`);
console.log('');

if (filesWithIssues.length > 0) {
  console.log('Files with issues:\n');
  
  filesWithIssues.forEach(({ file, issues }) => {
    console.log(`📄 ${file}`);
    issues.forEach(issue => {
      console.log(`   ⚠️  ${issue}`);
    });
    console.log('');
  });
  
  // Summary of most common unused imports
  const importCounts = {};
  filesWithIssues.forEach(({ issues }) => {
    issues.forEach(issue => {
      if (issue.startsWith('Unused imports:')) {
        const imports = issue.replace('Unused imports: ', '').split(', ');
        imports.forEach(imp => {
          importCounts[imp] = (importCounts[imp] || 0) + 1;
        });
      }
    });
  });
  
  const sortedImports = Object.entries(importCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (sortedImports.length > 0) {
    console.log('\nMost common unused imports:');
    sortedImports.forEach(([imp, count]) => {
      console.log(`  ${imp}: ${count} occurrences`);
    });
  }
}

console.log('\n✨ Analysis complete!');
console.log('💡 Review the files listed above and remove unused code to improve bundle size and maintainability.');