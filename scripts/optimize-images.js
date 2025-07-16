#!/usr/bin/env node

/**
 * Image Optimization Script for WishCraft
 * Optimizes images for web delivery
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Image optimization recommendations
 */
async function analyzeImages() {
  console.log('🖼️  Image Optimization Analysis for WishCraft\n');
  
  const publicDir = path.join(__dirname, '..', 'public');
  const appDir = path.join(__dirname, '..', 'app');
  
  const images = await findImages([publicDir, appDir]);
  
  if (images.length === 0) {
    console.log('No images found in the project.\n');
    return;
  }
  
  console.log(`Found ${images.length} images\n`);
  
  // Analyze each image
  const issues = [];
  let totalSize = 0;
  let largImages = 0;
  let unoptimizedFormats = 0;
  
  for (const imagePath of images) {
    const stats = await fs.stat(imagePath);
    const size = stats.size;
    totalSize += size;
    
    const ext = path.extname(imagePath).toLowerCase();
    const filename = path.basename(imagePath);
    const sizeKB = Math.round(size / 1024);
    
    // Check for large images
    if (size > 100 * 1024) { // 100KB
      largImages++;
      issues.push({
        file: filename,
        issue: 'Large file size',
        size: sizeKB,
        suggestion: 'Compress or use responsive images',
      });
    }
    
    // Check for unoptimized formats
    if (['.bmp', '.tiff', '.tif'].includes(ext)) {
      unoptimizedFormats++;
      issues.push({
        file: filename,
        issue: 'Unoptimized format',
        format: ext,
        suggestion: 'Convert to WebP or optimized JPEG/PNG',
      });
    }
    
    // Check for non-WebP images
    if (['.jpg', '.jpeg', '.png'].includes(ext) && !filename.includes('fallback')) {
      issues.push({
        file: filename,
        issue: 'Not using modern format',
        format: ext,
        suggestion: 'Provide WebP alternative',
      });
    }
  }
  
  // Generate report
  console.log('📊 Image Optimization Report\n');
  console.log('='.repeat(60));
  
  console.log('\n📈 Summary:');
  console.log(`Total images: ${images.length}`);
  console.log(`Total size: ${Math.round(totalSize / 1024 / 1024 * 10) / 10} MB`);
  console.log(`Average size: ${Math.round(totalSize / images.length / 1024)} KB`);
  console.log(`Large images (>100KB): ${largImages}`);
  console.log(`Unoptimized formats: ${unoptimizedFormats}`);
  
  if (issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    console.log('-'.repeat(60));
    
    // Group by issue type
    const byIssue = issues.reduce((acc, issue) => {
      if (!acc[issue.issue]) acc[issue.issue] = [];
      acc[issue.issue].push(issue);
      return acc;
    }, {});
    
    Object.entries(byIssue).forEach(([issueType, items]) => {
      console.log(`\n${issueType} (${items.length} files):`);
      items.slice(0, 5).forEach(item => {
        if (item.size) {
          console.log(`  - ${item.file} (${item.size}KB) - ${item.suggestion}`);
        } else {
          console.log(`  - ${item.file} (${item.format}) - ${item.suggestion}`);
        }
      });
      if (items.length > 5) {
        console.log(`  ... and ${items.length - 5} more`);
      }
    });
  }
  
  // Optimization recommendations
  console.log('\n🚀 Optimization Recommendations:\n');
  
  console.log('1. Image Format Strategy:');
  console.log('   - Use WebP as primary format (30-50% smaller)');
  console.log('   - Provide JPEG/PNG fallbacks for older browsers');
  console.log('   - Use AVIF for even better compression (when supported)');
  console.log('   - Consider SVG for icons and simple graphics\n');
  
  console.log('2. Responsive Images:');
  console.log('   - Generate multiple sizes: 320w, 640w, 960w, 1280w, 1920w');
  console.log('   - Use srcset and sizes attributes');
  console.log('   - Implement art direction with <picture> element\n');
  
  console.log('3. Shopify CDN Integration:');
  console.log('   - Use Shopify Image Transformation API');
  console.log('   - Example: image.jpg?width=600&format=webp');
  console.log('   - Automatic optimization and global CDN delivery\n');
  
  console.log('4. Loading Strategy:');
  console.log('   - Lazy load below-the-fold images');
  console.log('   - Preload critical hero images');
  console.log('   - Use blur-up placeholders for better UX\n');
  
  console.log('5. Implementation:');
  console.log('   - Use the OptimizedImage component');
  console.log('   - Import from ~/components/OptimizedImage');
  console.log('   - Automatic format selection and lazy loading\n');
  
  // Generate optimization script
  console.log('📝 Quick Optimization Commands:\n');
  
  console.log('# Install image optimization tools:');
  console.log('npm install -g sharp-cli imagemin-cli\n');
  
  console.log('# Convert images to WebP:');
  console.log('for file in public/images/*.{jpg,png}; do');
  console.log('  npx sharp "$file" -o "${file%.*}.webp"');
  console.log('done\n');
  
  console.log('# Optimize existing images:');
  console.log('npx imagemin "public/images/*.{jpg,png}" --out-dir="public/images/optimized"\n');
  
  console.log('# Generate responsive images:');
  console.log('npx sharp input.jpg --resize 320 --output small.jpg');
  console.log('npx sharp input.jpg --resize 640 --output medium.jpg');
  console.log('npx sharp input.jpg --resize 1280 --output large.jpg\n');
  
  console.log('='.repeat(60));
  
  // Check for Shopify CDN usage
  await checkShopifyCDN();
}

/**
 * Find all image files
 */
async function findImages(dirs) {
  const images = [];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];
  
  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (imageExtensions.includes(ext)) {
            images.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }
  
  for (const dir of dirs) {
    await scanDir(dir);
  }
  
  return images;
}

/**
 * Check for Shopify CDN usage
 */
async function checkShopifyCDN() {
  console.log('\n🔍 Checking Shopify CDN Usage...\n');
  
  const componentsDir = path.join(__dirname, '..', 'app', 'components');
  const routesDir = path.join(__dirname, '..', 'app', 'routes');
  
  let shopifyCDNUsage = 0;
  let localImageUsage = 0;
  
  // Scan for image usage patterns
  const files = await findCodeFiles([componentsDir, routesDir]);
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    
    // Check for Shopify CDN URLs
    const shopifyCDNMatches = content.match(/cdn\.shopify\.com/g);
    if (shopifyCDNMatches) {
      shopifyCDNUsage += shopifyCDNMatches.length;
    }
    
    // Check for local image imports
    const localImageMatches = content.match(/from ['"].*\.(jpg|jpeg|png|gif|webp)['"]/g);
    if (localImageMatches) {
      localImageUsage += localImageMatches.length;
    }
  }
  
  if (shopifyCDNUsage > 0 || localImageUsage > 0) {
    console.log('Image Usage Patterns:');
    console.log(`  - Shopify CDN images: ${shopifyCDNUsage}`);
    console.log(`  - Local images: ${localImageUsage}`);
    
    if (localImageUsage > shopifyCDNUsage) {
      console.log('\n💡 Tip: Consider moving images to Shopify CDN for:');
      console.log('  - Automatic optimization');
      console.log('  - Global CDN delivery');
      console.log('  - On-the-fly transformations');
      console.log('  - Reduced bundle size');
    }
  }
}

/**
 * Find code files
 */
async function findCodeFiles(dirs) {
  const files = [];
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  
  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (codeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }
  
  for (const dir of dirs) {
    await scanDir(dir);
  }
  
  return files;
}

// Run the analysis
analyzeImages().catch(console.error);