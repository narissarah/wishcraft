#!/usr/bin/env node
/**
 * Performance Budget Enforcement
 * Built for Shopify 2025 Compliance
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Built for Shopify 2025 Performance Budgets
const PERFORMANCE_BUDGETS = {
  // Bundle Size Limits
  bundleSize: {
    initial: 250 * 1024, // 250KB gzipped
    total: 500 * 1024,   // 500KB gzipped
    css: 50 * 1024,      // 50KB gzipped
    js: 200 * 1024,      // 200KB gzipped
  },
  
  // Core Web Vitals Thresholds (Built for Shopify 2025)
  coreWebVitals: {
    lcp: 2500,    // Largest Contentful Paint (ms)
    fid: 100,     // First Input Delay (ms)
    cls: 0.1,     // Cumulative Layout Shift
    ttfb: 800,    // Time to First Byte (ms)
    fcp: 1800,    // First Contentful Paint (ms)
  },
  
  // Performance Score Thresholds
  performanceScores: {
    lighthouse: 90,
    accessibility: 95,
    bestPractices: 85,
    seo: 80,
  }
};

class PerformanceBudgetChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  checkBundleSize() {
    console.log(chalk.blue('📦 Checking Bundle Size...'));
    
    const buildDir = path.join(__dirname, '../public/build');
    
    if (!fs.existsSync(buildDir)) {
      this.errors.push('Build directory not found. Run `npm run build` first.');
      return;
    }

    const files = fs.readdirSync(buildDir, { withFileTypes: true });
    let totalSize = 0;
    let jsSize = 0;
    let cssSize = 0;

    files.forEach(file => {
      if (file.isFile()) {
        const filePath = path.join(buildDir, file.name);
        const stats = fs.statSync(filePath);
        const size = stats.size;
        
        totalSize += size;
        
        if (file.name.endsWith('.js')) {
          jsSize += size;
        } else if (file.name.endsWith('.css')) {
          cssSize += size;
        }
      }
    });

    // Check bundle size limits
    if (totalSize > PERFORMANCE_BUDGETS.bundleSize.total) {
      this.errors.push(`Total bundle size (${this.formatSize(totalSize)}) exceeds limit (${this.formatSize(PERFORMANCE_BUDGETS.bundleSize.total)})`);
    } else {
      this.passed.push(`Total bundle size: ${this.formatSize(totalSize)}`);
    }

    if (jsSize > PERFORMANCE_BUDGETS.bundleSize.js) {
      this.errors.push(`JavaScript bundle size (${this.formatSize(jsSize)}) exceeds limit (${this.formatSize(PERFORMANCE_BUDGETS.bundleSize.js)})`);
    } else {
      this.passed.push(`JavaScript size: ${this.formatSize(jsSize)}`);
    }

    if (cssSize > PERFORMANCE_BUDGETS.bundleSize.css) {
      this.warnings.push(`CSS bundle size (${this.formatSize(cssSize)}) exceeds limit (${this.formatSize(PERFORMANCE_BUDGETS.bundleSize.css)})`);
    } else {
      this.passed.push(`CSS size: ${this.formatSize(cssSize)}`);
    }
  }

  checkLighthouseResults() {
    console.log(chalk.blue('🔍 Checking Lighthouse Results...'));
    
    const manifestPath = path.join(__dirname, '../.lighthouseci/lhci_reports/manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      this.warnings.push('Lighthouse CI results not found. Run lighthouse tests first.');
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const reportPath = manifest[0].jsonPath;
      const lhr = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

      // Check Core Web Vitals
      const lcp = lhr.audits['largest-contentful-paint'].numericValue;
      const fid = lhr.audits['max-potential-fid'].numericValue;
      const cls = lhr.audits['cumulative-layout-shift'].numericValue;
      const ttfb = lhr.audits['server-response-time'].numericValue;
      const fcp = lhr.audits['first-contentful-paint'].numericValue;

      this.checkMetric('LCP', lcp, PERFORMANCE_BUDGETS.coreWebVitals.lcp, 'ms');
      this.checkMetric('FID', fid, PERFORMANCE_BUDGETS.coreWebVitals.fid, 'ms');
      this.checkMetric('CLS', cls, PERFORMANCE_BUDGETS.coreWebVitals.cls, '');
      this.checkMetric('TTFB', ttfb, PERFORMANCE_BUDGETS.coreWebVitals.ttfb, 'ms');
      this.checkMetric('FCP', fcp, PERFORMANCE_BUDGETS.coreWebVitals.fcp, 'ms');

      // Check Performance Scores
      const performanceScore = lhr.categories.performance.score * 100;
      const accessibilityScore = lhr.categories.accessibility.score * 100;
      const bestPracticesScore = lhr.categories['best-practices'].score * 100;
      const seoScore = lhr.categories.seo.score * 100;

      this.checkScore('Performance', performanceScore, PERFORMANCE_BUDGETS.performanceScores.lighthouse);
      this.checkScore('Accessibility', accessibilityScore, PERFORMANCE_BUDGETS.performanceScores.accessibility);
      this.checkScore('Best Practices', bestPracticesScore, PERFORMANCE_BUDGETS.performanceScores.bestPractices);
      this.checkScore('SEO', seoScore, PERFORMANCE_BUDGETS.performanceScores.seo);

    } catch (error) {
      this.errors.push(`Error reading Lighthouse results: ${error.message}`);
    }
  }

  checkMetric(name, value, threshold, unit) {
    if (value > threshold) {
      this.errors.push(`${name} (${value}${unit}) exceeds Built for Shopify threshold (${threshold}${unit})`);
    } else {
      this.passed.push(`${name}: ${value}${unit} (within ${threshold}${unit} threshold)`);
    }
  }

  checkScore(name, score, threshold) {
    if (score < threshold) {
      this.errors.push(`${name} score (${score}) below Built for Shopify threshold (${threshold})`);
    } else {
      this.passed.push(`${name} score: ${score} (above ${threshold} threshold)`);
    }
  }

  formatSize(bytes) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)}KB`;
  }

  generateReport() {
    console.log('\n' + chalk.bold('📊 Performance Budget Report'));
    console.log(chalk.bold('=' .repeat(50)));

    if (this.passed.length > 0) {
      console.log(chalk.green('\n✅ Passed:'));
      this.passed.forEach(item => console.log(chalk.green(`  ✓ ${item}`)));
    }

    if (this.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      this.warnings.forEach(item => console.log(chalk.yellow(`  ⚠ ${item}`)));
    }

    if (this.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors:'));
      this.errors.forEach(item => console.log(chalk.red(`  ✗ ${item}`)));
    }

    console.log('\n' + chalk.bold('Summary:'));
    console.log(`  Passed: ${chalk.green(this.passed.length)}`);
    console.log(`  Warnings: ${chalk.yellow(this.warnings.length)}`);
    console.log(`  Errors: ${chalk.red(this.errors.length)}`);

    if (this.errors.length > 0) {
      console.log(chalk.red('\n❌ Performance budget check failed!'));
      console.log(chalk.red('Please address the errors above before proceeding.'));
      process.exit(1);
    } else if (this.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Performance budget check passed with warnings.'));
    } else {
      console.log(chalk.green('\n✅ All performance budgets passed!'));
      console.log(chalk.green('Ready for Built for Shopify 2025 certification.'));
    }
  }

  run() {
    console.log(chalk.bold('🚀 Running Performance Budget Check'));
    console.log(chalk.bold('Built for Shopify 2025 Compliance'));
    console.log('='.repeat(50));

    this.checkBundleSize();
    this.checkLighthouseResults();
    this.generateReport();
  }
}

// Export for use in other scripts
module.exports = PerformanceBudgetChecker;

// Run if called directly
if (require.main === module) {
  const checker = new PerformanceBudgetChecker();
  checker.run();
}