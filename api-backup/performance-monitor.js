// Performance monitoring for Core Web Vitals compliance
export default function handler(req, res) {
    try {
        console.log('Performance Monitor:', req.method, req.url);

        if (req.method === 'POST') {
            return handlePerformanceReport(req, res);
        } else if (req.method === 'GET') {
            return handlePerformanceCheck(req, res);
        }

        return res.status(405).json({
            error: 'Method not allowed',
            allowed: ['GET', 'POST']
        });

    } catch (error) {
        console.error('Performance Monitor error:', error);
        return res.status(500).json({
            error: 'Performance monitoring failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Handle performance data from client
async function handlePerformanceReport(req, res) {
    try {
        const { metrics, url, userAgent, shop } = req.body;

        console.log('Performance metrics received:', {
            shop,
            url,
            metrics: {
                LCP: metrics?.LCP,
                CLS: metrics?.CLS,
                INP: metrics?.INP,
                TTFB: metrics?.TTFB
            }
        });

        // Analyze metrics against Shopify requirements
        const analysis = analyzeMetrics(metrics);

        // In production, you would store this data for monitoring
        // await storePerformanceData({ shop, url, userAgent, metrics, analysis });

        return res.status(200).json({
            success: true,
            analysis,
            recommendations: getRecommendations(analysis),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Performance report error:', error);
        return res.status(500).json({
            error: 'Failed to process performance report',
            message: error.message
        });
    }
}

// Handle performance status check
async function handlePerformanceCheck(req, res) {
    try {
        const shop = req.query.shop;

        // Performance requirements for Built for Shopify
        const requirements = {
            LCP: { threshold: 2500, unit: 'ms', description: 'Largest Contentful Paint' },
            CLS: { threshold: 0.1, unit: '', description: 'Cumulative Layout Shift' },
            INP: { threshold: 200, unit: 'ms', description: 'Interaction to Next Paint' },
            TTFB: { threshold: 600, unit: 'ms', description: 'Time to First Byte' }
        };

        // In production, get actual metrics from database
        const currentMetrics = {
            LCP: 1800, // Example values
            CLS: 0.08,
            INP: 150,
            TTFB: 400,
            lastMeasured: new Date().toISOString()
        };

        const analysis = analyzeMetrics(currentMetrics);

        return res.status(200).json({
            success: true,
            shop,
            requirements,
            currentMetrics,
            analysis,
            builtForShopifyCompliant: analysis.overall === 'good',
            recommendations: getRecommendations(analysis),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Performance check error:', error);
        return res.status(500).json({
            error: 'Failed to check performance status',
            message: error.message
        });
    }
}

// Analyze metrics against Shopify thresholds
function analyzeMetrics(metrics) {
    const analysis = {
        LCP: analyzeMetric(metrics.LCP, 2500, 'lower'),
        CLS: analyzeMetric(metrics.CLS, 0.1, 'lower'),
        INP: analyzeMetric(metrics.INP, 200, 'lower'),
        TTFB: analyzeMetric(metrics.TTFB, 600, 'lower')
    };

    // Determine overall status
    const scores = Object.values(analysis).map(a => a.score);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    analysis.overall = avgScore >= 0.8 ? 'good' : avgScore >= 0.6 ? 'needs_improvement' : 'poor';
    analysis.avgScore = Math.round(avgScore * 100);

    return analysis;
}

// Analyze individual metric
function analyzeMetric(value, threshold, direction = 'lower') {
    if (value === undefined || value === null) {
        return { status: 'unknown', score: 0, message: 'No data available' };
    }

    let status, score, message;

    if (direction === 'lower') {
        // Lower is better (LCP, CLS, INP, TTFB)
        if (value <= threshold) {
            status = 'good';
            score = 1;
            message = \`Excellent (\${value} ≤ \${threshold})\`;
        } else if (value <= threshold * 1.5) {
            status = 'needs_improvement';
            score = 0.6;
            message = \`Needs improvement (\${value} > \${threshold})\`;
        } else {
            status = 'poor';
            score = 0.2;
            message = \`Poor (\${value} >> \${threshold})\`;
        }
    }

    return { status, score, value, threshold, message };
}

// Get recommendations based on analysis
function getRecommendations(analysis) {
    const recommendations = [];

    if (analysis.LCP?.status !== 'good') {
        recommendations.push({
            metric: 'LCP',
            issue: 'Largest Contentful Paint is too slow',
            solutions: [
                'Optimize images with WebP format and lazy loading',
                'Minimize render-blocking CSS and JavaScript',
                'Use CDN for static assets',
                'Implement critical CSS inlining'
            ]
        });
    }

    if (analysis.CLS?.status !== 'good') {
        recommendations.push({
            metric: 'CLS',
            issue: 'Layout shifts are too high',
            solutions: [
                'Set dimensions for images and videos',
                'Avoid inserting content above existing content',
                'Use transform animations instead of animating layout properties',
                'Reserve space for ads and dynamic content'
            ]
        });
    }

    if (analysis.INP?.status !== 'good') {
        recommendations.push({
            metric: 'INP',
            issue: 'Interaction response time is too slow',
            solutions: [
                'Reduce JavaScript execution time',
                'Use code splitting and lazy loading',
                'Debounce input handlers',
                'Optimize event handler performance'
            ]
        });
    }

    if (analysis.TTFB?.status !== 'good') {
        recommendations.push({
            metric: 'TTFB',
            issue: 'Server response time is too slow',
            solutions: [
                'Optimize server-side processing',
                'Use edge caching and CDN',
                'Minimize database queries',
                'Implement proper caching strategies'
            ]
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            metric: 'overall',
            issue: 'Performance is good!',
            solutions: [
                'Continue monitoring performance regularly',
                'Test on different devices and network conditions',
                'Consider further optimizations for exceptional performance'
            ]
        });
    }

    return recommendations;
}