export default function handler(req, res) {
  try {
    console.log('WishCraft app interface:', req.method, req.url);

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>WishCraft - Gift Registry App</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f6f6f7; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .btn { background: #008060; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        .card { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎁 WishCraft Dashboard</h1>
            <p>Gift Registry Management for Shopify</p>
        </div>
        
        <div class="card">
            <h3>Registry Management</h3>
            <p>Create and manage customer gift registries</p>
            <button class="btn" onclick="alert('Registry creation coming soon!')">Create Registry</button>
        </div>
        
        <div class="card">
            <h3>Analytics</h3>
            <p>View registry performance and customer engagement</p>
            <button class="btn" onclick="alert('Analytics coming soon!')">View Analytics</button>
        </div>
        
        <div class="card">
            <h3>Settings</h3>
            <p>Configure your WishCraft app settings</p>
            <button class="btn" onclick="alert('Settings coming soon!')">Open Settings</button>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666;">
            <p>✅ Deployed on Vercel | Built for Shopify 2025</p>
            <p>Status: Active | API Version: 2025-07</p>
        </div>
    </div>
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
      message: error.message
    });
  }
}