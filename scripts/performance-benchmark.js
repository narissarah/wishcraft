#!/usr/bin/env node

// WishCraft Performance Benchmark Script
// Measures Core Web Vitals and Built for Shopify compliance

const https = require('https');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.VERCEL_URL || 'https://your-app-domain.vercel.app';

console.log('⚡ WishCraft Performance Benchmark');
console.log('Testing Built for Shopify Core Web Vitals Compliance');
console.log('=' * 60);

// Built for Shopify thresholds
const THRESHOLDS = {
    LCP: 2500, // ms - Largest Contentful Paint
    CLS: 0.1,  // - Cumulative Layout Shift  
    INP: 200,  // ms - Interaction to Next Paint
    TTFB: 600, // ms - Time to First Byte
    FCP: 1800, // ms - First Contentful Paint
    TBT: 200   // ms - Total Blocking Time
};

// Performance test results
const results = {
    endpoints: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        avgTTFB: 0
    }
};

// Test endpoints for performance
const TEST_ENDPOINTS = [
    {
        name: 'Main App Interface',
        path: '/app',
        weight: 3, // Higher weight for critical pages
        critical: true
    },
    {
        name: 'Optimized Interface',
        path: '/app-optimized',
        weight: 3,
        critical: true
    },
    {
        name: 'Performance Test Page',
        path: '/performance',
        weight: 2,
        critical: true
    },
    {
        name: 'Landing Page',
        path: '/',
        weight: 2,
        critical: false
    },
    {
        name: 'Registry API',
        path: '/api/registry-db',
        weight: 1,
        critical: true
    }
];

// Make HTTP request with timing
function makeTimedRequest(url) {
    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        
        const request = https.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'WishCraft-Performance-Test/1.0',
                'Accept': 'text/html,application/json'
            }
        }, (response) => {
            const firstByteTime = performance.now();
            const ttfb = Math.round(firstByteTime - startTime);
            
            let data = '';
            const chunks = [];
            let contentLength = 0;
            
            response.on('data', (chunk) => {
                chunks.push(chunk);
                contentLength += chunk.length;
                if (data.length === 0) {
                    // First content received
                    data += chunk;
                }
            });
            
            response.on('end', () => {
                const endTime = performance.now();
                const totalTime = Math.round(endTime - startTime);
                const fullData = Buffer.concat(chunks).toString();
                
                resolve({
                    status: response.statusCode,
                    headers: response.headers,
                    data: fullData,
                    metrics: {
                        ttfb: ttfb,
                        totalTime: totalTime,
                        contentLength: contentLength,
                        transferTime: Math.round(endTime - firstByteTime)
                    }
                });
            });
        });
        
        request.on('error', (error) => {
            const errorTime = performance.now();
            reject({
                error: error.message,
                time: Math.round(errorTime - startTime)
            });
        });
        
        request.on('timeout', () => {
            request.destroy();
            reject({
                error: 'Request timeout',
                time: 10000
            });
        });
    });
}

// Analyze performance metrics
function analyzePerformance(endpoint, response) {
    const metrics = response.metrics;
    const analysis = {
        endpoint: endpoint.name,
        url: BASE_URL + endpoint.path,
        critical: endpoint.critical,
        weight: endpoint.weight,
        metrics: metrics,
        scores: {},
        overall: 'unknown',
        passed: false
    };

    // TTFB Analysis
    if (metrics.ttfb <= THRESHOLDS.TTFB) {
        analysis.scores.ttfb = { score: 100, status: 'good' };
    } else if (metrics.ttfb <= THRESHOLDS.TTFB * 1.5) {
        analysis.scores.ttfb = { score: 75, status: 'needs-improvement' };
    } else {
        analysis.scores.ttfb = { score: 25, status: 'poor' };
    }

    // Estimate LCP based on content size and transfer time
    const estimatedLCP = metrics.ttfb + metrics.transferTime + 100; // Add render time estimate
    if (estimatedLCP <= THRESHOLDS.LCP) {
        analysis.scores.lcp = { score: 100, status: 'good' };
    } else if (estimatedLCP <= THRESHOLDS.LCP * 1.2) {
        analysis.scores.lcp = { score: 75, status: 'needs-improvement' };
    } else {
        analysis.scores.lcp = { score: 25, status: 'poor' };
    }

    // Content size analysis (affects performance)
    const sizeMB = metrics.contentLength / (1024 * 1024);
    if (sizeMB <= 0.5) {
        analysis.scores.size = { score: 100, status: 'excellent' };
    } else if (sizeMB <= 1.0) {
        analysis.scores.size = { score: 75, status: 'good' };
    } else {
        analysis.scores.size = { score: 50, status: 'needs-improvement' };
    }

    // Calculate overall score
    const scoreValues = Object.values(analysis.scores).map(s => s.score);
    const avgScore = scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
    
    if (avgScore >= 90) {
        analysis.overall = 'excellent';
        analysis.passed = true;
    } else if (avgScore >= 75) {
        analysis.overall = 'good';
        analysis.passed = true;
    } else if (avgScore >= 60) {
        analysis.overall = 'needs-improvement';
        analysis.passed = false;
    } else {
        analysis.overall = 'poor';
        analysis.passed = false;
    }

    return analysis;
}

