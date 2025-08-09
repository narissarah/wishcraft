// WishCraft - App Bridge Embedded Application
// Compliant with Shopify Built for Shopify requirements

export default function handler(req, res) {
  try {
    console.log('App Bridge Embedded App:', req.method, req.url);
    
    const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'demo-shop.myshopify.com';
    const host = req.query.host || '';
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>🎁 WishCraft - Gift Registry Management</title>
    
    <!-- Shopify App Bridge 2025 -->
    <script src="https://unpkg.com/@shopify/app-bridge@4/umd/index.js"></script>
    
    <!-- Polaris Web Components 2025 -->
    <script type="module" src="https://cdn.shopify.com/polaris-web-components/latest/polaris-web-components.js"></script>
    
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, sans-serif;
            background: var(--p-color-bg-surface);
            color: var(--p-color-text);
            line-height: 1.5;
            padding: var(--p-space-500, 1.25rem);
        }
        
        /* App Bridge container */
        .app-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        /* Loading state */
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            color: var(--p-color-text-secondary);
        }
        
        /* Hidden class */
        .hidden {
            display: none !important;
        }
        
        /* Success/Error states */
        .toast {
            position: fixed;
            top: var(--p-space-400, 1rem);
            right: var(--p-space-400, 1rem);
            background: var(--p-color-bg-success);
            color: var(--p-color-text-on-success);
            padding: var(--p-space-400, 1rem);
            border-radius: var(--p-border-radius-200, 0.375rem);
            box-shadow: var(--p-shadow-300);
            z-index: 1000;
            max-width: 400px;
        }
        
        .toast.error {
            background: var(--p-color-bg-critical);
            color: var(--p-color-text-on-critical);
        }
        
        /* Custom spacing for embedded context */
        .embedded-content {
            padding: 0;
        }
        
        @media (max-width: 768px) {
            body {
                padding: var(--p-space-300, 0.75rem);
            }
        }
    </style>
