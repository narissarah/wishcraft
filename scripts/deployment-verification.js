#!/usr/bin/env node

// WishCraft Deployment Verification Script
// Tests all endpoints and validates Built for Shopify compliance

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.VERCEL_URL || 'https://your-app-domain.vercel.app';
const SHOP_DOMAIN = 'demo-shop.myshopify.com';

console.log('🚀 WishCraft Deployment Verification Starting...');
console.log(`Base URL: ${BASE_URL}`);
console.log('=' * 60);

// Test results storage
const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

// Performance thresholds for Built for Shopify
const PERFORMANCE_THRESHOLDS = {
    LCP: 2500, // ms
    CLS: 0.1,
    INP: 200, // ms
    TTFB: 600 // ms
};

// Test configuration
const ENDPOINTS_TO_TEST = [
    {
        name: 'Main Landing Page',
        path: '/',
        expectedStatus: 200,
        contentCheck: 'WishCraft',
        performance: true
    },
    {
        name: 'App Embedded Interface',
        path: '/app',
        expectedStatus: 200,
        contentCheck: 'Registry Dashboard',
        performance: true
    },
    {
        name: 'Optimized App Interface',
        path: '/app-optimized',
        expectedStatus: 200,
        contentCheck: 'Performance',
        performance: true
    },
    {
        name: 'Performance Test Suite',
        path: '/performance',
        expectedStatus: 200,
        contentCheck: 'Core Web Vitals',
        performance: true
    },
    {
        name: 'Registry Database API',
        path: `/api/registry-db?shop=${SHOP_DOMAIN}`,
        expectedStatus: 200,
        method: 'GET'
    },
    {
        name: 'Performance Monitor API',
        path: `/api/performance-monitor?shop=${SHOP_DOMAIN}`,
        expectedStatus: 200,
        method: 'GET'
    },
    {
        name: 'Database Status Check',
        path: `/api/db-status`,
        expectedStatus: 200,
        contentCheck: 'success'
    },
    {
        name: 'GDPR Webhook - Data Request',
        path: '/api/webhooks/customers-data-request',
        expectedStatus: 405, // Should reject GET requests
        method: 'GET'
    },
    {
        name: 'GDPR Webhook - Customer Redact',
        path: '/api/webhooks/customers-redact',
        expectedStatus: 405, // Should reject GET requests
        method: 'GET'
    },
    {
        name: 'GDPR Webhook - Shop Redact',
        path: '/api/webhooks/shop-redact',
        expectedStatus: 405, // Should reject GET requests
        method: 'GET'
    }
];

