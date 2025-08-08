export default function handler(req, res) {
  try {
    console.log("WishCraft main handler:", req.method, req.url);

    // Check if it's being loaded in Shopify admin (has host parameter)
    const { host } = req.query;
    if (host) {
      // Redirect to app interface when loaded in Shopify admin
      return res.redirect(302, `/app?host=${encodeURIComponent(host)}`);
    }

    // Return WishCraft landing page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>🎁 WishCraft - Gift Registry App</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; display: flex; flex-direction: column; align-items: center; 
            justify-content: center; min-height: 100vh; text-align: center;
        }
        .container { max-width: 700px; background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; backdrop-filter: blur(10px); }
        .logo { font-size: 5em; margin-bottom: 20px; text-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .title { font-size: 3em; margin-bottom: 20px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .subtitle { font-size: 1.3em; margin-bottom: 30px; color: rgba(255,255,255,0.9); }
        .status { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px; margin: 30px 0; border: 1px solid rgba(255,255,255,0.3); }
        .features { text-align: left; margin: 30px 0; }
        .features li { margin: 15px 0; font-size: 1.1em; }
        .endpoints { background: rgba(0,0,0,0.2); padding: 20px; border-radius: 12px; margin: 30px 0; }
        .endpoints a { color: #fff; text-decoration: none; display: block; margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; }
        .endpoints a:hover { background: rgba(255,255,255,0.2); }
        .footer { margin-top: 30px; font-size: 0.9em; color: rgba(255,255,255,0.8); }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎁</div>
        <h1 class="title">WishCraft</h1>
        <p class="subtitle">The most comprehensive gift registry app for Shopify stores</p>
        
        <div class="status">
            <strong>✅ Successfully Deployed on Vercel</strong><br>
            Built for Shopify 2025 API Compliance
        </div>

        <ul class="features">
            <li>🛍️ Native Shopify integration with 2025-07 API</li>
            <li>🔒 Enterprise security with CSP and CSRF protection</li>
            <li>⚡ Serverless architecture on Vercel</li>
            <li>📱 Mobile-responsive embedded app experience</li>
            <li>🎯 Complete gift registry and wishlist management</li>
            <li>🚀 Vercel-optimized serverless deployment</li>
        </ul>

        <div class="endpoints">
            <strong>🔗 API Endpoints:</strong><br>
            <a href="/api/hello">/api/hello - Hello endpoint</a>
            <a href="/api/test">/api/test - Test endpoint</a>
            <a href="/api/db-status">/api/db-status - Database status</a>
        </div>

        <div class="footer">
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</p>
            <p><strong>Platform:</strong> ${process.env.VERCEL ? 'Vercel ✅' : 'Unknown'}</p>
            <p><strong>Request:</strong> ${req.method} ${req.url}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com");
    res.status(200).send(html);

  } catch (error) {
    console.error("Main handler error:", error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error",
      message: error.message,
      app: "WishCraft",
      timestamp: new Date().toISOString()
    });
  }
}