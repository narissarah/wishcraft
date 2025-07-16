#!/usr/bin/env node

/**
 * Web Vitals Simulation Script
 * Simulates realistic Web Vitals measurements for development/testing
 * Generates sample data that would typically come from client-side monitoring
 */

// 2025 Built for Shopify Thresholds
const THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 }
};

// Generate realistic sample data based on typical app performance
function generateSampleMetrics() {
  const metrics = [];
  const numSamples = 150; // Realistic sample size for 24 hours
  
  // Generate realistic variations for each metric
  for (let i = 0; i < numSamples; i++) {
    // CLS: Most apps struggle with this - generate realistic distribution
    const cls = Math.random() < 0.7 ? 
      Math.random() * 0.08 : // 70% good values
      Math.random() * 0.15 + 0.1; // 30% problematic values
    
    // LCP: Varies significantly by connection and content
    const lcp = Math.random() < 0.6 ?
      Math.random() * 2000 + 1500 : // 60% decent values
      Math.random() * 3000 + 2500; // 40% slower values
    
    // FID: Generally good on modern devices
    const fid = Math.random() < 0.8 ?
      Math.random() * 80 + 20 : // 80% good values
      Math.random() * 200 + 100; // 20% slower values
    
    // INP: 2025's primary responsiveness metric
    const inp = Math.random() < 0.7 ?
      Math.random() * 150 + 50 : // 70% good values
      Math.random() * 300 + 200; // 30% problematic values
    
    // FCP: Usually decent
    const fcp = Math.random() < 0.75 ?
      Math.random() * 1200 + 600 : // 75% good values
      Math.random() * 2000 + 1800; // 25% slower values
    
    // TTFB: Server performance related
    const ttfb = Math.random() < 0.6 ?
      Math.random() * 500 + 300 : // 60% good values
      Math.random() * 1000 + 800; // 40% slower values
    
    metrics.push({
      CLS: cls,
      LCP: lcp,
      FID: fid,
      INP: inp,
      FCP: fcp,
      TTFB: ttfb
    });
  }
  
  return metrics;
}

function calculateStats(values) {
  const sorted = values.sort((a, b) => a - b);
  const count = values.length;
  return {
    count,
    avg: values.reduce((a, b) => a + b, 0) / count,
    p50: sorted[Math.floor(count * 0.5)],
    p75: sorted[Math.floor(count * 0.75)],
    p95: sorted[Math.floor(count * 0.95)]
  };
}

function formatValue(value, metricType) {
  if (metricType === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

function getComplianceStatus(p75, threshold) {
  if (p75 <= threshold.good) return '✅ GOOD';
  if (p75 <= threshold.needsImprovement) return '⚠️  NEEDS IMPROVEMENT';
  return '❌ POOR';
}

function simulateWebVitals() {
  console.log('📊 Simulating Web Vitals Performance Analysis...\n');
  console.log('🎯 This simulation shows what performance monitoring would look like\n');
  
  const sampleData = generateSampleMetrics();
  const metricTypes = ['CLS', 'LCP', 'FID', 'INP', 'FCP', 'TTFB'];
  
  console.log(`📈 Analyzing ${sampleData.length} simulated measurements:\n`);
  
  let overallCompliant = true;
  const results = {};
  
  for (const metricType of metricTypes) {
    const values = sampleData.map(sample => sample[metricType]);
    const stats = calculateStats(values);
    const threshold = THRESHOLDS[metricType];
    
    if (!threshold) continue;
    
    const compliant = stats.p75 <= threshold.good;
    if (!compliant) overallCompliant = false;
    
    const status = getComplianceStatus(stats.p75, threshold);
    
    results[metricType] = { stats, compliant, status };
    
    console.log(`${metricType}:`);
    console.log(`  Count: ${stats.count} measurements`);
    console.log(`  Average: ${formatValue(stats.avg, metricType)}`);
    console.log(`  75th percentile: ${formatValue(stats.p75, metricType)} (${status})`);
    console.log(`  95th percentile: ${formatValue(stats.p95, metricType)}`);
    console.log(`  Threshold: ${formatValue(threshold.good, metricType)} (good)`);
    console.log('');
  }
  
  // Overall compliance status
  console.log('🏆 OVERALL COMPLIANCE:');
  if (overallCompliant) {
    console.log('✅ COMPLIANT - Your app meets Built for Shopify 2025 standards!');
  } else {
    console.log('❌ NOT COMPLIANT - Performance improvements needed for Built for Shopify certification');
  }
  
  // Count violations
  const clsViolations = sampleData.filter(sample => sample.CLS > 0.1).length;
  if (clsViolations > 0) {
    console.log(`\n⚠️  ${clsViolations} CLS violations detected (${(clsViolations/sampleData.length*100).toFixed(1)}% of measurements)`);
    console.log('   This may impact Built for Shopify certification');
  }
  
  // Recommendations based on simulation
  console.log('\n💡 Performance Improvement Recommendations:');
  
  if (!results.CLS.compliant) {
    console.log('  📐 CLS (Layout Stability):');
    console.log('    - Set explicit dimensions for images and embeds');
    console.log('    - Reserve space for dynamic content');
    console.log('    - Avoid inserting content above existing content');
    console.log('    - Use CSS transforms instead of changing layout properties');
  }
  
  if (!results.LCP.compliant) {
    console.log('  🖼️  LCP (Loading Performance):');
    console.log('    - Optimize images with Shopify image transformation');
    console.log('    - Implement lazy loading for below-the-fold content');
    console.log('    - Preload critical resources');
    console.log('    - Optimize server response times');
  }
  
  if (!results.INP.compliant) {
    console.log('  ⚡ INP (Interactivity - Primary 2025 Metric):');
    console.log('    - Reduce JavaScript bundle size');
    console.log('    - Defer non-critical scripts');
    console.log('    - Optimize event handlers');
    console.log('    - Use web workers for heavy computations');
  }
  
  if (!results.TTFB.compliant) {
    console.log('  🚀 TTFB (Server Performance):');
    console.log('    - Optimize database queries');
    console.log('    - Implement efficient caching');
    console.log('    - Use CDN for static assets');
    console.log('    - Optimize server infrastructure');
  }
  
  console.log('\n📝 Next Steps:');
  console.log('  1. Ensure PerformanceMonitor component is included in your app layout');
  console.log('  2. Deploy the app to start collecting real Web Vitals data');
  console.log('  3. Monitor the /app/performance dashboard for ongoing metrics');
  console.log('  4. Set up DATABASE_URL to enable real performance tracking');
  
  console.log('\n🔧 To Enable Real Monitoring:');
  console.log('  - Set DATABASE_URL environment variable');
  console.log('  - Run database migrations: npm run db:migrate');
  console.log('  - Include <PerformanceMonitor /> in your root layout');
  console.log('  - Visit your app to generate real Web Vitals data');
}

// Run the simulation
simulateWebVitals();