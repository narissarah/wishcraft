// Core Web Vitals Testing and Real User Monitoring
// Tests LCP, CLS, INP against Built for Shopify requirements

module.exports = function handler(req, res) {
    try {
        console.log('Performance Test:', req.method, req.url);
        
        const shop = req.query.shop || 'demo-shop.myshopify.com';
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Performance Test - WishCraft</title>
    
    <!-- Preload critical resources -->
    <link rel="preload" href="https://unpkg.com/@shopify/app-bridge@4/umd/index.js" as="script">
    <link rel="preload" href="https://cdn.shopify.com/polaris-web-components/latest/polaris-web-components.js" as="script">
    
    <!-- DNS prefetch for performance -->
    <link rel="dns-prefetch" href="//unpkg.com">
    <link rel="dns-prefetch" href="//cdn.shopify.com">
    
    <!-- Critical CSS inlined for performance -->
    <style>
        /* Critical above-the-fold CSS */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, sans-serif;
            background: #f6f6f7;
            color: #202223;
            line-height: 1.5;
            padding: 1.25rem;
        }
        
        .test-container {
            max-width: 1200px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 0.5rem;
            box-shadow: 0 1px 0 0 rgba(22, 29, 37, 0.05);
            padding: 1.5rem;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin: 1.5rem 0;
        }
        
        .metric-card {
            background: #ffffff;
            border: 1px solid #e1e3e5;
            border-radius: 0.375rem;
            padding: 1.25rem;
            text-align: center;
        }
        
        .metric-value {
            font-size: 2rem;
            font-weight: 600;
            margin: 0.5rem 0;
        }
        
        .metric-good { color: #008060; }
        .metric-needs-improvement { color: #ff8a00; }
        .metric-poor { color: #d72c0d; }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .status-good { background-color: #008060; }
        .status-needs-improvement { background-color: #ff8a00; }
        .status-poor { background-color: #d72c0d; }
        
        .recommendations {
            background: #f6f6f7;
            border-radius: 0.375rem;
            padding: 1.25rem;
            margin-top: 1.5rem;
        }
        
        .loading {
            text-align: center;
            color: #6d7175;
            font-style: italic;
        }
        
        /* Performance optimized animations */
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        
        /* Ensure no layout shift */
        .metric-card {
            min-height: 150px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
    </style>
    
    <!-- Web Vitals library -->
    <script type="module" src="https://unpkg.com/web-vitals@3/dist/web-vitals.js"></script>
</head>
<body>
    <div class="test-container">
        <h1>WishCraft Performance Test</h1>
        <p style="color: #6d7175; margin-bottom: 1.5rem;">
            Testing Core Web Vitals compliance for Built for Shopify requirements
        </p>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Largest Contentful Paint (LCP)</h3>
                <div class="metric-value loading" id="lcp-value">Measuring...</div>
                <p style="font-size: 0.875rem; color: #6d7175;">
                    <span class="status-indicator" id="lcp-status"></span>
                    <span id="lcp-text">Target: ≤ 2.5s</span>
                </p>
            </div>
            
            <div class="metric-card">
                <h3>Cumulative Layout Shift (CLS)</h3>
                <div class="metric-value loading" id="cls-value">Measuring...</div>
                <p style="font-size: 0.875rem; color: #6d7175;">
                    <span class="status-indicator" id="cls-status"></span>
                    <span id="cls-text">Target: ≤ 0.1</span>
                </p>
            </div>
            
            <div class="metric-card">
                <h3>Interaction to Next Paint (INP)</h3>
                <div class="metric-value loading" id="inp-value">Measuring...</div>
                <p style="font-size: 0.875rem; color: #6d7175;">
                    <span class="status-indicator" id="inp-status"></span>
                    <span id="inp-text">Target: ≤ 200ms</span>
                </p>
            </div>
            
            <div class="metric-card">
                <h3>First Input Delay (FID)</h3>
                <div class="metric-value loading" id="fid-value">Measuring...</div>
                <p style="font-size: 0.875rem; color: #6d7175;">
                    <span class="status-indicator" id="fid-status"></span>
                    <span id="fid-text">Target: ≤ 100ms</span>
                </p>
            </div>
        </div>
        
        <div id="overall-status" style="text-align: center; margin: 2rem 0; font-size: 1.125rem; font-weight: 600;">
            <span class="status-indicator" id="overall-indicator"></span>
            <span id="overall-text">Testing in progress...</span>
        </div>
        
        <div class="recommendations" id="recommendations" style="display: none;">
            <h3>Performance Recommendations</h3>
            <div id="recommendation-list"></div>
        </div>
        
        <div style="margin-top: 2rem; padding: 1rem; background: #f1f2f3; border-radius: 0.375rem; font-size: 0.875rem;">
            <h4>Built for Shopify Requirements:</h4>
            <ul style="margin-top: 0.5rem; margin-left: 1.5rem;">
                <li>LCP: ≤ 2.5 seconds (Current threshold for approval)</li>
                <li>CLS: ≤ 0.1 (Minimal layout shift)</li>
                <li>INP: ≤ 200ms (Responsive interactions)</li>
                <li>Overall: Must meet all three metrics at 75th percentile</li>
            </ul>
        </div>
        
        <button onclick="runPerformanceTest()" style="margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #008060; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500;">
            Re-run Performance Test
        </button>
    </div>

    <script type="module">
        console.log('Performance Test initialized');
        
        // Import web vitals
        const { getCLS, getFID, getFCP, getLCP, getTTFB } = require('https://unpkg.com/web-vitals@3/dist/web-vitals.js');
        
        // Import INP polyfill
        const { onINP } = require('https://unpkg.com/web-vitals@3/dist/web-vitals.js');
        
        const shop = '${shop}';
        let metrics = {};
        
        // Built for Shopify thresholds
        const thresholds = {
            LCP: 2500, // 2.5 seconds
            CLS: 0.1,  // 0.1
            INP: 200,  // 200ms
            FID: 100   // 100ms
        };
        
        // Collect all metrics
        function initWebVitals() {
            getLCP((metric) => {
                metrics.LCP = metric.value;
                updateMetricDisplay('lcp', metric.value, thresholds.LCP, 'ms');
                checkOverallStatus();
            });
            
            getCLS((metric) => {
                metrics.CLS = metric.value;
                updateMetricDisplay('cls', metric.value, thresholds.CLS, '');
                checkOverallStatus();
            });
            
            onINP((metric) => {
                metrics.INP = metric.value;
                updateMetricDisplay('inp', metric.value, thresholds.INP, 'ms');
                checkOverallStatus();
            });
            
            getFID((metric) => {
                metrics.FID = metric.value;
                updateMetricDisplay('fid', metric.value, thresholds.FID, 'ms');
                checkOverallStatus();
            });
            
            // Send metrics to monitoring endpoint
            setTimeout(() => {
                sendMetricsToServer();
            }, 5000);
        }
        
        // Update individual metric display
        function updateMetricDisplay(metricName, value, threshold, unit) {
            const valueEl = document.getElementById(metricName + '-value');
            const statusEl = document.getElementById(metricName + '-status');
            const textEl = document.getElementById(metricName + '-text');
            
            let displayValue, status;
            
            if (metricName === 'cls') {
                displayValue = value.toFixed(3);
                status = value <= threshold ? 'good' : value <= threshold * 1.5 ? 'needs-improvement' : 'poor';
            } else {
                displayValue = Math.round(value) + unit;
                status = value <= threshold ? 'good' : value <= threshold * 1.5 ? 'needs-improvement' : 'poor';
            }
            
            valueEl.textContent = displayValue;
            valueEl.className = 'metric-value metric-' + status;
            statusEl.className = 'status-indicator status-' + status;
            
            const statusText = status === 'good' ? 'Good' : status === 'needs-improvement' ? 'Needs Improvement' : 'Poor';
            textEl.textContent = statusText + ' (Target: ≤ ' + threshold + unit + ')';
        }
        
        // Check overall status
        function checkOverallStatus() {
            const requiredMetrics = ['LCP', 'CLS', 'INP'];
            const availableMetrics = requiredMetrics.filter(metric => metrics[metric] !== undefined);
            
            if (availableMetrics.length < requiredMetrics.length) {
                return; // Still waiting for metrics
            }
            
            let passCount = 0;
            let totalMetrics = requiredMetrics.length;
            
            requiredMetrics.forEach(metric => {
                if (metrics[metric] <= thresholds[metric]) {
                    passCount++;
                }
            });
            
            const overallEl = document.getElementById('overall-text');
            const indicatorEl = document.getElementById('overall-indicator');
            
            if (passCount === totalMetrics) {
                overallEl.textContent = 'Built for Shopify Compliant ✅';
                indicatorEl.className = 'status-indicator status-good';
            } else if (passCount >= totalMetrics * 0.6) {
                overallEl.textContent = 'Needs Improvement ⚠️';
                indicatorEl.className = 'status-indicator status-needs-improvement';
            } else {
                overallEl.textContent = 'Performance Issues ❌';
                indicatorEl.className = 'status-indicator status-poor';
            }
            
            showRecommendations(passCount, totalMetrics);
        }
        
        // Show performance recommendations
        function showRecommendations(passCount, totalMetrics) {
            const recommendationsEl = document.getElementById('recommendations');
            const listEl = document.getElementById('recommendation-list');
            
            let recommendations = [];
            
            if (metrics.LCP > thresholds.LCP) {
                recommendations.push({
                    title: 'Optimize Largest Contentful Paint (LCP)',
                    items: [
                        'Optimize and compress images using WebP format',
                        'Implement lazy loading for below-the-fold content',
                        'Minimize render-blocking CSS and JavaScript',
                        'Use a Content Delivery Network (CDN)'
                    ]
                });
            }
            
            if (metrics.CLS > thresholds.CLS) {
                recommendations.push({
                    title: 'Reduce Cumulative Layout Shift (CLS)',
                    items: [
                        'Set explicit dimensions for images and videos',
                        'Reserve space for dynamic content and ads',
                        'Use CSS transforms instead of layout-triggering properties',
                        'Avoid inserting content above existing content'
                    ]
                });
            }
            
            if (metrics.INP > thresholds.INP) {
                recommendations.push({
                    title: 'Improve Interaction to Next Paint (INP)',
                    items: [
                        'Reduce JavaScript execution time',
                        'Implement code splitting and lazy loading',
                        'Optimize event handlers and debounce inputs',
                        'Use web workers for heavy computations'
                    ]
                });
            }
            
            if (recommendations.length === 0) {
                recommendations.push({
                    title: 'Excellent Performance! 🎉',
                    items: [
                        'All Core Web Vitals meet Built for Shopify requirements',
                        'Continue monitoring performance over time',
                        'Test on different devices and network conditions',
                        'Consider additional optimizations for exceptional performance'
                    ]
                });
            }
            
            listEl.innerHTML = recommendations.map(rec => \`
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="color: #202223; margin-bottom: 0.5rem;">\${rec.title}</h4>
                    <ul style="margin-left: 1.5rem; color: #6d7175;">
                        \${rec.items.map(item => \`<li style="margin-bottom: 0.25rem;">\${item}</li>\`).join('')}
                    </ul>
                </div>
            \`).join('');
            
            recommendationsEl.style.display = 'block';
        }
        
        // Send metrics to server for monitoring
        async function sendMetricsToServer() {
            try {
                const response = await fetch('/api/performance-monitor', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Shop-Domain': shop
                    },
                    body: JSON.stringify({
                        shop,
                        url: window.location.href,
                        userAgent: navigator.userAgent,
                        metrics: metrics,
                        timestamp: new Date().toISOString()
                    })
                });
                
                const result = await response.json();
                console.log('Performance metrics sent to server:', result);
                
            } catch (error) {
                console.error('Failed to send metrics to server:', error);
            }
        }
        
        // Global function for re-running test
        window.runPerformanceTest = function() {
            // Reset metrics
            metrics = {};
            
            // Reset display
            ['lcp', 'cls', 'inp', 'fid'].forEach(metric => {
                document.getElementById(metric + '-value').textContent = 'Measuring...';
                document.getElementById(metric + '-value').className = 'metric-value loading';
                document.getElementById(metric + '-status').className = 'status-indicator';
            });
            
            document.getElementById('overall-text').textContent = 'Testing in progress...';
            document.getElementById('overall-indicator').className = 'status-indicator';
            document.getElementById('recommendations').style.display = 'none';
            
            // Re-initialize
            setTimeout(() => {
                initWebVitals();
            }, 100);
        };
        
        // Initialize on load
        initWebVitals();
        
        console.log('Performance test ready - monitoring Core Web Vitals');
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        // Performance headers
        res.setHeader('X-DNS-Prefetch-Control', 'on');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        return res.status(200).send(html);
        
    } catch (error) {
        console.error('Performance Test error:', error);
        return res.status(500).json({
            error: 'Performance test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}