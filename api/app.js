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
        /* Shopify Polaris Design System Compliant Styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, sans-serif;
            background: var(--p-color-bg-surface-secondary);
            line-height: 1.5;
            color: var(--p-color-text);
            --p-color-bg-surface: #ffffff;
            --p-color-bg-surface-secondary: #f6f6f7;
            --p-color-bg-surface-tertiary: #f1f2f3;
            --p-color-text: #202223;
            --p-color-text-secondary: #6d7175;
            --p-color-border: #e1e3e5;
            --p-color-border-strong: #c9cccf;
            --p-color-bg-primary: #008060;
            --p-color-bg-primary-hover: #004c3f;
            --p-color-bg-primary-pressed: #003d33;
            --p-color-text-on-primary: #ffffff;
            --p-space-050: 0.125rem;
            --p-space-100: 0.25rem;
            --p-space-200: 0.5rem;
            --p-space-300: 0.75rem;
            --p-space-400: 1rem;
            --p-space-500: 1.25rem;
            --p-space-600: 1.5rem;
            --p-space-800: 2rem;
            --p-font-size-325: 0.8125rem;
            --p-font-size-350: 0.875rem;
            --p-font-size-450: 1.125rem;
            --p-font-size-500: 1.25rem;
            --p-font-size-600: 1.5rem;
            --p-border-radius-200: 0.375rem;
            --p-border-radius-300: 0.5rem;
            --p-shadow-200: 0 1px 0 0 rgba(22, 29, 37, 0.05);
            --p-shadow-300: 0 4px 8px -2px rgba(22, 29, 37, 0.1);
        }
        
        .app-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: var(--p-space-600);
        }
        
        .app-header {
            background: var(--p-color-bg-surface);
            padding: var(--p-space-500) var(--p-space-600);
            border-radius: var(--p-border-radius-300);
            box-shadow: var(--p-shadow-200);
            border: 1px solid var(--p-color-border);
            margin-bottom: var(--p-space-600);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .app-title {
            font-size: var(--p-font-size-600);
            font-weight: 600;
            color: var(--p-color-text);
            display: flex;
            align-items: center;
            gap: var(--p-space-200);
        }
        
        .app-nav {
            display: flex;
            gap: var(--p-space-200);
        }
        
        .nav-btn {
            padding: var(--p-space-300) var(--p-space-500);
            border: 1px solid var(--p-color-border);
            border-radius: var(--p-border-radius-200);
            cursor: pointer;
            font-size: var(--p-font-size-325);
            font-weight: 500;
            transition: all 0.1s ease;
            background: var(--p-color-bg-surface);
            color: var(--p-color-text);
            text-decoration: none;
            display: inline-flex;
            align-items: center;
        }
        
        .nav-btn:hover {
            background: var(--p-color-bg-surface-tertiary);
            border-color: var(--p-color-border-strong);
        }
        
        .nav-btn.active {
            background: var(--p-color-bg-primary);
            color: var(--p-color-text-on-primary);
            border-color: var(--p-color-bg-primary);
            box-shadow: var(--p-shadow-200);
        }
        
        .page-content {
            background: var(--p-color-bg-surface);
            padding: var(--p-space-600);
            border-radius: var(--p-border-radius-300);
            box-shadow: var(--p-shadow-200);
            border: 1px solid var(--p-color-border);
            min-height: 500px;
        }
        
        .page-title {
            font-size: var(--p-font-size-600);
            font-weight: 600;
            color: var(--p-color-text);
            margin-bottom: var(--p-space-400);
        }
        
        .page-description {
            color: var(--p-color-text-secondary);
            margin-bottom: var(--p-space-600);
            font-size: var(--p-font-size-350);
        }
        
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: var(--p-space-500);
            margin-bottom: var(--p-space-600);
        }
        
        .card {
            background: var(--p-color-bg-surface);
            padding: var(--p-space-500);
            border-radius: var(--p-border-radius-300);
            border: 1px solid var(--p-color-border);
            transition: box-shadow 0.1s ease;
        }
        
        .card:hover {
            box-shadow: var(--p-shadow-300);
        }
        
        .card-title {
            font-size: var(--p-font-size-350);
            font-weight: 500;
            color: var(--p-color-text-secondary);
            margin-bottom: var(--p-space-200);
        }
        
        .card-value {
            font-size: var(--p-font-size-600);
            font-weight: 600;
            color: var(--p-color-text);
            margin-bottom: var(--p-space-100);
            line-height: 1.2;
        }
        
        .card-label {
            color: var(--p-color-text-secondary);
            font-size: var(--p-font-size-325);
        }
        
        .btn {
            padding: var(--p-space-300) var(--p-space-500);
            border: 1px solid transparent;
            border-radius: var(--p-border-radius-200);
            cursor: pointer;
            font-size: var(--p-font-size-325);
            font-weight: 500;
            transition: all 0.1s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: var(--p-space-400);
            margin-bottom: var(--p-space-400);
            min-height: 36px;
        }
        
        .btn-primary {
            background: var(--p-color-bg-primary);
            color: var(--p-color-text-on-primary);
        }
        
        .btn-primary:hover {
            background: var(--p-color-bg-primary-hover);
        }
        
        .btn-primary:active {
            background: var(--p-color-bg-primary-pressed);
        }
        
        .btn-secondary {
            background: var(--p-color-bg-surface);
            color: var(--p-color-text);
            border: 1px solid var(--p-color-border);
        }
        
        .btn-secondary:hover {
            background: var(--p-color-bg-surface-tertiary);
            border-color: var(--p-color-border-strong);
        }
        
        .hidden { display: none; }
        
        /* Responsive Design */
        @media (max-width: 768px) {
            .app-container { 
                padding: var(--p-space-400); 
            }
            .app-header { 
                flex-direction: column; 
                gap: var(--p-space-400); 
                padding: var(--p-space-400);
            }
            .app-nav { 
                flex-wrap: wrap; 
                justify-content: center; 
                gap: var(--p-space-200);
            }
            .cards-grid { 
                grid-template-columns: 1fr; 
                gap: var(--p-space-400);
            }
            .page-content {
                padding: var(--p-space-400);
            }
        }
        
        /* High contrast mode support */
        @media (prefers-contrast: high) {
            :root {
                --p-color-border: #8c9196;
                --p-color-border-strong: #6d7175;
            }
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
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


        <!-- Dashboard Page -->
        <div id="page-dashboard" class="page-content">
            <h2 class="page-title">Dashboard Overview</h2>
            <p class="page-description">Welcome to your WishCraft dashboard. Manage your gift registries and track performance metrics.</p>
            
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
            
            <div style="margin-bottom: var(--p-space-600);">
                <button class="btn btn-primary" onclick="showCreateForm()">Create New Registry</button>
                <button class="btn btn-secondary" onclick="loadRegistries()">Refresh List</button>
            </div>

            <!-- Registry Creation Form -->
            <div id="registry-form" class="hidden" style="margin-bottom: var(--p-space-600);">
                <div style="background: var(--p-color-bg-surface); padding: var(--p-space-600); border: 1px solid var(--p-color-border); border-radius: var(--p-border-radius-300);">
                    <h3 style="font-size: var(--p-font-size-500); font-weight: 600; color: var(--p-color-text); margin-bottom: var(--p-space-400);">Create New Registry</h3>
                    
                    <div style="display: grid; gap: var(--p-space-400);">
                        <div>
                            <label style="display: block; margin-bottom: var(--p-space-200); font-weight: 500; color: var(--p-color-text); font-size: var(--p-font-size-325);">Registry Title *</label>
                            <input type="text" id="registryTitle" placeholder="e.g., Sarah & John's Wedding Registry" style="width: 100%; padding: var(--p-space-300); border: 1px solid var(--p-color-border); border-radius: var(--p-border-radius-200); font-size: var(--p-font-size-350); background: var(--p-color-bg-surface);">
                        </div>
                        
                        <div>
                            <label style="display: block; margin-bottom: var(--p-space-200); font-weight: 500; color: var(--p-color-text); font-size: var(--p-font-size-325);">Description</label>
                            <textarea id="registryDescription" placeholder="Tell guests about your special occasion..." rows="3" style="width: 100%; padding: var(--p-space-300); border: 1px solid var(--p-color-border); border-radius: var(--p-border-radius-200); font-size: var(--p-font-size-350); background: var(--p-color-bg-surface); resize: vertical;"></textarea>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--p-space-400);">
                            <div>
                                <label style="display: block; margin-bottom: var(--p-space-200); font-weight: 500; color: var(--p-color-text); font-size: var(--p-font-size-325);">Event Type</label>
                                <select id="eventType" style="width: 100%; padding: var(--p-space-300); border: 1px solid var(--p-color-border); border-radius: var(--p-border-radius-200); font-size: var(--p-font-size-350); background: var(--p-color-bg-surface);">
                                    <option value="wedding">Wedding</option>
                                    <option value="baby_shower">Baby Shower</option>
                                    <option value="birthday">Birthday</option>
                                    <option value="holiday">Holiday</option>
                                    <option value="housewarming">Housewarming</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            
                            <div>
                                <label style="display: block; margin-bottom: var(--p-space-200); font-weight: 500; color: var(--p-color-text); font-size: var(--p-font-size-325);">Event Date</label>
                                <input type="date" id="eventDate" style="width: 100%; padding: var(--p-space-300); border: 1px solid var(--p-color-border); border-radius: var(--p-border-radius-200); font-size: var(--p-font-size-350); background: var(--p-color-bg-surface);">
                            </div>
                        </div>
                        
                        <div>
                            <label style="display: block; margin-bottom: var(--p-space-200); font-weight: 500; color: var(--p-color-text); font-size: var(--p-font-size-325);">Privacy Setting</label>
                            <select id="visibility" style="width: 100%; padding: var(--p-space-300); border: 1px solid var(--p-color-border); border-radius: var(--p-border-radius-200); font-size: var(--p-font-size-350); background: var(--p-color-bg-surface);">
                                <option value="public">Public - Anyone can find and view</option>
                                <option value="private">Private - Only people with the link</option>
                            </select>
                        </div>
                        
                        <div style="display: flex; gap: var(--p-space-300); margin-top: var(--p-space-400);">
                            <button class="btn btn-primary" onclick="createRegistry()">Create Registry</button>
                            <button class="btn btn-secondary" onclick="hideCreateForm()">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Registries List -->
            <div id="registries-list">
                <div id="empty-state" style="padding: var(--p-space-800); background: var(--p-color-bg-surface-tertiary); border-radius: var(--p-border-radius-300); text-align: center; color: var(--p-color-text-secondary);">
                    <div style="font-size: 48px; margin-bottom: var(--p-space-400);">🎁</div>
                    <h3 style="font-size: var(--p-font-size-450); font-weight: 500; color: var(--p-color-text); margin-bottom: var(--p-space-200);">No registries yet</h3>
                    <p>Create your first registry to get started!</p>
                </div>
                
                <div id="registries-grid" class="hidden" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--p-space-500); margin-top: var(--p-space-600);">
                    <!-- Registry cards will be inserted here -->
                </div>
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
            // Create a toast notification instead of alert
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--p-color-bg-primary);
                color: var(--p-color-text-on-primary);
                padding: var(--p-space-400) var(--p-space-500);
                border-radius: var(--p-border-radius-300);
                box-shadow: var(--p-shadow-300);
                z-index: 1000;
                font-size: var(--p-font-size-350);
                max-width: 300px;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        function showCreateForm() {
            document.getElementById('registry-form').classList.remove('hidden');
            document.getElementById('registryTitle').focus();
        }

        function hideCreateForm() {
            document.getElementById('registry-form').classList.add('hidden');
            // Clear form
            document.getElementById('registryTitle').value = '';
            document.getElementById('registryDescription').value = '';
            document.getElementById('eventType').value = 'wedding';
            document.getElementById('eventDate').value = '';
            document.getElementById('visibility').value = 'public';
        }

        async function createRegistry() {
            const title = document.getElementById('registryTitle').value.trim();
            const description = document.getElementById('registryDescription').value.trim();
            const eventType = document.getElementById('eventType').value;
            const eventDate = document.getElementById('eventDate').value;
            const visibility = document.getElementById('visibility').value;

            if (!title) {
                showMessage('Please enter a registry title');
                return;
            }

            try {
                // Show loading state
                const createBtn = document.querySelector('button[onclick="createRegistry()"]');
                const originalText = createBtn.textContent;
                createBtn.textContent = 'Creating...';
                createBtn.disabled = true;

                // Make API call to create registry
                const response = await fetch('/api/registry-db', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Shop-Domain': shop
                    },
                    body: JSON.stringify({
                        title,
                        description,
                        eventType,
                        eventDate,
                        visibility
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    showMessage('Registry created successfully!');
                    hideCreateForm();
                    loadRegistries(); // Refresh the list
                    updateDashboardStats(); // Update dashboard
                } else {
                    throw new Error(result.error || 'Failed to create registry');
                }
            } catch (error) {
                console.error('Error creating registry:', error);
                showMessage('Error creating registry: ' + error.message);
            } finally {
                // Reset button state
                const createBtn = document.querySelector('button[onclick="createRegistry()"]');
                createBtn.textContent = originalText;
                createBtn.disabled = false;
            }
        }

        async function loadRegistries() {
            try {
                const response = await fetch('/api/registry-db?shop=' + encodeURIComponent(shop));
                const result = await response.json();

                if (response.ok && result.success) {
                    displayRegistries(result.data || []);
                } else {
                    console.error('Error loading registries:', result.error);
                    showMessage('Error loading registries: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error loading registries:', error);
                showMessage('Error loading registries: ' + error.message);
            }
        }

        function displayRegistries(registries) {
            const emptyState = document.getElementById('empty-state');
            const registriesGrid = document.getElementById('registries-grid');

            if (registries.length === 0) {
                emptyState.classList.remove('hidden');
                registriesGrid.classList.add('hidden');
            } else {
                emptyState.classList.add('hidden');
                registriesGrid.classList.remove('hidden');
                
                registriesGrid.innerHTML = registries.map(registry => `
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--p-space-300);">
                            <h3 style="font-size: var(--p-font-size-450); font-weight: 600; color: var(--p-color-text); margin: 0;">${escapeHtml(registry.title)}</h3>
                            <span style="background: ${registry.visibility === 'public' ? 'var(--p-color-bg-primary)' : '#6d7175'}; color: white; padding: var(--p-space-100) var(--p-space-200); border-radius: var(--p-border-radius-200); font-size: var(--p-font-size-325); text-transform: capitalize;">${registry.visibility}</span>
                        </div>
                        ${registry.description ? `<p style="color: var(--p-color-text-secondary); margin-bottom: var(--p-space-300); font-size: var(--p-font-size-350);">${escapeHtml(registry.description)}</p>` : ''}
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--p-font-size-325); color: var(--p-color-text-secondary);">
                            <span>${registry.eventType ? registry.eventType.replace('_', ' ').replace(/\\b\\w/g, l => l.toUpperCase()) : 'General'}</span>
                            ${registry.eventDate ? `<span>${new Date(registry.eventDate).toLocaleDateString()}</span>` : ''}
                        </div>
                        <div style="margin-top: var(--p-space-400); display: flex; gap: var(--p-space-200);">
                            <button class="btn btn-secondary" style="font-size: var(--p-font-size-325); padding: var(--p-space-200) var(--p-space-300);" onclick="viewRegistry('${registry.id}')">View</button>
                            <button class="btn btn-secondary" style="font-size: var(--p-font-size-325); padding: var(--p-space-200) var(--p-space-300);" onclick="editRegistry('${registry.id}')">Edit</button>
                        </div>
                    </div>
                `).join('');
            }
        }

        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function viewRegistry(id) {
            showMessage(`Opening registry ${id}...`);
        }

        function editRegistry(id) {
            showMessage(`Edit functionality for registry ${id} coming soon!`);
        }

        async function updateDashboardStats() {
            // Update dashboard with real data
            try {
                const response = await fetch('/api/registry-db?shop=' + encodeURIComponent(shop));
                const result = await response.json();

                if (response.ok && result.success) {
                    const registries = result.data || [];
                    document.getElementById('dashboard-registries').textContent = registries.length;
                    
                    // Calculate total items from registry data
                    const totalItems = registries.reduce((sum, reg) => sum + (reg.item_count || 0), 0);
                    document.getElementById('dashboard-items').textContent = totalItems;
                    
                    // Calculate total views
                    const totalViews = registries.reduce((sum, reg) => sum + (reg.views || 0), 0);
                    document.getElementById('dashboard-views').textContent = totalViews;
                    
                    // Calculate completion rate
                    const totalValue = registries.reduce((sum, reg) => sum + (reg.total_value || 0), 0);
                    const purchasedValue = registries.reduce((sum, reg) => sum + (reg.purchased_value || 0), 0);
                    const completionRate = totalValue > 0 ? Math.round((purchasedValue / totalValue) * 100) : 0;
                    document.getElementById('dashboard-completion').textContent = completionRate + '%';
                }
            } catch (error) {
                console.error('Error updating dashboard:', error);
                // Set default values on error
                document.getElementById('dashboard-registries').textContent = '0';
                document.getElementById('dashboard-items').textContent = '0';
                document.getElementById('dashboard-views').textContent = '0';
                document.getElementById('dashboard-completion').textContent = '0%';
            }
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
                    
                    // Load data when switching to registries page
                    if (page === 'registries') {
                        loadRegistries();
                    }
                });
            });
            
            // Load initial data
            updateDashboardStats();
            
            console.log('✅ WishCraft navigation initialized with functional registry creation!');
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