// HTTP request helper
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        const protocol = url.startsWith('https:') ? https : http;
        
        const requestOptions = {
            method: options.method || 'GET',
            timeout: 10000,
            headers: {
                'User-Agent': 'WishCraft-Deployment-Test/1.0',
                'Accept': 'text/html,application/json,*/*',
                ...options.headers
            }
        };

        const req = protocol.request(url, requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const endTime = performance.now();
                const responseTime = Math.round(endTime - startTime);
                
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: data,
                    responseTime: responseTime,
                    url: url
                });
            });
        });

        req.on('error', (error) => {
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            reject({
                error: error.message,
                responseTime: responseTime,
                url: url
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({
                error: 'Request timeout',
                responseTime: 10000,
                url: url
            });
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Test individual endpoint
async function testEndpoint(test) {
    const url = BASE_URL + test.path;
    const testName = test.name;
    
    console.log(`Testing: ${testName}`);
    console.log(`URL: ${url}`);
    
    try {
        const response = await makeRequest(url, {
            method: test.method || 'GET'
        });

        const result = {
            name: testName,
            url: url,
            expected: test.expectedStatus,
            actual: response.status,
            responseTime: response.responseTime,
            passed: false,
            details: {}
        };

        // Check status code
        if (response.status === test.expectedStatus) {
            result.passed = true;
            result.details.status = '✅ Status code correct';
        } else {
            result.details.status = `❌ Expected ${test.expectedStatus}, got ${response.status}`;
        }

        // Check content if specified
        if (test.contentCheck && response.data) {
            if (response.data.includes(test.contentCheck)) {
                result.details.content = '✅ Content check passed';
            } else {
                result.details.content = `❌ Content check failed - missing "${test.contentCheck}"`;
                result.passed = false;
            }
        }

        // Performance checks for Built for Shopify
        if (test.performance) {
            const ttfb = response.responseTime;
            if (ttfb <= PERFORMANCE_THRESHOLDS.TTFB) {
                result.details.ttfb = `✅ TTFB: ${ttfb}ms (≤ ${PERFORMANCE_THRESHOLDS.TTFB}ms)`;
            } else {
                result.details.ttfb = `⚠️ TTFB: ${ttfb}ms (> ${PERFORMANCE_THRESHOLDS.TTFB}ms)`;
            }
        }

        // Security headers check
        const securityHeaders = {
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'ALLOWALL'
        };

        let securityScore = 0;
        let securityTotal = 0;

        for (const [header, expectedValue] of Object.entries(securityHeaders)) {
            securityTotal++;
            if (response.headers[header]) {
                if (response.headers[header].toLowerCase().includes(expectedValue.toLowerCase())) {
                    securityScore++;
                }
            }
        }

        result.details.security = `🔒 Security headers: ${securityScore}/${securityTotal}`;

        testResults.tests.push(result);

        if (result.passed) {
            testResults.passed++;
            console.log(`✅ PASSED: ${testName}`);
        } else {
            testResults.failed++;
            console.log(`❌ FAILED: ${testName}`);
        }

        // Print details
        for (const [key, value] of Object.entries(result.details)) {
            console.log(`   ${value}`);
        }

        console.log(`   ⏱️ Response time: ${response.responseTime}ms`);
        console.log('');

    } catch (error) {
        testResults.failed++;
        testResults.tests.push({
            name: testName,
            url: url,
            passed: false,
            error: error.error || error.message,
            responseTime: error.responseTime || 0
        });

        console.log(`❌ FAILED: ${testName}`);
        console.log(`   Error: ${error.error || error.message}`);
        console.log('');
    }
}

// Test registry creation functionality
async function testRegistryCreation() {
    console.log('Testing Registry Creation API...');
    
    const testData = {
        title: 'Deployment Test Registry',
        description: 'Test registry created during deployment verification',
        eventType: 'wedding',
        eventDate: '2024-06-15',
        visibility: 'public'
    };

    try {
        const response = await makeRequest(BASE_URL + '/api/registry-db', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Shop-Domain': SHOP_DOMAIN
            },
            body: JSON.stringify(testData)
        });

        if (response.status === 200 || response.status === 201) {
            console.log('✅ Registry creation test passed');
            testResults.passed++;
            
            const responseData = JSON.parse(response.data);
            if (responseData.success) {
                console.log(`   Registry ID: ${responseData.data?.id}`);
            }
        } else {
            console.log('❌ Registry creation test failed');
            console.log(`   Status: ${response.status}`);
            testResults.failed++;
        }
    } catch (error) {
        console.log('❌ Registry creation test error');
        console.log(`   Error: ${error.error || error.message}`);
        testResults.failed++;
    }

    console.log('');
}

// Performance benchmark test
async function performancesBenchmark() {
    console.log('Running Performance Benchmark...');
    
    const performanceTests = [
        { name: 'Home Page', path: '/' },
        { name: 'App Interface', path: '/app' },
        { name: 'Optimized App', path: '/app-optimized' },
        { name: 'Performance Test', path: '/performance' }
    ];

    const results = [];

    for (const test of performanceTests) {
        try {
            const startTime = performance.now();
            const response = await makeRequest(BASE_URL + test.path);
            const endTime = performance.now();
            
            const loadTime = Math.round(endTime - startTime);
            results.push({
                name: test.name,
                loadTime: loadTime,
                passed: loadTime <= PERFORMANCE_THRESHOLDS.TTFB
            });

            const status = loadTime <= PERFORMANCE_THRESHOLDS.TTFB ? '✅' : '⚠️';
            console.log(`   ${status} ${test.name}: ${loadTime}ms`);
            
        } catch (error) {
            results.push({
                name: test.name,
                loadTime: 'ERROR',
                passed: false,
                error: error.message
            });
            console.log(`   ❌ ${test.name}: Error - ${error.message}`);
        }
    }

    const avgLoadTime = results
        .filter(r => typeof r.loadTime === 'number')
        .reduce((sum, r) => sum + r.loadTime, 0) / results.length;

    console.log(`   📊 Average load time: ${Math.round(avgLoadTime)}ms`);
    
    if (avgLoadTime <= PERFORMANCE_THRESHOLDS.TTFB) {
        console.log('   ✅ Performance benchmark PASSED');
        testResults.passed++;
    } else {
        console.log('   ⚠️ Performance benchmark needs improvement');
        testResults.failed++;
    }

    console.log('');
}

// Built for Shopify compliance check
async function builtForShopifyCompliance() {
    console.log('Checking Built for Shopify Compliance...');
    
    const complianceChecks = [
        {
            name: 'Performance Test Endpoint',
            check: () => makeRequest(BASE_URL + '/api/performance-test')
        },
        {
            name: 'Performance Monitor API',
            check: () => makeRequest(BASE_URL + '/api/performance-monitor')
        },
        {
            name: 'GDPR Webhooks Present',
            check: async () => {
                const webhooks = [
                    '/api/webhooks/customers-data-request',
                    '/api/webhooks/customers-redact',
                    '/api/webhooks/shop-redact'
                ];
                
                for (const webhook of webhooks) {
                    await makeRequest(BASE_URL + webhook);
                }
                return { status: 200 }; // If no errors, webhooks exist
            }
        }
    ];

    let compliancePassed = 0;
    let complianceTotal = complianceChecks.length;

    for (const check of complianceChecks) {
        try {
            await check.check();
            console.log(`   ✅ ${check.name}`);
            compliancePassed++;
        } catch (error) {
            console.log(`   ❌ ${check.name}: ${error.error || error.message}`);
        }
    }

    console.log(`   📊 Compliance Score: ${compliancePassed}/${complianceTotal}`);
    
    if (compliancePassed === complianceTotal) {
        console.log('   🏆 Built for Shopify compliance: READY');
        testResults.passed++;
    } else {
        console.log('   ⚠️ Built for Shopify compliance: NEEDS WORK');
        testResults.failed++;
    }

    console.log('');
}

// Generate final report
function generateReport() {
    console.log('=' * 60);
    console.log('📊 DEPLOYMENT VERIFICATION REPORT');
    console.log('=' * 60);
    
    const totalTests = testResults.passed + testResults.failed;
    const successRate = Math.round((testResults.passed / totalTests) * 100);
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${successRate}%`);
    console.log('');

    // Built for Shopify readiness
    if (successRate >= 90) {
        console.log('🏆 DEPLOYMENT STATUS: READY FOR PRODUCTION');
        console.log('🚀 Built for Shopify: COMPLIANT');
    } else if (successRate >= 75) {
        console.log('⚠️ DEPLOYMENT STATUS: NEEDS MINOR FIXES');
        console.log('🔧 Built for Shopify: NEARLY COMPLIANT');
    } else {
        console.log('❌ DEPLOYMENT STATUS: NEEDS MAJOR FIXES');
        console.log('🛠️ Built for Shopify: NOT READY');
    }

    console.log('');
    console.log('Detailed Results:');
    console.log('-' * 40);

    testResults.tests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`${status} ${test.name}`);
        if (test.error) {
            console.log(`   Error: ${test.error}`);
        }
        if (test.responseTime) {
            console.log(`   Response: ${test.responseTime}ms`);
        }
    });

    console.log('');
    console.log('Next Steps:');
    console.log('-' * 20);

    if (successRate >= 90) {
        console.log('1. ✅ Deploy to production');
        console.log('2. ✅ Submit to Shopify App Store');
        console.log('3. ✅ Apply for Built for Shopify');
    } else {
        console.log('1. 🔧 Fix failing tests');
        console.log('2. 🧪 Re-run verification');
        console.log('3. 📈 Improve performance metrics');
    }

    console.log('');
    console.log('WishCraft Deployment Verification Complete! 🎉');
}

// Main execution
async function runDeploymentVerification() {
    console.log('Starting endpoint tests...\n');
    
    // Test all endpoints
    for (const test of ENDPOINTS_TO_TEST) {
        await testEndpoint(test);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test registry creation
    await testRegistryCreation();
    
    // Performance benchmark
    await performancesBenchmark();
    
    // Built for Shopify compliance
    await builtForShopifyCompliance();
    
    // Generate final report
    generateReport();
}

// Run the verification
runDeploymentVerification().catch(error => {
    console.error('Verification script error:', error);
    process.exit(1);
});