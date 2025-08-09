// Registry Creation Modal - Polaris Component Implementation
export default function handler(req, res) {
    try {
        console.log('Registry Create Modal:', req.method, req.url);
        
        const shop = req.query.shop || 'demo-shop.myshopify.com';
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Create Registry - WishCraft</title>
    
    <!-- Shopify App Bridge -->
    <script src="https://unpkg.com/@shopify/app-bridge@4/umd/index.js"></script>
    
    <!-- Polaris Web Components -->
    <script type="module" src="https://cdn.shopify.com/polaris-web-components/latest/polaris-web-components.js"></script>
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, sans-serif;
            padding: var(--p-space-500, 1.25rem);
            background: var(--p-color-bg-surface);
        }
        
        .form-container {
            max-width: 600px;
            margin: 0 auto;
        }
        
        .form-section {
            margin-bottom: var(--p-space-600, 1.5rem);
        }
        
        .form-actions {
            display: flex;
            gap: var(--p-space-300, 0.75rem);
            justify-content: flex-end;
            margin-top: var(--p-space-600, 1.5rem);
            padding-top: var(--p-space-500, 1.25rem);
            border-top: 1px solid var(--p-color-border);
        }
        
        .loading {
            opacity: 0.6;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="form-container">
        <polaris-card>
            <div style="padding: var(--p-space-600, 1.5rem);">
                <polaris-heading>Create New Registry</polaris-heading>
                <p style="margin-top: var(--p-space-300, 0.75rem); color: var(--p-color-text-secondary);">
                    Set up a new gift registry for your customers.
                </p>
                
                <form id="registry-form" style="margin-top: var(--p-space-600, 1.5rem);">
                    <div class="form-section">
                        <polaris-form-layout>
                            <polaris-form-layout-group>
                                <polaris-text-field
                                    id="registryTitle"
                                    label="Registry Title"
                                    placeholder="e.g., Sarah & John's Wedding Registry"
                                    required
                                    help-text="Give your registry a memorable name"
                                ></polaris-text-field>
                            </polaris-form-layout-group>
                            
                            <polaris-form-layout-group>
                                <polaris-text-field
                                    id="registryDescription"
                                    label="Description"
                                    placeholder="Tell guests about your special occasion..."
                                    multiline="4"
                                    help-text="Optional description for your registry"
                                ></polaris-text-field>
                            </polaris-form-layout-group>
                            
                            <polaris-form-layout-group condensed>
                                <polaris-select
                                    id="eventType"
                                    label="Event Type"
                                    options='[
                                        {"label": "Wedding", "value": "wedding"},
                                        {"label": "Baby Shower", "value": "baby_shower"}, 
                                        {"label": "Birthday", "value": "birthday"},
                                        {"label": "Holiday", "value": "holiday"},
                                        {"label": "Housewarming", "value": "housewarming"},
                                        {"label": "Other", "value": "other"}
                                    ]'
                                    value="wedding"
                                ></polaris-select>
                                
                                <polaris-text-field
                                    id="eventDate"
                                    label="Event Date"
                                    type="date"
                                    help-text="When is your special event?"
                                ></polaris-text-field>
                            </polaris-form-layout-group>
                            
                            <polaris-form-layout-group>
                                <polaris-select
                                    id="visibility"
                                    label="Privacy Setting"
                                    options='[
                                        {"label": "Public - Anyone can find and view", "value": "public"},
                                        {"label": "Private - Only people with the link", "value": "private"}
                                    ]'
                                    value="public"
                                    help-text="Choose who can see your registry"
                                ></polaris-select>
                            </polaris-form-layout-group>
                        </polaris-form-layout>
                    </div>
                    
                    <div class="form-actions">
                        <polaris-button onclick="closeModal()">Cancel</polaris-button>
                        <polaris-button primary onclick="createRegistry()">Create Registry</polaris-button>
                    </div>
                </form>
            </div>
        </polaris-card>
    </div>

    <script>
        console.log('Registry Create Modal loaded');
        
        const shop = '${shop}';
        
        // Initialize App Bridge if in modal context
        let app;
        if (window.parent !== window && window.AppBridge) {
            try {
                app = window.parent.AppBridge?.createApp({
                    apiKey: '${process.env.SHOPIFY_API_KEY || 'your-api-key'}',
                    host: new URLSearchParams(window.location.search).get('host') || ''
                });
            } catch (error) {
                console.log('App Bridge not available in modal context');
            }
        }
        
        // Close modal function
        function closeModal() {
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*');
            } else {
                window.history.back();
            }
        }
        
        // Create registry function
        async function createRegistry() {
            const form = document.getElementById('registry-form');
            const titleField = document.getElementById('registryTitle');
            const descriptionField = document.getElementById('registryDescription');
            const eventTypeField = document.getElementById('eventType');
            const eventDateField = document.getElementById('eventDate');
            const visibilityField = document.getElementById('visibility');
            
            // Get form values
            const title = titleField.value?.trim();
            const description = descriptionField.value?.trim();
            const eventType = eventTypeField.value;
            const eventDate = eventDateField.value;
            const visibility = visibilityField.value;
            
            // Validate required fields
            if (!title) {
                showError('Please enter a registry title');
                titleField.focus();
                return;
            }
            
            try {
                // Show loading state
                form.classList.add('loading');
                const createButton = form.querySelector('polaris-button[primary]');
                createButton.setAttribute('loading', 'true');
                
                // Make API call
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
                    showSuccess('Registry created successfully!');
                    
                    // Send success message to parent
                    if (window.parent !== window) {
                        window.parent.postMessage({ 
                            type: 'REGISTRY_CREATED', 
                            data: result.data 
                        }, '*');
                    }
                    
                    // Close modal after short delay
                    setTimeout(() => {
                        closeModal();
                    }, 1500);
                    
                } else {
                    throw new Error(result.error || 'Failed to create registry');
                }
                
            } catch (error) {
                console.error('Error creating registry:', error);
                showError('Error creating registry: ' + error.message);
            } finally {
                // Reset loading state
                form.classList.remove('loading');
                const createButton = form.querySelector('polaris-button[primary]');
                createButton.removeAttribute('loading');
            }
        }
        
        // Show success message
        function showSuccess(message) {
            const toast = document.createElement('div');
            toast.style.cssText = \`
                position: fixed;
                top: var(--p-space-400, 1rem);
                right: var(--p-space-400, 1rem);
                background: var(--p-color-bg-success);
                color: var(--p-color-text-on-success);
                padding: var(--p-space-400, 1rem);
                border-radius: var(--p-border-radius-300, 0.5rem);
                box-shadow: var(--p-shadow-300);
                z-index: 1000;
                font-size: var(--p-font-size-350, 0.875rem);
                max-width: 300px;
            \`;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
        
        // Show error message
        function showError(message) {
            const toast = document.createElement('div');
            toast.style.cssText = \`
                position: fixed;
                top: var(--p-space-400, 1rem);
                right: var(--p-space-400, 1rem);
                background: var(--p-color-bg-critical);
                color: var(--p-color-text-on-critical);
                padding: var(--p-space-400, 1rem);
                border-radius: var(--p-border-radius-300, 0.5rem);
                box-shadow: var(--p-shadow-300);
                z-index: 1000;
                font-size: var(--p-font-size-350, 0.875rem);
                max-width: 300px;
            \`;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 5000);
        }
        
        // Handle form submission on Enter key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                createRegistry();
            }
        });
        
        console.log('Registry Create Modal initialized');
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        return res.status(200).send(html);
        
    } catch (error) {
        console.error('Registry Create Modal error:', error);
        return res.status(500).json({
            error: 'Server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}