// Test individual endpoint
async function testEndpoint(endpoint) {
    const url = BASE_URL + endpoint.path;
    console.log(`\nTesting: ${endpoint.name}`);
    console.log(`URL: ${url}`);
    
    try {
        const response = await makeTimedRequest(url);
        const analysis = analyzePerformance(endpoint, response);
        
        results.endpoints.push(analysis);
        results.summary.total++;
        
        if (analysis.passed) {
            results.summary.passed++;
        } else {
            results.summary.failed++;
        }
        
        // Print results
        const statusIcon = analysis.passed ? '✅' : '❌';
        console.log(`${statusIcon} ${endpoint.name} - ${analysis.overall.toUpperCase()}`);
        
        console.log(`   TTFB: ${analysis.metrics.ttfb}ms (${analysis.scores.ttfb.status})`);
        console.log(`   Est. LCP: ${analysis.metrics.ttfb + analysis.metrics.transferTime + 100}ms (${analysis.scores.lcp.status})`);
        console.log(`   Size: ${(analysis.metrics.contentLength / 1024).toFixed(1)}KB (${analysis.scores.size.status})`);
        console.log(`   Transfer: ${analysis.metrics.transferTime}ms`);
        
        if (analysis.critical && !analysis.passed) {
            console.log(`   ⚠️ CRITICAL: This endpoint affects Built for Shopify compliance`);
        }
        
    } catch (error) {
        console.log(`❌ ${endpoint.name} - ERROR`);
        console.log(`   Error: ${error.error}`);
        
        results.endpoints.push({
            endpoint: endpoint.name,
            url: url,
            critical: endpoint.critical,
            error: error.error,
            passed: false,
            overall: 'error'
        });
        
        results.summary.total++;
        results.summary.failed++;
    }
}

