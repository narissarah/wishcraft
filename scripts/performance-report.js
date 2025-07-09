#!/usr/bin/env node
// Performance report generation script

import { performanceAnalytics, performanceReporter } from '../app/lib/performance-dashboard.server.js';

async function generateReport() {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    console.log('🔍 Generating performance report...');
    console.log(`📅 Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Generate different format reports
    const jsonReport = await performanceReporter.generateReport(startDate, endDate, 'json');
    const csvReport = await performanceReporter.generateReport(startDate, endDate, 'csv');
    const htmlReport = await performanceReporter.generateReport(startDate, endDate, 'html');

    // Write reports to files
    const fs = await import('fs/promises');
    await fs.writeFile('performance-report.json', jsonReport);
    await fs.writeFile('performance-report.csv', csvReport);
    await fs.writeFile('performance-report.html', htmlReport);

    console.log('✅ Performance reports generated:');
    console.log('   📄 performance-report.json');
    console.log('   📊 performance-report.csv');
    console.log('   🌐 performance-report.html');

    // Display summary
    const data = JSON.parse(jsonReport);
    console.log('\n📈 Performance Summary:');
    console.log(`   📊 Total Page Views: ${data.overview.totalPageViews.toLocaleString()}`);
    console.log(`   ⏱️  Average Load Time: ${data.overview.averageLoadTime}ms`);
    console.log(`   🏆 Performance Score: ${data.overview.performanceScore}/100`);
    console.log(`   🎯 Core Web Vitals:`);
    console.log(`      LCP P50: ${data.overview.coreWebVitals.LCP.p50}ms`);
    console.log(`      FID P50: ${data.overview.coreWebVitals.FID.p50}ms`);
    console.log(`      CLS P50: ${data.overview.coreWebVitals.CLS.p50}`);
    
    if (data.overview.budgetViolations > 0) {
      console.log(`   ⚠️  Budget Violations: ${data.overview.budgetViolations}`);
    }

  } catch (error) {
    console.error('❌ Failed to generate performance report:', error);
    process.exit(1);
  }
}

generateReport();