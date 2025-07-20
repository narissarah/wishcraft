#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');
const verbose = args.includes('--verbose') || args.includes('-v');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node fix-empty-catch-blocks.js [options]

Options:
  -d, --dry-run    Show what would be changed without modifying files
  -v, --verbose    Show more detailed output
  -h, --help       Show this help message

This script finds and fixes empty catch blocks by adding appropriate error logging.
`);
  process.exit(0);
}

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Pattern to match empty catch blocks (including whitespace and newlines)
// This matches catch blocks that are truly empty (no statements inside)
// Updated to handle both single-line and multi-line empty catch blocks
const EMPTY_CATCH_REGEX = /catch\s*\(([^)]*)\)\s*\{\s*\}/g;
const EMPTY_CATCH_MULTILINE_REGEX = /catch\s*\(([^)]*)\)\s*\{\s*\n\s*\}/g;

// Pattern to check if import already exists
const IMPORT_REGEX = /import\s+.*?from\s+['"].*?logger\.server['"];?/;
const IMPORT_WITH_LOG_REGEX = /import\s+\{[^}]*\blog\b[^}]*\}\s+from\s+['"].*?logger\.server['"];?/;

// Directories to ignore
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.next', '.git', 'coverage'];

async function findFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  await walk(dir);
  return files;
}

async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let modified = content;
    let changesMade = 0;
    
    // Check if file has empty catch blocks (both single-line and multi-line)
    const matches = [
      ...content.matchAll(EMPTY_CATCH_REGEX),
      ...content.matchAll(EMPTY_CATCH_MULTILINE_REGEX)
    ];
    if (matches.length === 0) {
      return { filePath, changesMade: 0, skipped: true };
    }

    console.log(`\n${colors.yellow}Processing: ${filePath}${colors.reset}`);
    
    // Determine the correct import path based on file location
    const fileDir = path.dirname(filePath);
    const libDir = path.join(process.cwd(), 'app', 'lib');
    let importPath = './logger.server';
    
    // Calculate relative path if file is not in lib directory
    if (!filePath.includes('/app/lib/')) {
      const relativePath = path.relative(fileDir, path.join(libDir, 'logger.server'));
      importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      importPath = importPath.replace(/\.ts$/, '');
    }

    // Check if we need to add import
    let needsImport = false;
    if (!IMPORT_WITH_LOG_REGEX.test(modified)) {
      needsImport = true;
      
      // Check if there's already an import from logger.server
      const existingImportMatch = modified.match(/import\s+\{([^}]+)\}\s+from\s+['"].*?logger\.server['"];?/);
      if (existingImportMatch) {
        // Update existing import to include log
        modified = modified.replace(
          /import\s+\{([^}]+)\}\s+from\s+['"].*?logger\.server['"];?/,
          (match, imports) => {
            const importList = imports.split(',').map(i => i.trim());
            if (!importList.includes('log')) {
              importList.push('log');
            }
            // Keep the original path from the match
            const pathMatch = match.match(/from\s+['"]([^'"]+)['"]/);
            const originalPath = pathMatch ? pathMatch[1] : importPath;
            return `import { ${importList.join(', ')} } from '${originalPath}';`;
          }
        );
      } else {
        // Add new import at the top of the file
        const importStatement = `import { log } from '${importPath}';\n`;
        
        // Find the right place to insert the import
        const firstImportMatch = modified.match(/^import\s+/m);
        if (firstImportMatch) {
          const firstImportIndex = modified.indexOf(firstImportMatch[0]);
          modified = modified.slice(0, firstImportIndex) + importStatement + modified.slice(firstImportIndex);
        } else {
          // No imports, add at the beginning
          modified = importStatement + '\n' + modified;
        }
      }
    }

    // Replace empty catch blocks (both patterns)
    let catchIndex = 0;
    
    // First replace single-line empty catch blocks
    modified = modified.replace(EMPTY_CATCH_REGEX, (match, errorVar, offset) => {
      changesMade++;
      catchIndex++;
      const errorVarName = errorVar.trim() || 'error';
      
      // Determine context based on file path and surrounding code
      let context = 'Operation';
      
      // Try to determine context from file name
      const fileName = path.basename(filePath);
      if (filePath.includes('graphql')) context = 'GraphQL operation';
      else if (filePath.includes('shopify-api')) context = 'Shopify API operation';
      else if (filePath.includes('cache')) context = 'Cache operation';
      else if (filePath.includes('notification')) context = 'Notification operation';
      else if (filePath.includes('webhook')) context = 'Webhook processing';
      else if (filePath.includes('job')) context = 'Job processing';
      else if (filePath.includes('csrf')) context = 'CSRF validation';
      else if (filePath.includes('retry')) context = 'Retry operation';
      else if (filePath.includes('circuit-breaker')) context = 'Circuit breaker operation';
      else if (filePath.includes('auth')) context = 'Authentication';
      else if (filePath.includes('session')) context = 'Session management';
      else if (filePath.includes('database') || filePath.includes('prisma')) context = 'Database operation';
      else if (filePath.includes('redis')) context = 'Redis operation';
      
      // Try to get more context from surrounding code
      const beforeCode = content.substring(Math.max(0, offset - 200), offset);
      const functionMatch = beforeCode.match(/(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
      if (functionMatch) {
        const functionName = functionMatch[1] || functionMatch[2];
        context = `${functionName} operation`;
      }
      
      if (verbose) {
        console.log(`  ${colors.cyan}Catch block ${catchIndex}: ${context}${colors.reset}`);
      }
      
      return `catch (${errorVarName}) {
    log.error('${context} failed', ${errorVarName});
  }`;
    });
    
    // Then replace multi-line empty catch blocks
    modified = modified.replace(EMPTY_CATCH_MULTILINE_REGEX, (match, errorVar, offset) => {
      changesMade++;
      catchIndex++;
      const errorVarName = errorVar.trim() || 'error';
      
      // Determine context based on file path and surrounding code
      let context = 'Operation';
      
      // Try to determine context from file name
      const fileName = path.basename(filePath);
      if (filePath.includes('graphql')) context = 'GraphQL operation';
      else if (filePath.includes('shopify-api')) context = 'Shopify API operation';
      else if (filePath.includes('cache')) context = 'Cache operation';
      else if (filePath.includes('notification')) context = 'Notification operation';
      else if (filePath.includes('webhook')) context = 'Webhook processing';
      else if (filePath.includes('job')) context = 'Job processing';
      else if (filePath.includes('csrf')) context = 'CSRF validation';
      else if (filePath.includes('retry')) context = 'Retry operation';
      else if (filePath.includes('circuit-breaker')) context = 'Circuit breaker operation';
      else if (filePath.includes('auth')) context = 'Authentication';
      else if (filePath.includes('session')) context = 'Session management';
      else if (filePath.includes('database') || filePath.includes('prisma')) context = 'Database operation';
      else if (filePath.includes('redis')) context = 'Redis operation';
      
      // Try to get more context from surrounding code
      const beforeCode = content.substring(Math.max(0, offset - 200), offset);
      const functionMatch = beforeCode.match(/(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
      if (functionMatch) {
        const functionName = functionMatch[1] || functionMatch[2];
        context = `${functionName} operation`;
      }
      
      if (verbose) {
        console.log(`  ${colors.cyan}Catch block ${catchIndex}: ${context}${colors.reset}`);
      }
      
      return `catch (${errorVarName}) {
    log.error('${context} failed', ${errorVarName});
  }`;
    });

    // Write the modified file
    if (changesMade > 0) {
      if (!dryRun) {
        await fs.writeFile(filePath, modified, 'utf-8');
        console.log(`${colors.green}✓ Fixed ${changesMade} empty catch block(s)${colors.reset}`);
        if (needsImport) {
          console.log(`${colors.green}✓ Added import for log${colors.reset}`);
        }
      } else {
        console.log(`${colors.cyan}[DRY RUN] Would fix ${changesMade} empty catch block(s)${colors.reset}`);
        if (needsImport) {
          console.log(`${colors.cyan}[DRY RUN] Would add import for log${colors.reset}`);
        }
      }
    }

    return { filePath, changesMade, skipped: false };
  } catch (error) {
    console.error(`${colors.red}Error processing ${filePath}: ${error.message}${colors.reset}`);
    return { filePath, changesMade: 0, error: error.message };
  }
}

async function main() {
  console.log('🔍 Searching for empty catch blocks...');
  
  if (dryRun) {
    console.log(`${colors.cyan}Running in DRY RUN mode - no files will be modified${colors.reset}`);
  }
  
  console.log('');

  // Find all TypeScript and JavaScript files
  const directories = [
    'app',
    'extensions',
    '.' // Root directory for standalone JS files
  ];

  let allFiles = [];
  for (const dir of directories) {
    try {
      const stats = await fs.stat(dir);
      if (stats.isDirectory()) {
        const files = await findFiles(dir);
        allFiles = allFiles.concat(files);
      }
    } catch (error) {
      // Directory doesn't exist, skip it
    }
  }

  // Remove duplicates and filter out the script itself
  allFiles = [...new Set(allFiles)].filter(file => !file.endsWith('fix-empty-catch-blocks.js'));

  console.log(`Found ${allFiles.length} files to check\n`);

  // Process each file
  const results = [];
  for (const file of allFiles) {
    const result = await processFile(file);
    if (!result.skipped) {
      results.push(result);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));

  const totalFixed = results.reduce((sum, r) => sum + (r.changesMade || 0), 0);
  const filesFixed = results.filter(r => r.changesMade > 0).length;
  const errors = results.filter(r => r.error).length;

  console.log(`${colors.green}✓ Files processed: ${results.length}${colors.reset}`);
  console.log(`${colors.green}✓ Files fixed: ${filesFixed}${colors.reset}`);
  console.log(`${colors.green}✓ Total catch blocks fixed: ${totalFixed}${colors.reset}`);
  
  if (errors > 0) {
    console.log(`${colors.red}✗ Errors encountered: ${errors}${colors.reset}`);
  }

  console.log('\n✨ Done!');
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Script failed: ${error.message}${colors.reset}`);
  process.exit(1);
});