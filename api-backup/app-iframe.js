// WishCraft app - Clean Multi-Page Navigation Interface
export default function handler(req, res) {
  try {
    console.log('WishCraft clean multi-page app v3.0:', req.method, req.url);
    
    const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'demo-shop.myshopify.com';
    const host = req.query.host || '';
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>WishCraft - Gift Registry Management v3.0</title>
    
    <!-- Shopify App Bridge -->
    <script src="https://unpkg.com/@shopify/app-bridge@4/umd/index.js"></script>
    <script src="https://unpkg.com/@shopify/app-bridge-utils@3/umd/index.js"></script>
    
    <!-- Polaris Styles -->
    <link rel="stylesheet" href="https://unpkg.com/@shopify/polaris@12/build/esm/styles.css">
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f6f6f7;
            line-height: 1.6;
        }
        
        .app-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .app-header {
            background: white;
            padding: 1.5rem 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .app-title {
            font-size: 1.75rem;
            font-weight: 600;
            color: #202223;
        }
        
        .app-nav {
            display: flex;
            gap: 1rem;
        }
        
        .nav-btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s ease;
            background: #f6f6f7;
            color: #202223;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
        }
        
        .nav-btn:hover {
            background: #e8e8e8;
        }
        
        .nav-btn.active {
            background: #008060;
            color: white;
        }
        
        .page-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            min-height: 500px;
        }
        
        .page-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #202223;
            margin-bottom: 1rem;
        }
        
        .page-description {
            color: #6d7175;
            margin-bottom: 2rem;
        }
        
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .card {
            background: #f8f9fa;
            padding: 2rem;
            border-radius: 8px;
            border-left: 4px solid #008060;
        }
        
        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #202223;
            margin-bottom: 0.5rem;
        }
        
        .card-value {
            font-size: 2rem;
            font-weight: 700;
            color: #008060;
            margin-bottom: 0.5rem;
        }
        
        .card-label {
            color: #6d7175;
            font-size: 0.875rem;
        }
        
        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 1rem;
            margin-bottom: 1rem;
        }
        
        .btn-primary {
            background: #008060;
            color: white;
        }
        
        .btn-primary:hover {
            background: #005a46;
            transform: translateY(-1px);
        }
        
        .btn-secondary {
            background: #f6f6f7;
            color: #202223;
            border: 1px solid #d9d9d9;
        }
        
        .btn-secondary:hover {
            background: #e8e8e8;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 2rem;
            color: #6d7175;
        }
        
        .error {
            display: none;
            background: #fdf2f2;
            color: #c53030;
            padding: 1rem;
            border-radius: 6px;
            border-left: 4px solid #c53030;
            margin: 1rem 0;
        }
        
        .success {
            display: none;
            background: #f0fff4;
            color: #22543d;
            padding: 1rem;
            border-radius: 6px;
            border-left: 4px solid #008060;
            margin: 1rem 0;
        }
        
        .hidden { display: none; }
        
        @media (max-width: 768px) {
            .app-container { padding: 1rem; }
            .app-header { flex-direction: column; gap: 1rem; }
            .app-nav { flex-wrap: wrap; }
            .cards-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="app-container">
        <div class="app-header">
            <h1 class="app-title">🎁 WishCraft</h1>
            <nav class="app-nav">
                <a href="#" class="nav-btn active" data-page="dashboard">Dashboard</a>
                <a href="#" class="nav-btn" data-page="registries">Registries</a>
                <a href="#" class="nav-btn" data-page="analytics">Analytics</a>
                <a href="#" class="nav-btn" data-page="billing">Billing</a>
                <a href="#" class="nav-btn" data-page="settings">Settings</a>
            </nav>
        </div>

        <div class="loading" id="loading">
            <div>⏳ Loading...</div>
        </div>

        <div class="error" id="error">
            <strong>Error:</strong> <span id="error-text"></span>
        </div>

        <div class="success" id="success">
            <strong>Success:</strong> <span id="success-text"></span>
        </div>

        <!-- Dashboard Page -->
        <div id="page-dashboard" class="page-content">
            <h2 class="page-title">Dashboard Overview</h2>
            <p class="page-description">Welcome to your WishCraft dashboard. Get a quick overview of your gift registry performance.</p>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-title">Active Registries</div>
                    <div class="card-value" id="dashboard-registries">-</div>
                    <div class="card-label">Currently active</div>
                </div>
                <div class="card">
                    <div class="card-title">Total Items</div>
                    <div class="card-value" id="dashboard-items">-</div>
                    <div class="card-label">Across all registries</div>
                </div>
                <div class="card">
                    <div class="card-title">Total Views</div>
                    <div class="card-value" id="dashboard-views">-</div>
                    <div class="card-label">Registry page views</div>
                </div>
                <div class="card">
                    <div class="card-title">Completion Rate</div>
                    <div class="card-value" id="dashboard-completion">-%</div>
                    <div class="card-label">Items purchased</div>
                </div>
            </div>
        </div>

        <!-- Registry Management Page -->
        <div id="page-registries" class="page-content hidden">
            <h2 class="page-title">Registry Management</h2>
            <p class="page-description">Create and manage customer gift registries with complete product integration.</p>
            
            <div>
                <button class="btn btn-primary" onclick="showCreateForm()">Create New Registry</button>
                <button class="btn btn-secondary" onclick="loadRegistries()">Refresh List</button>
            </div>

            <div id="registry-list" style="margin-top: 2rem;">
                <div style="text-align: center; padding: 2rem; color: #6d7175;">
                    No registries found. Create your first registry to get started!
                </div>
            </div>
        </div>

        <!-- Analytics Page -->
        <div id="page-analytics" class="page-content hidden">
            <h2 class="page-title">Analytics & Insights</h2>
            <p class="page-description">Track registry performance, customer engagement, and conversion metrics.</p>
            
            <div>
                <button class="btn btn-primary" onclick="loadAnalytics()">Refresh Analytics</button>
                <button class="btn btn-secondary" onclick="exportAnalytics()">Export Reports</button>
            </div>

            <div class="cards-grid" style="margin-top: 2rem;">
                <div class="card">
                    <div class="card-title">Total Value</div>
                    <div class="card-value" id="analytics-total-value">$0</div>
                    <div class="card-label">All registry items</div>
                </div>
                <div class="card">
                    <div class="card-title">Purchased Value</div>
                    <div class="card-value" id="analytics-purchased-value">$0</div>
                    <div class="card-label">Items purchased</div>
                </div>
                <div class="card">
                    <div class="card-title">Customer Satisfaction</div>
                    <div class="card-value" id="analytics-satisfaction">-%</div>
                    <div class="card-label">Based on feedback</div>
                </div>
            </div>
        </div>

        <!-- Billing Page -->
        <div id="page-billing" class="page-content hidden">
            <h2 class="page-title">Subscription & Billing</h2>
            <p class="page-description">Manage your WishCraft subscription plan and billing information.</p>
            
            <div class="card">
                <div class="card-title">Current Plan</div>
                <div class="card-value">Basic</div>
                <div class="card-label">$9.99/month • Up to 50 registries</div>
            </div>

            <div style="margin-top: 2rem;">
                <button class="btn btn-primary" onclick="manageBilling()">Manage Billing</button>
                <button class="btn btn-secondary" onclick="viewUsage()">View Usage</button>
            </div>
        </div>

        <!-- Settings Page -->
        <div id="page-settings" class="page-content hidden">
            <h2 class="page-title">App Configuration</h2>
            <p class="page-description">Configure WishCraft settings, integrations, and preferences.</p>
            
            <div style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;">General Settings</h3>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Default Registry Visibility</label>
                    <select style="width: 100%; padding: 0.75rem; border: 1px solid #d9d9d9; border-radius: 6px;">
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
            </div>
        </div>
    </div>

    <script>
        console.log('WishCraft clean multi-page app v3.0 initializing...');
        
        const shop = '${shop}';
        const host = '${host}';
        
        // Navigation functionality
        function showPage(pageId) {
            // Hide all pages
            document.querySelectorAll('[id^="page-"]').forEach(page => {
                page.classList.add('hidden');
            });
            
            // Remove active class from all nav buttons
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected page
            const page = document.getElementById('page-' + pageId);
            if (page) {
                page.classList.remove('hidden');
            }
            
            // Add active class to selected nav button
            const navBtn = document.querySelector('[data-page="' + pageId + '"]');
            if (navBtn) {
                navBtn.classList.add('active');
            }
            
            // Load page-specific data
            if (pageId === 'dashboard') {
                loadDashboardData();
            }
        }

        // API helper functions
        async function makeAPICall(endpoint, options = {}) {
            const baseUrl = window.location.origin;
            const url = baseUrl + endpoint;
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Shop-Domain': shop,
                        ...options.headers
                    },
                    ...options
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || data.message || 'API request failed');
                }
                
                return data;
            } catch (error) {
                console.error('API Error:', error);
                showToast(error.message, true);
                throw error;
            }
        }

        function showToast(message, isError = false) {
            const element = isError ? document.getElementById('error') : document.getElementById('success');
            const textElement = isError ? document.getElementById('error-text') : document.getElementById('success-text');
            if (textElement) textElement.textContent = message;
            if (element) {
                element.style.display = 'block';
                setTimeout(() => element.style.display = 'none', 3000);
            }
        }

        // Dashboard functions with real data
        async function loadDashboardData() {
            try {
                const result = await makeAPICall('/api/registry?action=analytics&shop=' + encodeURIComponent(shop));
                
                if (result.success) {
                    const data = result.data;
                    document.getElementById('dashboard-registries').textContent = data.total_registries || 0;
                    document.getElementById('dashboard-items').textContent = data.total_items || 0;
                    document.getElementById('dashboard-views').textContent = data.total_views || 0;
                    document.getElementById('dashboard-completion').textContent = Math.round(data.avg_completion_rate || 0) + '%';
                }
            } catch (error) {
                console.error('Load dashboard data error:', error);
                // Set defaults on error
                document.getElementById('dashboard-registries').textContent = '0';
                document.getElementById('dashboard-items').textContent = '0';
                document.getElementById('dashboard-views').textContent = '0';
                document.getElementById('dashboard-completion').textContent = '0%';
            }
        }

        // Placeholder functions
        function showCreateForm() {
            showToast('Registry creation form coming soon!');
        }

        function loadRegistries() {
            showToast('Loading registries...');
        }

        function loadAnalytics() {
            showToast('Analytics refreshed!');
        }

        function exportAnalytics() {
            showToast('Export feature coming soon!');
        }

        function manageBilling() {
            showToast('Billing management coming soon!');
        }

        function viewUsage() {
            showToast('Usage details coming soon!');
        }

        function saveSettings() {
            showToast('Settings saved successfully!');
        }

        // Initialize app
        document.addEventListener('DOMContentLoaded', function() {
            console.log('WishCraft app loaded successfully');
            
            // Set up navigation event listeners
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const page = this.getAttribute('data-page');
                    showPage(page);
                });
            });
            
            // Load initial data
            loadDashboardData();
            
            console.log('WishCraft initialization complete');
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('ETag', 'wishcraft-v3.0-' + Date.now());
    
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('WishCraft app error:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}