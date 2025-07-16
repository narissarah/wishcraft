#!/usr/bin/env node

/**
 * Performance Budget Checker for WishCraft
 * Validates build artifacts against performance budgets
 * Based on Shopify performance requirements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, '..', 'build');
const publicDir = path.join(__dirname, '..', 'public', 'build');

// Performance budgets (in KB)
const BUDGETS = {
  // Main application bundles
  'entry.client': { max: 150, warning: 120 },
  'root': { max: 100, warning: 80 },
  
  // Route bundles
  'routes/_index': { max: 50, warning: 40 },
  'routes/app._index': { max: 80, warning: 60 },
  'routes/api': { max: 30, warning: 25 },
  
  // Vendor bundles
  'vendor-react': { max: 200, warning: 180 },
  'vendor-shopify': { max: 150, warning: 120 },
  'vendor-utils': { max: 50, warning: 40 },
  
  // CSS bundles
  'app.css': { max: 50, warning: 40 },
  'polaris.css': { max: 100, warning: 80 },
  
  // Total budget
  total: { max: 500, warning: 400 },
};

// Core Web Vitals thresholds
const WEB_VITALS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // ms
  FID: { good: 100, needsImprovement: 300 }, // ms
  CLS: { good: 0.1, needsImprovement: 0.25 }, // score
  FCP: { good: 1800, needsImprovement: 3000 }, // ms
  TTI: { good: 3800, needsImprovement: 7300 }, // ms
  TBT: { good: 200, needsImprovement: 600 }, // ms
};

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function getGzipSize(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const compressed = gzipSync(content);
    return compressed.length;
  } catch (error) {
    return 0;
  }
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function findFiles(dir, pattern) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function analyzeBuild() {
  console.log('🔍 Analyzing build performance...\n');
  
  const results = {
    bundles: {},
    totalSize: 0,
    totalGzipSize: 0,
    errors: [],
    warnings: [],
  };
  
  // Find all JS and CSS files
  const jsFiles = findFiles(buildDir, /\.(js|mjs)$/);
  const cssFiles = findFiles(publicDir, /\.css$/);
  const allFiles = [...jsFiles, ...cssFiles];
  
  console.log(`Found ${allFiles.length} files to analyze\n`);
  
  // Analyze each file
  for (const file of allFiles) {
    const relativePath = path.relative(path.join(__dirname, '..'), file);
    const fileName = path.basename(file, path.extname(file));
    const size = getFileSize(file);
    const gzipSize = getGzipSize(file);
    
    // Find matching budget
    let budgetKey = null;
    for (const [key, budget] of Object.entries(BUDGETS)) {
      if (key === 'total') continue;
      if (fileName.includes(key) || relativePath.includes(key)) {
        budgetKey = key;
        break;
      }
    }
    
    const sizeKB = size / 1024;
    const gzipSizeKB = gzipSize / 1024;
    
    results.bundles[relativePath] = {
      size: sizeKB,
      gzipSize: gzipSizeKB,
      budgetKey,
    };
    
    results.totalSize += sizeKB;
    results.totalGzipSize += gzipSizeKB;
    
    // Check against budget
    if (budgetKey) {
      const budget = BUDGETS[budgetKey];
      
      if (gzipSizeKB > budget.max) {
        results.errors.push({
          file: relativePath,
          type: 'budget-exceeded',
          message: `${budgetKey}: ${formatSize(gzipSize)} exceeds budget of ${budget.max}KB`,
          actual: gzipSizeKB,
          budget: budget.max,
        });
      } else if (gzipSizeKB > budget.warning) {
        results.warnings.push({
          file: relativePath,
          type: 'budget-warning',
          message: `${budgetKey}: ${formatSize(gzipSize)} exceeds warning threshold of ${budget.warning}KB`,
          actual: gzipSizeKB,
          budget: budget.warning,
        });
      }
    }
  }
  
  // Check total budget
  if (results.totalGzipSize > BUDGETS.total.max) {
    results.errors.push({
      type: 'total-budget-exceeded',
      message: `Total bundle size ${formatSize(results.totalGzipSize * 1024)} exceeds budget of ${BUDGETS.total.max}KB`,
      actual: results.totalGzipSize,
      budget: BUDGETS.total.max,
    });
  } else if (results.totalGzipSize > BUDGETS.total.warning) {
    results.warnings.push({
      type: 'total-budget-warning',
      message: `Total bundle size ${formatSize(results.totalGzipSize * 1024)} exceeds warning threshold of ${BUDGETS.total.warning}KB`,
      actual: results.totalGzipSize,
      budget: BUDGETS.total.warning,
    });
  }
  
  return results;
}

function generateReport(results) {
  console.log('📊 Performance Budget Report\n');
  console.log('='.repeat(60));
  
  // Summary
  console.log(`\n📋 Summary:`);
  console.log(`Total files analyzed: ${Object.keys(results.bundles).length}`);
  console.log(`Total size: ${formatSize(results.totalSize * 1024)} (uncompressed)`);
  console.log(`Total size: ${formatSize(results.totalGzipSize * 1024)} (gzipped)`);
  console.log(`Budget utilization: ${(results.totalGzipSize / BUDGETS.total.max * 100).toFixed(1)}%`);
  
  // Bundle breakdown
  console.log(`\n📦 Bundle Breakdown:`);
  const sortedBundles = Object.entries(results.bundles)
    .sort(([,a], [,b]) => b.gzipSize - a.gzipSize);
  
  for (const [file, info] of sortedBundles) {
    const budget = info.budgetKey ? BUDGETS[info.budgetKey] : null;
    const budgetText = budget ? ` (budget: ${budget.max}KB)` : '';
    const status = budget && info.gzipSize > budget.max ? '❌' : 
                  budget && info.gzipSize > budget.warning ? '⚠️' : '✅';
    
    console.log(`  ${status} ${file}: ${formatSize(info.gzipSize * 1024)}${budgetText}`);
  }
  
  // Warnings
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${results.warnings.length}):`);
    for (const warning of results.warnings) {
      console.log(`  - ${warning.message}`);
    }
  }
  
  // Errors
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors (${results.errors.length}):`);
    for (const error of results.errors) {
      console.log(`  - ${error.message}`);
    }
  }
  
  // Performance recommendations
  console.log(`\n🚀 Performance Recommendations:`);
  
  if (results.totalGzipSize > BUDGETS.total.warning) {
    console.log(`  • Consider code splitting to reduce initial bundle size`);
    console.log(`  • Use dynamic imports for non-critical functionality`);
    console.log(`  • Remove unused dependencies and dead code`);
  }
  
  const largeBundles = Object.entries(results.bundles)
    .filter(([, info]) => info.gzipSize > 50)
    .sort(([,a], [,b]) => b.gzipSize - a.gzipSize);
  
  if (largeBundles.length > 0) {
    console.log(`  • Large bundles detected:`);
    for (const [file, info] of largeBundles.slice(0, 3)) {
      console.log(`    - ${file}: ${formatSize(info.gzipSize * 1024)}`);
    }
  }
  
  console.log(`  • Use tree shaking to eliminate dead code`);
  console.log(`  • Consider using Shopify's CDN for static assets`);
  console.log(`  • Implement service worker caching for repeat visits`);
  
  // Web Vitals targets
  console.log(`\n🎯 Core Web Vitals Targets:`);
  console.log(`  • LCP (Largest Contentful Paint): < ${WEB_VITALS.LCP.good}ms`);
  console.log(`  • FID (First Input Delay): < ${WEB_VITALS.FID.good}ms`);
  console.log(`  • CLS (Cumulative Layout Shift): < ${WEB_VITALS.CLS.good}`);
  console.log(`  • FCP (First Contentful Paint): < ${WEB_VITALS.FCP.good}ms`);
  
  console.log(`\n${'='.repeat(60)}`);
  
  // Exit code
  const hasErrors = results.errors.length > 0;
  if (hasErrors) {
    console.log(`\n❌ Performance budget check FAILED`);
    console.log(`Fix the ${results.errors.length} error(s) above and try again.`);
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log(`\n⚠️  Performance budget check PASSED with warnings`);
    console.log(`Consider addressing the ${results.warnings.length} warning(s) above.`);
    process.exit(0);
  } else {
    console.log(`\n✅ Performance budget check PASSED`);
    console.log(`All bundles are within budget limits.`);
    process.exit(0);
  }
}

// Run the analysis
function main() {
  try {
    const results = analyzeBuild();
    generateReport(results);
  } catch (error) {
    console.error('❌ Performance budget check failed:', error.message);
    process.exit(1);
  }
}

main();