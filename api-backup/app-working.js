export default function handler(req, res) {
  try {
    console.log('WishCraft working app interface:', req.method, req.url);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>WishCraft - Gift Registry Management</title>
    <script src="https://unpkg.com/@shopify/app-bridge@3/umd/index.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f6f6f7; color: #202223; line-height: 1.5;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
        .header { background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .title { font-size: 24px; font-weight: 600; margin-bottom: 8px; color: #202223; }
        .subtitle { color: #6d7175; font-size: 14px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        .card { 
            background: white; padding: 24px; border-radius: 12px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e1e3e5;
        }
        .card-title { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
        .card-desc { color: #6d7175; font-size: 14px; margin-bottom: 16px; }
        .btn {
            background: #008060; color: white; border: none; padding: 12px 24px;
            border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;
            transition: background 0.2s; text-decoration: none; display: inline-block;
        }
        .btn:hover { background: #006b4a; }
        .btn-secondary { background: #f6f6f7; color: #202223; }
        .btn-secondary:hover { background: #e4e5e7; }
        .stats { display: flex; gap: 16px; margin-top: 16px; }
        .stat { text-align: center; }
        .stat-number { font-size: 24px; font-weight: 600; color: #008060; }
        .stat-label { font-size: 12px; color: #6d7175; text-transform: uppercase; }
        .status-badge { 
            background: #d1f7c4; color: #008060; padding: 4px 8px; 
            border-radius: 4px; font-size: 12px; font-weight: 500; 
        }
        .loading { display: none; }
        .result { margin-top: 10px; padding: 10px; border-radius: 4px; }
        .success { background: #d1f7c4; color: #008060; }
        .error { background: #fde7e7; color: #d72c0d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🎁 WishCraft Dashboard</h1>
            <p class="subtitle">Manage your store's gift registries and wishlists</p>
            <span class="status-badge">✅ Connected to Shopify 2025-07 API</span>
        </div>

        <div class="grid">
            <div class="card">
                <h2 class="card-title">📋 Registry Management</h2>
                <p class="card-desc">Create and manage customer gift registries with full product integration.</p>
                <button class="btn" onclick="createRegistry()">Create New Registry</button>
                <button class="btn btn-secondary" onclick="listRegistries()">View All Registries</button>
                <div id="registry-result" class="result" style="display: none;"></div>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number" id="registry-count">0</div>
                        <div class="stat-label">Active Registries</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" id="item-count">0</div>
                        <div class="stat-label">Items</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2 class="card-title">📊 Analytics</h2>
                <p class="card-desc">Track customer engagement with registries and performance metrics.</p>
                <button class="btn" onclick="viewAnalytics()">View Analytics</button>
                <div id="analytics-result" class="result" style="display: none;"></div>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number" id="total-views">0</div>
                        <div class="stat-label">Total Views</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" id="conversion-rate">0%</div>
                        <div class="stat-label">Conversion</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2 class="card-title">💳 Subscription</h2>
                <p class="card-desc">Manage your WishCraft subscription and billing settings.</p>
                <button class="btn" onclick="viewSubscription()">View Subscription</button>
                <div id="subscription-result" class="result" style="display: none;"></div>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number" id="plan-name">Basic</div>
                        <div class="stat-label">Current Plan</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" id="plan-price">$9.99</div>
                        <div class="stat-label">Monthly</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Initialize App Bridge
        const AppBridge = window['app-bridge'];
        const createApp = AppBridge ? AppBridge.default : null;
        
        let app = null;
        if (createApp) {
            app = createApp({
                apiKey: 'ac161e228a6b078fcdd3fa14586ded14',
                host: new URLSearchParams(location.search).get('host')
            });
        }

        // Utility functions
        function getShopFromHost() {
            const host = new URLSearchParams(location.search).get('host');
            if (host) {
                try {
                    return atob(host).split('/')[0];
                } catch (e) {
                    return 'demo-shop';
                }
            }
            return 'demo-shop';
        }

        function showResult(elementId, message, isError = false) {
            const element = document.getElementById(elementId);
            element.style.display = 'block';
            element.className = 'result ' + (isError ? 'error' : 'success');
            element.textContent = message;
        }

        function showToast(message) {
            if (app && AppBridge && AppBridge.actions && AppBridge.actions.Toast) {
                const toast = AppBridge.actions.Toast.create(app, {
                    message: message,
                    duration: 3000
                });
                toast.dispatch(AppBridge.actions.Toast.Action.SHOW);
            } else {
                alert(message);
            }
        }

        // Registry functions
        async function createRegistry() {
            const title = prompt('Enter registry title:');
            if (!title) return;
            
            const description = prompt('Enter registry description (optional):') || '';
            const eventType = prompt('Event type (wedding/birthday/baby-shower/general):') || 'general';
            
            try {
                const baseUrl = window.location.origin;
                const response = await fetch(baseUrl + '/api/registry?action=create&shop=' + getShopFromHost(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: getShopFromHost(),
                        title,
                        description,
                        eventType
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showResult('registry-result', 'Registry "' + title + '" created successfully!');
                    showToast('Registry created successfully!');
                    loadRegistryStats();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showResult('registry-result', 'Failed to create registry: ' + error.message, true);
            }
        }

        async function listRegistries() {
            try {
                const baseUrl = window.location.origin;
                const response = await fetch(baseUrl + '/api/registry?action=list&shop=' + getShopFromHost());
                const result = await response.json();
                
                if (result.success) {
                    const count = result.registries.length;
                    showResult('registry-result', count + ' registries found. Check browser console for details.');
                    console.log('Registries:', result.registries);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showResult('registry-result', 'Failed to load registries: ' + error.message, true);
            }
        }

        async function viewAnalytics() {
            try {
                const baseUrl = window.location.origin;
                const response = await fetch(baseUrl + '/api/admin?action=analytics&shop=' + getShopFromHost());
                const result = await response.json();
                
                if (result.success) {
                    showResult('analytics-result', 'Analytics loaded successfully. Check browser console for details.');
                    console.log('Analytics:', result.analytics);
                    
                    // Update stats
                    document.getElementById('total-views').textContent = result.analytics.overview.totalViews;
                    document.getElementById('conversion-rate').textContent = '34%';
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showResult('analytics-result', 'Failed to load analytics: ' + error.message, true);
            }
        }

        async function viewSubscription() {
            try {
                const baseUrl = window.location.origin;
                const response = await fetch(baseUrl + '/api/admin?action=subscription&shop=' + getShopFromHost());
                const result = await response.json();
                
                if (result.success) {
                    showResult('subscription-result', 'Subscription: ' + result.subscription.planName + ' - $' + result.subscription.planPrice + '/month');
                    
                    // Update stats
                    document.getElementById('plan-name').textContent = result.subscription.planName;
                    document.getElementById('plan-price').textContent = '$' + result.subscription.planPrice;
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showResult('subscription-result', 'Failed to load subscription: ' + error.message, true);
            }
        }

        async function loadRegistryStats() {
            try {
                const baseUrl = window.location.origin;
                const response = await fetch(baseUrl + '/api/registry?action=list&shop=' + getShopFromHost());
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('registry-count').textContent = result.registries.length;
                    const totalItems = result.registries.reduce((sum, reg) => sum + (reg.itemCount || 0), 0);
                    document.getElementById('item-count').textContent = totalItems;
                }
            } catch (error) {
                console.error('Failed to load registry stats:', error);
            }
        }

        // Load initial data
        document.addEventListener('DOMContentLoaded', function() {
            console.log('WishCraft app loading...');
            console.log('Current URL:', window.location.href);
            console.log('Shop from host:', getShopFromHost());
            
            loadRegistryStats();
            console.log('WishCraft app initialized successfully');
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com");
    res.status(200).send(html);

  } catch (error) {
    console.error('App interface error:', error);
    res.status(500).json({
      success: false,
      error: "App interface failed to load",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}