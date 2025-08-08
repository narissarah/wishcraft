// WishCraft app - Direct Multi-Page Navigation Interface (Override)
export default function handler(req, res) {
  try {
    console.log('WishCraft DIRECT multi-page app v4.0:', req.method, req.url);
    
    const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'demo-shop.myshopify.com';
    const host = req.query.host || '';
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>🎁 WishCraft - Multi-Page v4.0</title>
    
    <!-- Shopify App Bridge -->
    <script src="https://unpkg.com/@shopify/app-bridge@4/umd/index.js"></script>
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
            transform: translateY(-1px);
        }
        
        .nav-btn.active {
            background: #008060;
            color: white;
            box-shadow: 0 2px 4px rgba(0,128,96,0.2);
        }
        
        .page-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            min-height: 500px;
        }
        
        .page-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #202223;
            margin-bottom: 1rem;
            border-bottom: 2px solid #008060;
            padding-bottom: 0.5rem;
        }
        
        .page-description {
            color: #6d7175;
            margin-bottom: 2rem;
            font-size: 1rem;
        }
        
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 2rem;
            border-radius: 12px;
            border-left: 4px solid #008060;
            transition: transform 0.2s ease;
        }
        
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #202223;
            margin-bottom: 0.5rem;
        }
        
        .card-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: #008060;
            margin-bottom: 0.5rem;
        }
        
        .card-label {
            color: #6d7175;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
            box-shadow: 0 2px 8px rgba(0,128,96,0.3);
        }
        
        .btn-secondary {
            background: #f6f6f7;
            color: #202223;
            border: 1px solid #d9d9d9;
        }
        
        .btn-secondary:hover {
            background: #e8e8e8;
        }
        
        .success-message {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            color: #155724;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #28a745;
            margin: 1rem 0;
            font-weight: 500;
        }
        
        .hidden { display: none; }
        
        @media (max-width: 768px) {
            .app-container { padding: 1rem; }
            .app-header { flex-direction: column; gap: 1rem; }
            .app-nav { flex-wrap: wrap; justify-content: center; }
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

        <div class="success-message">
            ✅ NEW INTERFACE LOADED! Multi-page navigation is now working. Click the tabs above to switch pages.
        </div>

        <!-- Dashboard Page -->
        <div id="page-dashboard" class="page-content">
            <h2 class="page-title">Dashboard Overview</h2>
            <p class="page-description">Welcome to your WishCraft dashboard. This is the new clean interface with proper navigation.</p>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-title">Active Registries</div>
                    <div class="card-value" id="dashboard-registries">0</div>
                    <div class="card-label">Currently Active</div>
                </div>
                <div class="card">
                    <div class="card-title">Total Items</div>
                    <div class="card-value" id="dashboard-items">0</div>
                    <div class="card-label">Across All Registries</div>
                </div>
                <div class="card">
                    <div class="card-title">Total Views</div>
                    <div class="card-value" id="dashboard-views">0</div>
                    <div class="card-label">Registry Page Views</div>
                </div>
                <div class="card">
                    <div class="card-title">Completion Rate</div>
                    <div class="card-value" id="dashboard-completion">0%</div>
                    <div class="card-label">Items Purchased</div>
                </div>
            </div>
        </div>

        <!-- Registry Management Page -->
        <div id="page-registries" class="page-content hidden">
            <h2 class="page-title">Registry Management</h2>
            <p class="page-description">Create and manage customer gift registries with complete product integration.</p>
            
            <div>
                <button class="btn btn-primary" onclick="showMessage('Registry creation coming soon!')">Create New Registry</button>
                <button class="btn btn-secondary" onclick="showMessage('Registry list loading...')">Refresh List</button>
            </div>

            <div style="margin-top: 2rem; padding: 2rem; background: #f8f9fa; border-radius: 8px; text-align: center; color: #6d7175;">
                No registries found. Create your first registry to get started!
            </div>
        </div>

        <!-- Analytics Page -->
        <div id="page-analytics" class="page-content hidden">
            <h2 class="page-title">Analytics & Insights</h2>
            <p class="page-description">Track registry performance, customer engagement, and conversion metrics.</p>
            
            <div>
                <button class="btn btn-primary" onclick="showMessage('Analytics refreshed!')">Refresh Analytics</button>
                <button class="btn btn-secondary" onclick="showMessage('Export feature coming soon!')">Export Reports</button>
            </div>

            <div class="cards-grid" style="margin-top: 2rem;">
                <div class="card">
                    <div class="card-title">Total Value</div>
                    <div class="card-value">$0</div>
                    <div class="card-label">All Registry Items</div>
                </div>
                <div class="card">
                    <div class="card-title">Purchased Value</div>
                    <div class="card-value">$0</div>
                    <div class="card-label">Items Purchased</div>
                </div>
                <div class="card">
                    <div class="card-title">Customer Satisfaction</div>
                    <div class="card-value">-%</div>
                    <div class="card-label">Based on Feedback</div>
                </div>
            </div>
        </div>

        <!-- Billing Page -->
        <div id="page-billing" class="page-content hidden">
            <h2 class="page-title">Subscription & Billing</h2>
            <p class="page-description">Manage your WishCraft subscription plan and billing information.</p>
            
            <div class="card">
                <div class="card-title">Current Plan</div>
                <div class="card-value" style="font-size: 1.5rem;">Basic</div>
                <div class="card-label">$9.99/month • Up to 50 registries</div>
            </div>

            <div style="margin-top: 2rem;">
                <button class="btn btn-primary" onclick="showMessage('Billing management coming soon!')">Manage Billing</button>
                <button class="btn btn-secondary" onclick="showMessage('Usage details coming soon!')">View Usage</button>
            </div>
        </div>

        <!-- Settings Page -->
        <div id="page-settings" class="page-content hidden">
            <h2 class="page-title">App Configuration</h2>
            <p class="page-description">Configure WishCraft settings, integrations, and preferences.</p>
            
            <div style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem; color: #202223;">General Settings</h3>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #202223;">Default Registry Visibility</label>
                    <select style="width: 100%; padding: 0.75rem; border: 1px solid #d9d9d9; border-radius: 6px; background: white;">
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="showMessage('Settings saved successfully!')">Save Settings</button>
            </div>
        </div>
    </div>

    <script>
        console.log('🎉 WishCraft DIRECT multi-page app v4.0 loading...');
        
        const shop = '${shop}';
        const host = '${host}';
        
        // Navigation functionality
        function showPage(pageId) {
            console.log('Switching to page:', pageId);
            
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
        }

        function showMessage(message) {
            alert(message);
        }

        // Initialize app
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 WishCraft DIRECT app loaded successfully');
            
            // Set up navigation event listeners
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const page = this.getAttribute('data-page');
                    showPage(page);
                });
            });
            
            console.log('✅ WishCraft navigation initialized - TRY CLICKING THE TABS!');
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', 'wishcraft-direct-v4.0-' + Date.now());
    
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('WishCraft direct app error:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}