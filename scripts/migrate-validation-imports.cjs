#!/usr/bin/env node

/**
 * Migration script to update validation imports to use the unified validation system
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define the import mappings
const importMappings = {
  '~/lib/validation.server': '~/lib/validation-unified.server',
  '~/lib/validation-utils.server': '~/lib/validation-unified.server',
  '~/lib/validation-middleware.server': '~/lib/validation-unified.server',
  './validation.server': './validation-unified.server',
  './validation-utils.server': './validation-unified.server',
  './validation-middleware.server': './validation-unified.server'
};

// Define schema/function name mappings
const schemaMappings = {
  // From validation.server.ts
  'createRegistrySchema': 'RegistrySchemas.create',
  'updateRegistrySchema': 'RegistrySchemas.update',
  'addRegistryItemSchema': 'RegistrySchemas.addItem',
  'purchaseRegistryItemSchema': 'RegistrySchemas.purchase',
  'shopConfigSchema': 'ShopSchemas.config',
  'webhookSchema': 'WebhookSchemas.base',
  'paginationSchema': 'QuerySchemas.pagination',
  'searchSchema': 'QuerySchemas.search',
  'performanceMetricsSchema': 'AnalyticsSchemas.webVitals',
  'shopifyGlobalIdSchema': 'BaseSchemas.shopifyGlobalId',
  'shopifyDomainSchema': 'BaseSchemas.shopifyDomain',
  'emailSchema': 'BaseSchemas.email',
  'slugSchema': 'BaseSchemas.slug',
  'phoneSchema': 'BaseSchemas.phone',
  'currencyCodeSchema': 'BaseSchemas.currencyCode',
  'priceSchema': 'BaseSchemas.price',
  'quantitySchema': 'BaseSchemas.quantity',
  
  // From validation-utils.server.ts
  'CommonSchemas': 'BaseSchemas',
  'RegistrySchemas.create': 'RegistrySchemas.create',
  'RegistrySchemas.update': 'RegistrySchemas.update',
  'RegistrySchemas.addItem': 'RegistrySchemas.addItem',
  'AnalyticsSchemas.webVitals': 'AnalyticsSchemas.webVitals',
  'AnalyticsSchemas.error': 'AnalyticsSchemas.error',
  'WebhookSchemas.order': 'WebhookSchemas.orderCreate',
  'WebhookSchemas.product': 'WebhookSchemas.productUpdate',
  'QuerySchemas.pagination': 'QuerySchemas.pagination',
  'QuerySchemas.registryFilters': 'QuerySchemas.registryFilters',
  'QuerySchemas.dateRange': 'QuerySchemas.dateRange'
};

// Find all TypeScript files that might have validation imports
const files = glob.sync('app/**/*.{ts,tsx}', {
  ignore: [
    'app/lib/validation.server.ts',
    'app/lib/validation-utils.server.ts',
    'app/lib/validation-middleware.server.ts',
    'app/lib/validation-unified.server.ts',
    'node_modules/**/*'
  ]
});

console.log(`Found ${files.length} files to check for validation imports...`);

let totalUpdated = 0;
let filesUpdated = 0;

files.forEach(file => {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let updated = false;
  
  // Update import statements
  Object.entries(importMappings).forEach(([oldImport, newImport]) => {
    // Match various import patterns
    const importPatterns = [
      new RegExp(`from ['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
      new RegExp(`import\\(['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'g'),
      new RegExp(`require\\(['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'g')
    ];
    
    importPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, (match) => {
          return match.replace(oldImport, newImport);
        });
        updated = true;
      }
    });
  });
  
  // Update schema references if the file imports from validation modules
  if (updated || content.includes('validation-unified.server')) {
    Object.entries(schemaMappings).forEach(([oldName, newName]) => {
      // Only replace if it's used as a schema reference, not in import statements
      const usagePattern = new RegExp(`(?<!import.*{[^}]*|export.*{[^}]*)\\b${oldName}\\b(?!.*from)`, 'g');
      
      if (usagePattern.test(content)) {
        content = content.replace(usagePattern, newName);
        updated = true;
      }
    });
    
    // Update validateRequest to withValidation
    content = content.replace(/\bvalidateRequest\b(?!.*from)/g, 'withValidation');
  }
  
  if (updated && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${file}`);
    filesUpdated++;
    totalUpdated++;
  }
});

console.log(`\n✨ Migration complete!`);
console.log(`📝 Updated ${filesUpdated} files`);

// Now we can remove the old validation files
console.log('\n🗑️  Removing old validation files...');

const oldFiles = [
  'app/lib/validation.server.ts',
  'app/lib/validation-utils.server.ts',
  'app/lib/validation-middleware.server.ts'
];

oldFiles.forEach(file => {
  const filePath = path.resolve(file);
  if (fs.existsSync(filePath)) {
    // First create a backup
    const backupPath = filePath + '.bak';
    fs.copyFileSync(filePath, backupPath);
    console.log(`📋 Backed up: ${file} -> ${file}.bak`);
    
    // Then remove the original
    fs.unlinkSync(filePath);
    console.log(`🗑️  Removed: ${file}`);
  }
});

console.log('\n✅ Validation system consolidation complete!');
console.log('💡 The old files have been backed up with .bak extension');
console.log('📚 All imports now use the unified validation system at ~/lib/validation-unified.server');