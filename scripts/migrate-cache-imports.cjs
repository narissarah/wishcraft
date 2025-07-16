#!/usr/bin/env node

/**
 * Migration script to update all cache imports to use the unified cache system
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mapping of old imports to new unified imports
const importMappings = {
  // Old cache.server.ts imports
  'from "~/lib/cache.server"': 'from "~/lib/cache-unified.server"',
  'from \'~/lib/cache.server\'': 'from \'~/lib/cache-unified.server\'',
  
  // Old cache-manager.server.ts imports
  'from "~/lib/cache-manager.server"': 'from "~/lib/cache-unified.server"',
  'from \'~/lib/cache-manager.server\'': 'from \'~/lib/cache-unified.server\'',
  
  // Old caching.server.ts imports
  'from "~/lib/caching.server"': 'from "~/lib/cache-unified.server"',
  'from \'~/lib/caching.server\'': 'from \'~/lib/cache-unified.server\'',
  
  // Old cache-decorators.server.ts imports  
  'from "~/lib/cache-decorators.server"': 'from "~/lib/cache-unified.server"',
  'from \'~/lib/cache-decorators.server\'': 'from \'~/lib/cache-unified.server\'',
};

// Variable name mappings
const variableMappings = {
  // Standardize on 'cache' and 'cacheKeys'
  'cacheManager': 'cache',
  'CacheKeys': 'cacheKeys',
  'AdvancedCacheKeys': 'cacheKeys',
};

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Update import statements
    Object.entries(importMappings).forEach(([oldImport, newImport]) => {
      if (content.includes(oldImport)) {
        content = content.replace(new RegExp(oldImport, 'g'), newImport);
        modified = true;
      }
    });
    
    // Update variable names
    Object.entries(variableMappings).forEach(([oldVar, newVar]) => {
      // Be careful to only replace standalone variable names, not parts of other names
      const regex = new RegExp(`\\b${oldVar}\\b`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, newVar);
        modified = true;
      }
    });
    
    // Update specific import patterns
    if (content.includes('import { cacheManager, CacheKeys }')) {
      content = content.replace(
        'import { cacheManager, CacheKeys }',
        'import { cache, cacheKeys }'
      );
      modified = true;
    }
    
    if (content.includes('import { cache, cacheKeys, withCache }')) {
      // This is already correct for the unified cache
      modified = false;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔄 Migrating cache imports to unified cache system...\n');
  
  // Get all TypeScript files in the app directory
  const files = execSync('find app -name "*.ts" -o -name "*.tsx"', { encoding: 'utf8' })
    .split('\n')
    .filter(file => file.trim())
    .filter(file => !file.includes('cache-unified.server.ts')); // Don't modify the unified cache file itself
  
  let updatedCount = 0;
  
  files.forEach(file => {
    // Check if file contains any cache imports
    const content = fs.readFileSync(file, 'utf8');
    const hasCacheImports = Object.keys(importMappings).some(oldImport => 
      content.includes(oldImport)
    );
    
    if (hasCacheImports) {
      if (updateFile(file)) {
        updatedCount++;
      }
    }
  });
  
  console.log(`\n✅ Cache import migration complete!`);
  console.log(`📊 Updated ${updatedCount} files`);
  
  // List the old cache files that can now be removed
  console.log('\n📁 Old cache files that can be removed after verification:');
  console.log('   - app/lib/cache.server.ts');
  console.log('   - app/lib/cache-manager.server.ts');
  console.log('   - app/lib/caching.server.ts');
  console.log('   - app/lib/cache-decorators.server.ts');
  
  console.log('\n⚠️  Please verify all imports work correctly before removing old files!');
}

if (require.main === module) {
  main();
}