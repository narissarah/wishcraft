#!/usr/bin/env node

/**
 * Web Vitals Performance Measurement Script
 * Measures current performance metrics and checks Built for Shopify compliance
 */

const { PrismaClient } = require('@prisma/client');

// 2025 Built for Shopify Thresholds
const THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 }
};

async function measureWebVitals() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📊 Measuring Current Web Vitals Performance...\n');
    
    // Get performance metrics from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const metrics = await prisma.performanceMetrics.findMany({
      where: {
        createdAt: { gte: since }
      },
      select: {
        metricType: true,
        metricValue: true,
        shopId: true,
        url: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📈 Found ${metrics.length} performance measurements in last 24 hours\n`);
    
    if (metrics.length === 0) {
      console.log('❌ No performance data available. Web Vitals collection may not be active.');
      console.log('💡 Ensure the PerformanceMonitor component is included in your app layout.');
      return;
    }
    
    // Group metrics by type
    const groupedMetrics = metrics.reduce((acc, metric) => {
      if (!acc[metric.metricType]) {
        acc[metric.metricType] = [];
      }
      acc[metric.metricType].push(metric.metricValue);
      return acc;
    }, {});
    
    // Calculate statistics for each metric
    console.log('🎯 Core Web Vitals Analysis:\n');
    let overallCompliant = true;
    
    for (const [metricType, values] of Object.entries(groupedMetrics)) {
      const sorted = values.sort((a, b) => a - b);
      const count = values.length;
      const avg = values.reduce((a, b) => a + b, 0) / count;
      const p50 = sorted[Math.floor(count * 0.5)];
      const p75 = sorted[Math.floor(count * 0.75)];
      const p95 = sorted[Math.floor(count * 0.95)];
      
      const threshold = THRESHOLDS[metricType];
      if (!threshold) continue;
      
      // Check compliance (75th percentile must be within good threshold)
      const compliant = p75 <= threshold.good;
      if (!compliant) overallCompliant = false;
      
      const status = compliant ? '✅ GOOD' : 
                    p75 <= threshold.needsImprovement ? '⚠️  NEEDS IMPROVEMENT' : '❌ POOR';
      
      console.log(`${metricType}:`);
      console.log(`  Count: ${count} measurements`);
      console.log(`  Average: ${formatValue(avg, metricType)}`);
      console.log(`  75th percentile: ${formatValue(p75, metricType)} (${status})`);
      console.log(`  95th percentile: ${formatValue(p95, metricType)}`);
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
    
    // Check for critical CLS violations
    const clsViolations = await prisma.performanceMetrics.count({
      where: {
        metricType: 'CLS_VIOLATION',
        createdAt: { gte: since }
      }
    });
    
    if (clsViolations > 0) {
      console.log(`\n⚠️  ${clsViolations} CLS violations detected in last 24 hours`);
      console.log('   This may impact Built for Shopify certification');
    }
    
    // Shop-level analysis
    const shops = [...new Set(metrics.map(m => m.shopId))];
    if (shops.length > 1) {
      console.log(`\n🏪 Performance across ${shops.length} shops:`);
      
      for (const shopId of shops) {
        const shopMetrics = metrics.filter(m => m.shopId === shopId);
        const shopClsMetrics = shopMetrics.filter(m => m.metricType === 'CLS');
        
        if (shopClsMetrics.length > 0) {
          const shopClsP75 = shopClsMetrics
            .map(m => m.metricValue)
            .sort((a, b) => a - b)[Math.floor(shopClsMetrics.length * 0.75)];
          
          const shopCompliant = shopClsP75 <= 0.1;
          console.log(`  ${shopId}: ${shopCompliant ? '✅' : '❌'} CLS ${formatValue(shopClsP75, 'CLS')}`);
        }
      }
    }
    
    // Performance improvement recommendations
    if (!overallCompliant) {
      console.log('\n💡 Performance Improvement Recommendations:');
      
      if (groupedMetrics.CLS && THRESHOLDS.CLS) {
        const clsP75 = groupedMetrics.CLS.sort((a, b) => a - b)[Math.floor(groupedMetrics.CLS.length * 0.75)];
        if (clsP75 > THRESHOLDS.CLS.good) {
          console.log('  📐 CLS (Layout Stability):');
          console.log('    - Set explicit dimensions for images and embeds');
          console.log('    - Reserve space for dynamic content');
          console.log('    - Avoid inserting content above existing content');
        }
      }
      
      if (groupedMetrics.LCP && THRESHOLDS.LCP) {
        const lcpP75 = groupedMetrics.LCP.sort((a, b) => a - b)[Math.floor(groupedMetrics.LCP.length * 0.75)];
        if (lcpP75 > THRESHOLDS.LCP.good) {
          console.log('  🖼️  LCP (Loading Performance):');
          console.log('    - Optimize images with Shopify image transformation');
          console.log('    - Implement lazy loading for below-the-fold content');
          console.log('    - Preload critical resources');
        }
      }
      
      if (groupedMetrics.INP && THRESHOLDS.INP) {
        const inpP75 = groupedMetrics.INP.sort((a, b) => a - b)[Math.floor(groupedMetrics.INP.length * 0.75)];
        if (inpP75 > THRESHOLDS.INP.good) {
          console.log('  ⚡ INP (Interactivity):');
          console.log('    - Reduce JavaScript bundle size');
          console.log('    - Defer non-critical scripts');
          console.log('    - Optimize event handlers');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error measuring Web Vitals:', error.message);
    
    if (error.code === 'P1001') {
      console.log('💡 Database connection failed. Check your DATABASE_URL environment variable.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

function formatValue(value, metricType) {
  if (metricType === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

// Run the measurement
measureWebVitals().catch(console.error);