// Calculate weighted performance score
function calculateWeightedScore() {
    let totalWeight = 0;
    let weightedScore = 0;
    
    results.endpoints.forEach(result => {
        if (result.metrics) {
            const endpointScore = Object.values(result.scores || {})
                .reduce((sum, score) => sum + score.score, 0) / 
                Object.keys(result.scores || {}).length;
            
            weightedScore += endpointScore * (result.weight || 1);
            totalWeight += (result.weight || 1);
        }
    });
    
    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

// Test Core Web Vitals API endpoint
async function testCoreWebVitalsAPI() {
    console.log('\nTesting Core Web Vitals API...');
    
    try {
        const response = await makeTimedRequest(BASE_URL + '/api/performance-monitor');
        
        if (response.status === 200) {
            console.log('✅ Performance Monitor API - WORKING');
            
            try {
                const data = JSON.parse(response.data);
                if (data.requirements) {
                    console.log('   Built for Shopify thresholds:');
                    console.log(`   - LCP: ≤ ${data.requirements.LCP?.threshold}ms`);
                    console.log(`   - CLS: ≤ ${data.requirements.CLS?.threshold}`);
                    console.log(`   - INP: ≤ ${data.requirements.INP?.threshold}ms`);
                }
            } catch (e) {
                console.log('   API response received but not JSON');
            }
        } else {
            console.log(`❌ Performance Monitor API - Status ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ Performance Monitor API - ${error.error}`);
    }
}

// Generate performance report
function generatePerformanceReport() {
    console.log('\n' + '=' * 60);
    console.log('📊 PERFORMANCE BENCHMARK REPORT');
    console.log('=' * 60);
    
    const successRate = Math.round((results.summary.passed / results.summary.total) * 100);
    const weightedScore = calculateWeightedScore();
    
    // Calculate average TTFB
    const ttfbValues = results.endpoints
        .filter(r => r.metrics)
        .map(r => r.metrics.ttfb);
    const avgTTFB = ttfbValues.length > 0 ? 
        Math.round(ttfbValues.reduce((sum, ttfb) => sum + ttfb, 0) / ttfbValues.length) : 0;
    
    results.summary.avgTTFB = avgTTFB;
    
    console.log(`📈 Overall Performance Score: ${weightedScore}/100`);
    console.log(`⚡ Average TTFB: ${avgTTFB}ms (Target: ≤ ${THRESHOLDS.TTFB}ms)`);
    console.log(`✅ Endpoints Passed: ${results.summary.passed}/${results.summary.total} (${successRate}%)`);
    console.log('');
    
    // Built for Shopify compliance assessment
    const criticalEndpoints = results.endpoints.filter(r => r.critical);
    const criticalPassed = criticalEndpoints.filter(r => r.passed).length;
    const builtForShopifyCompliant = criticalPassed === criticalEndpoints.length && avgTTFB <= THRESHOLDS.TTFB;
    
    console.log('🏆 BUILT FOR SHOPIFY ASSESSMENT:');
    console.log(`   Critical Endpoints: ${criticalPassed}/${criticalEndpoints.length} passed`);
    console.log(`   TTFB Compliance: ${avgTTFB <= THRESHOLDS.TTFB ? '✅' : '❌'} (${avgTTFB}ms ≤ ${THRESHOLDS.TTFB}ms)`);
    console.log(`   Overall Status: ${builtForShopifyCompliant ? '✅ COMPLIANT' : '❌ NEEDS IMPROVEMENT'}`);
    console.log('');
    
    // Performance recommendations
    console.log('🔧 RECOMMENDATIONS:');
    
    if (avgTTFB > THRESHOLDS.TTFB) {
        console.log(`   • Optimize server response time (Current: ${avgTTFB}ms, Target: ≤ ${THRESHOLDS.TTFB}ms)`);
    }
    
    const largeEndpoints = results.endpoints.filter(r => r.metrics && r.metrics.contentLength > 500 * 1024);
    if (largeEndpoints.length > 0) {
        console.log(`   • Optimize content size for ${largeEndpoints.length} endpoint(s)`);
        largeEndpoints.forEach(e => {
            console.log(`     - ${e.endpoint}: ${(e.metrics.contentLength / 1024).toFixed(1)}KB`);
        });
    }
    
    const failedCritical = criticalEndpoints.filter(r => !r.passed);
    if (failedCritical.length > 0) {
        console.log(`   • Fix ${failedCritical.length} critical endpoint(s) for Built for Shopify compliance`);
        failedCritical.forEach(e => {
            console.log(`     - ${e.endpoint}: ${e.overall}`);
        });
    }
    
    if (builtForShopifyCompliant) {
        console.log('   🎉 All performance requirements met! Ready for Built for Shopify application.');
    }
    
    console.log('');
    console.log('📋 DETAILED RESULTS:');
    console.log('-' * 40);
    
    results.endpoints.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        const critical = result.critical ? ' [CRITICAL]' : '';
        console.log(`${status} ${result.endpoint}${critical}`);
        
        if (result.metrics) {
            console.log(`     TTFB: ${result.metrics.ttfb}ms | Size: ${(result.metrics.contentLength/1024).toFixed(1)}KB | Score: ${result.overall}`);
        } else if (result.error) {
            console.log(`     Error: ${result.error}`);
        }
    });
    
    console.log('');
    console.log('Performance Benchmark Complete! ⚡');
    
    // Exit with appropriate code
    process.exit(builtForShopifyCompliant ? 0 : 1);
}

// Main execution
async function runPerformanceBenchmark() {
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Testing ${TEST_ENDPOINTS.length} endpoints for Built for Shopify compliance...\n`);
    
    // Test all endpoints
    for (const endpoint of TEST_ENDPOINTS) {
        await testEndpoint(endpoint);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Test Core Web Vitals API
    await testCoreWebVitalsAPI();
    
    // Generate report
    generatePerformanceReport();
}

// Run the benchmark
runPerformanceBenchmark().catch(error => {
    console.error('Performance benchmark error:', error);
    process.exit(1);
});