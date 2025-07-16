#!/usr/bin/env node

/**
 * Bundle Analyzer for WishCraft
 * Analyzes webpack/vite bundles and generates detailed reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate bundle analysis report
function analyzeBundles() {
  console.log('📊 Starting bundle analysis...\n');
  
  const buildDir = path.join(__dirname, '..', 'build');
  const statsFile = path.join(buildDir, 'metafile.json');
  
  if (fs.existsSync(statsFile)) {
    analyzeEsbuildStats(statsFile);
  } else {
    analyzeFileSystem(buildDir);
  }
}

function analyzeEsbuildStats(statsFile) {
  console.log('📋 Analyzing esbuild metafile...\n');
  
  try {
    const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    
    // Analyze outputs
    const outputs = Object.entries(stats.outputs || {});
    const totalSize = outputs.reduce((sum, [, output]) => sum + (output.bytes || 0), 0);
    
    console.log(`Total bundle size: ${formatSize(totalSize)}\n`);
    
    // Sort by size
    const sortedOutputs = outputs
      .sort(([, a], [, b]) => (b.bytes || 0) - (a.bytes || 0))
      .slice(0, 20); // Top 20 largest files
    
    console.log('📦 Largest bundles:');
    for (const [file, output] of sortedOutputs) {
      const size = output.bytes || 0;
      const percent = ((size / totalSize) * 100).toFixed(1);
      console.log(`  ${formatSize(size)} (${percent}%) - ${file}`);
    }
    
    // Analyze imports
    if (stats.inputs) {
      console.log('\n📥 Most imported modules:');
      const importCounts = {};
      
      Object.values(stats.inputs).forEach(input => {
        if (input.imports) {
          input.imports.forEach(imp => {
            importCounts[imp.path] = (importCounts[imp.path] || 0) + 1;
          });
        }
      });
      
      const sortedImports = Object.entries(importCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
      
      for (const [module, count] of sortedImports) {
        console.log(`  ${count} imports - ${module}`);
      }
    }
    
  } catch (error) {
    console.error('Error analyzing stats:', error.message);
    analyzeFileSystem(path.dirname(statsFile));
  }
}

function analyzeFileSystem(buildDir) {
  console.log('📁 Analyzing file system...\n');
  
  if (!fs.existsSync(buildDir)) {
    console.error(`Build directory not found: ${buildDir}`);
    process.exit(1);
  }
  
  const files = getAllFiles(buildDir);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  console.log(`Found ${files.length} files`);
  console.log(`Total size: ${formatSize(totalSize)}\n`);
  
  // Group by type
  const byType = files.reduce((acc, file) => {
    const ext = path.extname(file.path).toLowerCase();
    if (!acc[ext]) acc[ext] = { count: 0, size: 0, files: [] };
    acc[ext].count++;
    acc[ext].size += file.size;
    acc[ext].files.push(file);
    return acc;
  }, {});
  
  console.log('📊 Files by type:');
  Object.entries(byType)
    .sort(([, a], [, b]) => b.size - a.size)
    .forEach(([ext, info]) => {
      const percent = ((info.size / totalSize) * 100).toFixed(1);
      console.log(`  ${ext || 'no extension'}: ${info.count} files, ${formatSize(info.size)} (${percent}%)`);
    });
  
  // Largest files
  console.log('\n📦 Largest files:');
  files
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)
    .forEach(file => {
      const percent = ((file.size / totalSize) * 100).toFixed(1);
      const relativePath = path.relative(buildDir, file.path);
      console.log(`  ${formatSize(file.size)} (${percent}%) - ${relativePath}`);
    });
}

function getAllFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else {
        const stats = fs.statSync(fullPath);
        files.push({
          path: fullPath,
          size: stats.size,
          name: entry.name,
        });
      }
    }
  }
  
  traverse(dir);
  return files;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Performance recommendations
function generateRecommendations() {
  console.log('\n🚀 Performance Recommendations:\n');
  
  console.log('📋 General optimizations:');
  console.log('  • Use dynamic imports for route-based code splitting');
  console.log('  • Implement lazy loading for non-critical components');
  console.log('  • Tree shake unused dependencies');
  console.log('  • Use Shopify CDN for static assets');
  console.log('  • Compress images with modern formats (WebP, AVIF)');
  console.log('  • Implement service worker for caching');
  
  console.log('\n🎯 Bundle-specific optimizations:');
  console.log('  • Split vendor dependencies into separate chunks');
  console.log('  • Use preload/prefetch for critical resources');
  console.log('  • Minimize polyfills for modern browsers');
  console.log('  • Use module federation for micro-frontends');
  
  console.log('\n📊 Monitoring:');
  console.log('  • Set up bundle size monitoring in CI/CD');
  console.log('  • Track Core Web Vitals in production');
  console.log('  • Use Lighthouse CI for performance regression testing');
  console.log('  • Monitor real user metrics (RUM)');
}

// Run analysis
analyzeBundles();
generateRecommendations();