</head>
<body>
    <div class="app-container">
        <!-- Loading State -->
        <div id="loading" class="loading">
            <polaris-spinner size="large"></polaris-spinner>
            <span style="margin-left: var(--p-space-300, 0.75rem);">Loading WishCraft...</span>
        </div>
        
        <!-- Main App Content -->
        <div id="app-content" class="embedded-content hidden">
            
            <!-- Dashboard Section -->
            <div id="dashboard-section">
                <polaris-layout>
                    <polaris-layout-section>
                        <polaris-card>
                            <div style="padding: var(--p-space-500, 1.25rem);">
                                <polaris-heading>Registry Dashboard</polaris-heading>
                                <p style="margin-top: var(--p-space-300, 0.75rem); color: var(--p-color-text-secondary);">
                                    Manage your gift registries and track performance metrics.
                                </p>
                            </div>
                        </polaris-card>
                    </polaris-layout-section>
                    
                    <polaris-layout-section secondary>
                        <polaris-card>
                            <div style="padding: var(--p-space-500, 1.25rem);">
                                <polaris-heading element="h3">Quick Actions</polaris-heading>
                                <div style="margin-top: var(--p-space-400, 1rem);">
                                    <polaris-button primary onclick="showCreateRegistryModal()">
                                        Create New Registry
                                    </polaris-button>
                                </div>
                            </div>
                        </polaris-card>
                    </polaris-layout-section>
                </polaris-layout>
                
                <!-- Statistics Cards -->
                <div style="margin-top: var(--p-space-600, 1.5rem);">
                    <polaris-layout>
                        <polaris-layout-section one-quarter>
                            <polaris-card>
                                <div style="padding: var(--p-space-500, 1.25rem); text-align: center;">
                                    <polaris-heading element="h3" id="stat-registries">0</polaris-heading>
                                    <p style="color: var(--p-color-text-secondary);">Active Registries</p>
                                </div>
                            </polaris-card>
                        </polaris-layout-section>
                        
                        <polaris-layout-section one-quarter>
                            <polaris-card>
                                <div style="padding: var(--p-space-500, 1.25rem); text-align: center;">
                                    <polaris-heading element="h3" id="stat-items">0</polaris-heading>
                                    <p style="color: var(--p-color-text-secondary);">Total Items</p>
                                </div>
                            </polaris-card>
                        </polaris-layout-section>
                        
                        <polaris-layout-section one-quarter>
                            <polaris-card>
                                <div style="padding: var(--p-space-500, 1.25rem); text-align: center;">
                                    <polaris-heading element="h3" id="stat-views">0</polaris-heading>
                                    <p style="color: var(--p-color-text-secondary);">Registry Views</p>
                                </div>
                            </polaris-card>
                        </polaris-layout-section>
                        
                        <polaris-layout-section one-quarter>
                            <polaris-card>
                                <div style="padding: var(--p-space-500, 1.25rem); text-align: center;">
                                    <polaris-heading element="h3" id="stat-completion">0%</polaris-heading>
                                    <p style="color: var(--p-color-text-secondary);">Completion Rate</p>
                                </div>
                            </polaris-card>
                        </polaris-layout-section>
                    </polaris-layout>
                </div>
            </div>
            
            <!-- Registries List Section -->
            <div id="registries-section" style="margin-top: var(--p-space-800, 2rem);">
                <polaris-card>
                    <div style="padding: var(--p-space-500, 1.25rem);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--p-space-500, 1.25rem);">
                            <polaris-heading>Recent Registries</polaris-heading>
                            <polaris-button onclick="loadRegistries()">Refresh</polaris-button>
                        </div>
                        
                        <div id="registries-list">
                            <!-- Registry items will be populated here -->
                        </div>
                        
                        <div id="empty-state" class="hidden" style="text-align: center; padding: var(--p-space-800, 2rem);">
                            <div style="font-size: 48px; margin-bottom: var(--p-space-400, 1rem);">🎁</div>
                            <polaris-heading element="h3">No registries yet</polaris-heading>
                            <p style="margin-top: var(--p-space-300, 0.75rem); color: var(--p-color-text-secondary);">
                                Create your first registry to get started!
                            </p>
                            <div style="margin-top: var(--p-space-500, 1.25rem);">
                                <polaris-button primary onclick="showCreateRegistryModal()">
                                    Create Registry
                                </polaris-button>
                            </div>
                        </div>
                    </div>
                </polaris-card>
            </div>
        </div>
    </div>

    <script>
        console.log('🎁 WishCraft App Bridge Embedded App initializing...');
        
        // App Bridge configuration
        const shop = '${shop}';
        const host = '${host}';
        
        // Initialize App Bridge
        const app = window.AppBridge.createApp({
            apiKey: '${process.env.SHOPIFY_API_KEY || 'your-api-key'}',
            host: host,
            forceRedirect: true
        });
        
        // App Bridge components
        const TitleBar = window.AppBridge.actions.TitleBar;
        const NavigationMenu = window.AppBridge.actions.NavigationMenu;
        const Modal = window.AppBridge.actions.Modal;
        const Toast = window.AppBridge.actions.Toast;
        const ContextualSaveBar = window.AppBridge.actions.ContextualSaveBar;
        
        // Initialize Title Bar
        const titleBar = TitleBar.create(app, {
            title: 'WishCraft Registry Management',
            buttons: {
                primary: {
                    label: 'Create Registry',
                    message: 'CREATE_REGISTRY'
                }
            }
        });
        
        // Initialize Navigation Menu
        const navigationMenu = NavigationMenu.create(app, {
            items: [
                {
                    id: 'dashboard',
                    label: 'Dashboard',
                    message: 'NAVIGATE_DASHBOARD'
                },
                {
                    id: 'registries',
                    label: 'Registries',
                    message: 'NAVIGATE_REGISTRIES'
                },
                {
                    id: 'analytics',
                    label: 'Analytics', 
                    message: 'NAVIGATE_ANALYTICS'
                },
                {
                    id: 'settings',
                    label: 'Settings',
                    message: 'NAVIGATE_SETTINGS'
                }
            ]
        });
        
        // Event listeners for App Bridge actions
        app.subscribe(TitleBar.ActionType.BUTTON_CLICK, (data) => {
            if (data.message === 'CREATE_REGISTRY') {
                showCreateRegistryModal();
            }
        });
        
        app.subscribe(NavigationMenu.ActionType.SELECT, (data) => {
            console.log('Navigation selected:', data.message);
            handleNavigation(data.message);
        });
        
        // Navigation handler
        function handleNavigation(message) {
            switch(message) {
                case 'NAVIGATE_DASHBOARD':
                    showDashboard();
                    break;
                case 'NAVIGATE_REGISTRIES':
                    showRegistries();
                    break;
                case 'NAVIGATE_ANALYTICS':
                    showToast('Analytics coming soon!', false);
                    break;
                case 'NAVIGATE_SETTINGS':
                    showToast('Settings coming soon!', false);
                    break;
            }
        }
        
        // Show different sections (simplified for embedded context)
        function showDashboard() {
            updateDashboardStats();
            showToast('Dashboard refreshed', false);
        }
        
        function showRegistries() {
            loadRegistries();
            showToast('Registries loaded', false);
        }
        
        // Toast notifications using App Bridge
        function showToast(message, isError = false) {
            const toast = Toast.create(app, {
                message: message,
                duration: 3000,
                isError: isError
            });
            toast.dispatch(Toast.Action.SHOW);
        }
        
        // Create Registry Modal
        function showCreateRegistryModal() {
            const modal = Modal.create(app, {
                title: 'Create New Registry',
                message: 'CREATE_REGISTRY_MODAL',
                size: 'Large'
            });
            
            modal.dispatch(Modal.Action.OPEN);
            showToast('Registry creation coming soon!', false);
        }
        
        // Load registries from API
        async function loadRegistries() {
            try {
                const response = await fetch('/api/registry-db?shop=' + encodeURIComponent(shop));
                const result = await response.json();
                
                if (response.ok && result.success) {
                    displayRegistries(result.data || []);
                } else {
                    showToast('Error loading registries: ' + (result.error || 'Unknown error'), true);
                }
            } catch (error) {
                console.error('Error loading registries:', error);
                showToast('Error loading registries: ' + error.message, true);
            }
        }
        
        // Display registries in the UI
        function displayRegistries(registries) {
            const registriesList = document.getElementById('registries-list');
            const emptyState = document.getElementById('empty-state');
            
            if (registries.length === 0) {
                registriesList.innerHTML = '';
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                registriesList.innerHTML = registries.map(registry => \`
                    <div style="border-bottom: 1px solid var(--p-color-border); padding: var(--p-space-400, 1rem) 0;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h4 style="font-weight: 600; margin-bottom: var(--p-space-200, 0.5rem);">\${escapeHtml(registry.title)}</h4>
                                \${registry.description ? \`<p style="color: var(--p-color-text-secondary); margin-bottom: var(--p-space-200, 0.5rem);">\${escapeHtml(registry.description)}</p>\` : ''}
                                <div style="display: flex; gap: var(--p-space-400, 1rem); font-size: 0.875rem; color: var(--p-color-text-secondary);">
                                    <span>Type: \${registry.eventType || 'General'}</span>
                                    <span>Visibility: \${registry.visibility || 'Public'}</span>
                                    \${registry.eventDate ? \`<span>Date: \${new Date(registry.eventDate).toLocaleDateString()}</span>\` : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: var(--p-space-200, 0.5rem);">
                                <polaris-button size="small" onclick="viewRegistry('\${registry.id}')">View</polaris-button>
                                <polaris-button size="small" onclick="editRegistry('\${registry.id}')">Edit</polaris-button>
                            </div>
                        </div>
                    </div>
                \`).join('');
            }
        }
        
        // Update dashboard statistics
        async function updateDashboardStats() {
            try {
                const response = await fetch('/api/registry-db?shop=' + encodeURIComponent(shop));
                const result = await response.json();
                
                if (response.ok && result.success) {
                    const registries = result.data || [];
                    document.getElementById('stat-registries').textContent = registries.length;
                    
                    const totalItems = registries.reduce((sum, reg) => sum + (reg.item_count || 0), 0);
                    document.getElementById('stat-items').textContent = totalItems;
                    
                    const totalViews = registries.reduce((sum, reg) => sum + (reg.views || 0), 0);
                    document.getElementById('stat-views').textContent = totalViews;
                    
                    const totalValue = registries.reduce((sum, reg) => sum + (reg.total_value || 0), 0);
                    const purchasedValue = registries.reduce((sum, reg) => sum + (reg.purchased_value || 0), 0);
                    const completionRate = totalValue > 0 ? Math.round((purchasedValue / totalValue) * 100) : 0;
                    document.getElementById('stat-completion').textContent = completionRate + '%';
                }
            } catch (error) {
                console.error('Error updating dashboard:', error);
            }
        }
        
        // Utility functions
        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
        
        function viewRegistry(id) {
            showToast(\`Opening registry \${id}...\`, false);
        }
        
        function editRegistry(id) {
            showToast(\`Edit functionality for registry \${id} coming soon!\`, false);
        }
        
        // Initialize the app
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 WishCraft App Bridge embedded app loaded');
            
            // Hide loading, show content
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            
            // Load initial data
            updateDashboardStats();
            loadRegistries();
            
            console.log('✅ WishCraft embedded app initialized successfully');
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('App Bridge embedded app error:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}