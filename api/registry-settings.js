// Registry Settings with Contextual Save Bar
// Demonstrates proper App Bridge save bar implementation

export default function handler(req, res) {
    try {
        console.log('Registry Settings:', req.method, req.url);
        
        const shop = req.query.shop || 'demo-shop.myshopify.com';
        const registryId = req.query.id || 'demo-registry';
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Registry Settings - WishCraft</title>
    
    <!-- Shopify App Bridge -->
    <script src="https://unpkg.com/@shopify/app-bridge@4/umd/index.js"></script>
    
    <!-- Polaris Web Components -->
    <script type="module" src="https://cdn.shopify.com/polaris-web-components/latest/polaris-web-components.js"></script>
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, sans-serif;
            padding: var(--p-space-500, 1.25rem);
            background: var(--p-color-bg-surface);
            margin: 0;
        }
        
        .settings-container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .form-section {
            margin-bottom: var(--p-space-600, 1.5rem);
        }
        
        .unsaved-indicator {
            color: var(--p-color-text-warning);
            font-size: var(--p-font-size-325, 0.8125rem);
            display: none;
        }
        
        .form-field {
            margin-bottom: var(--p-space-500, 1.25rem);
        }
        
        .loading {
            opacity: 0.6;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="settings-container">
        <polaris-layout>
            <polaris-layout-section>
                <polaris-card>
                    <div style="padding: var(--p-space-600, 1.5rem);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--p-space-500, 1.25rem);">
                            <polaris-heading>Registry Settings</polaris-heading>
                            <span class="unsaved-indicator" id="unsavedIndicator">Unsaved changes</span>
                        </div>
                        
                        <form id="settingsForm">
                            <polaris-form-layout>
                                <polaris-form-layout-group>
                                    <div class="form-field">
                                        <polaris-text-field
                                            id="registryTitle"
                                            label="Registry Title"
                                            value="Sample Wedding Registry"
                                            help-text="The name of your registry as it appears to customers"
                                            onchange="handleFormChange()"
                                        ></polaris-text-field>
                                    </div>
                                </polaris-form-layout-group>
                                
                                <polaris-form-layout-group>
                                    <div class="form-field">
                                        <polaris-text-field
                                            id="registryDescription"
                                            label="Description"
                                            value="Help us celebrate our special day with these carefully chosen items."
                                            multiline="3"
                                            help-text="Describe your registry to help guests understand your preferences"
                                            onchange="handleFormChange()"
                                        ></polaris-text-field>
                                    </div>
                                </polaris-form-layout-group>
                                
                                <polaris-form-layout-group condensed>
                                    <div class="form-field">
                                        <polaris-select
                                            id="eventType"
                                            label="Event Type"
                                            value="wedding"
                                            options='[
                                                {"label": "Wedding", "value": "wedding"},
                                                {"label": "Baby Shower", "value": "baby_shower"}, 
                                                {"label": "Birthday", "value": "birthday"},
                                                {"label": "Holiday", "value": "holiday"},
                                                {"label": "Housewarming", "value": "housewarming"},
                                                {"label": "Other", "value": "other"}
                                            ]'
                                            onchange="handleFormChange()"
                                        ></polaris-select>
                                    </div>
                                    
                                    <div class="form-field">
                                        <polaris-text-field
                                            id="eventDate"
                                            label="Event Date"
                                            type="date"
                                            value="2024-06-15"
                                            onchange="handleFormChange()"
                                        ></polaris-text-field>
                                    </div>
                                </polaris-form-layout-group>
                                
                                <polaris-form-layout-group>
                                    <div class="form-field">
                                        <polaris-select
                                            id="visibility"
                                            label="Privacy Setting"
                                            value="public"
                                            options='[
                                                {"label": "Public - Anyone can find and view", "value": "public"},
                                                {"label": "Private - Only people with the link", "value": "private"}
                                            ]'
                                            help-text="Control who can see your registry"
                                            onchange="handleFormChange()"
                                        ></polaris-select>
                                    </div>
                                </polaris-form-layout-group>
                                
                                <!-- Advanced Settings -->
                                <polaris-form-layout-group>
                                    <polaris-heading element="h3" style="margin: var(--p-space-600, 1.5rem) 0 var(--p-space-400, 1rem) 0;">
                                        Advanced Settings
                                    </polaris-heading>
                                    
                                    <div class="form-field">
                                        <polaris-checkbox
                                            id="allowGroupGifting"
                                            label="Allow group gifting"
                                            help-text="Let multiple people contribute to the same gift"
                                            checked
                                            onchange="handleFormChange()"
                                        ></polaris-checkbox>
                                    </div>
                                    
                                    <div class="form-field">
                                        <polaris-checkbox
                                            id="allowAnonymousGifts"
                                            label="Allow anonymous gifts"
                                            help-text="Permit gifts from people who don't want to be identified"
                                            checked
                                            onchange="handleFormChange()"
                                        ></polaris-checkbox>
                                    </div>
                                    
                                    <div class="form-field">
                                        <polaris-checkbox
                                            id="sendNotifications"
                                            label="Send email notifications"
                                            help-text="Get notified when someone purchases from your registry"
                                            checked
                                            onchange="handleFormChange()"
                                        ></polaris-checkbox>
                                    </div>
                                </polaris-form-layout-group>
                            </polaris-form-layout>
                        </form>
                    </div>
                </polaris-card>
            </polaris-layout-section>
            
            <polaris-layout-section secondary>
                <polaris-card>
                    <div style="padding: var(--p-space-500, 1.25rem);">
                        <polaris-heading element="h3">Registry Status</polaris-heading>
                        <div style="margin-top: var(--p-space-400, 1rem);">
                            <polaris-badge status="success">Active</polaris-badge>
                        </div>
                        <p style="margin-top: var(--p-space-300, 0.75rem); font-size: var(--p-font-size-325, 0.8125rem); color: var(--p-color-text-secondary);">
                            Your registry is live and visible to customers.
                        </p>
                    </div>
                </polaris-card>
                
                <div style="margin-top: var(--p-space-500, 1.25rem);">
                    <polaris-card>
                        <div style="padding: var(--p-space-500, 1.25rem);">
                            <polaris-heading element="h3">Quick Actions</polaris-heading>
                            <div style="margin-top: var(--p-space-400, 1rem);">
                                <polaris-button-group>
                                    <polaris-button onclick="previewRegistry()">Preview</polaris-button>
                                    <polaris-button onclick="shareRegistry()">Share</polaris-button>
                                    <polaris-button destructive onclick="deleteRegistry()">Delete</polaris-button>
                                </polaris-button-group>
                            </div>
                        </div>
                    </polaris-card>
                </div>
            </polaris-layout-section>
        </polaris-layout>
    </div>

    <script>
        console.log('Registry Settings loaded');
        
        const shop = '${shop}';
        const registryId = '${registryId}';
        let hasUnsavedChanges = false;
        let app, contextualSaveBar;
        
        // Initialize App Bridge
        if (window.AppBridge) {
            app = window.AppBridge.createApp({
                apiKey: '${process.env.SHOPIFY_API_KEY || 'your-api-key'}',
                host: new URLSearchParams(window.location.search).get('host') || '',
                forceRedirect: true
            });
            
            // Initialize Contextual Save Bar
            const ContextualSaveBar = window.AppBridge.actions.ContextualSaveBar;
            contextualSaveBar = ContextualSaveBar.create(app, {
                saveAction: {
                    label: 'Save',
                    message: 'SAVE_REGISTRY_SETTINGS'
                },
                discardAction: {
                    label: 'Discard',
                    message: 'DISCARD_REGISTRY_SETTINGS'  
                }
            });
            
            // Listen for save bar actions
            app.subscribe(ContextualSaveBar.ActionType.SAVE, () => {
                saveSettings();
            });
            
            app.subscribe(ContextualSaveBar.ActionType.DISCARD, () => {
                discardChanges();
            });
            
            console.log('App Bridge and Contextual Save Bar initialized');
        }
        
        // Handle form changes
        function handleFormChange() {
            if (!hasUnsavedChanges) {
                hasUnsavedChanges = true;
                showUnsavedIndicator();
                showContextualSaveBar();
            }
        }
        
        // Show unsaved changes indicator
        function showUnsavedIndicator() {
            const indicator = document.getElementById('unsavedIndicator');
            indicator.style.display = 'block';
        }
        
        // Hide unsaved changes indicator
        function hideUnsavedIndicator() {
            const indicator = document.getElementById('unsavedIndicator');
            indicator.style.display = 'none';
        }
        
        // Show contextual save bar
        function showContextualSaveBar() {
            if (contextualSaveBar) {
                contextualSaveBar.dispatch(window.AppBridge.actions.ContextualSaveBar.Action.SHOW);
            }
        }
        
        // Hide contextual save bar
        function hideContextualSaveBar() {
            if (contextualSaveBar) {
                contextualSaveBar.dispatch(window.AppBridge.actions.ContextualSaveBar.Action.HIDE);
            }
        }
        
        // Save settings
        async function saveSettings() {
            try {
                const form = document.getElementById('settingsForm');
                form.classList.add('loading');
                
                const formData = {
                    registryId,
                    title: document.getElementById('registryTitle').value,
                    description: document.getElementById('registryDescription').value,
                    eventType: document.getElementById('eventType').value,
                    eventDate: document.getElementById('eventDate').value,
                    visibility: document.getElementById('visibility').value,
                    allowGroupGifting: document.getElementById('allowGroupGifting').checked,
                    allowAnonymousGifts: document.getElementById('allowAnonymousGifts').checked,
                    sendNotifications: document.getElementById('sendNotifications').checked
                };
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                console.log('Saving settings:', formData);
                
                // Mark as saved
                hasUnsavedChanges = false;
                hideUnsavedIndicator();
                hideContextualSaveBar();
                
                showToast('Registry settings saved successfully!');
                
            } catch (error) {
                console.error('Error saving settings:', error);
                showToast('Error saving settings: ' + error.message, true);
            } finally {
                const form = document.getElementById('settingsForm');
                form.classList.remove('loading');
            }
        }
        
        // Discard changes
        function discardChanges() {
            // Reset form to original values
            document.getElementById('registryTitle').value = 'Sample Wedding Registry';
            document.getElementById('registryDescription').value = 'Help us celebrate our special day with these carefully chosen items.';
            document.getElementById('eventType').value = 'wedding';
            document.getElementById('eventDate').value = '2024-06-15';
            document.getElementById('visibility').value = 'public';
            document.getElementById('allowGroupGifting').checked = true;
            document.getElementById('allowAnonymousGifts').checked = true;
            document.getElementById('sendNotifications').checked = true;
            
            hasUnsavedChanges = false;
            hideUnsavedIndicator();
            hideContextualSaveBar();
            
            showToast('Changes discarded');
        }
        
        // Quick actions
        function previewRegistry() {
            showToast('Opening registry preview...');
        }
        
        function shareRegistry() {
            showToast('Registry sharing options coming soon!');
        }
        
        function deleteRegistry() {
            if (confirm('Are you sure you want to delete this registry? This action cannot be undone.')) {
                showToast('Registry deletion functionality coming soon!');
            }
        }
        
        // Toast notifications
        function showToast(message, isError = false) {
            if (app && window.AppBridge.actions.Toast) {
                const toast = window.AppBridge.actions.Toast.create(app, {
                    message: message,
                    duration: 3000,
                    isError: isError
                });
                toast.dispatch(window.AppBridge.actions.Toast.Action.SHOW);
            } else {
                // Fallback for non-App Bridge context
                alert(message);
            }
        }
        
        // Prevent navigation with unsaved changes
        window.addEventListener('beforeunload', (event) => {
            if (hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
        
        console.log('Registry Settings initialized with Contextual Save Bar support');
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        return res.status(200).send(html);
        
    } catch (error) {
        console.error('Registry Settings error:', error);
        return res.status(500).json({
            error: 'Server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}