export default async function handler(req, res) {
  try {
    console.log('Shopify OAuth callback called:', req.method, req.url, req.query);
    
    const { shop, code, state, error } = req.query;
    
    // Handle OAuth error
    if (error) {
      console.error('OAuth error:', error);
      return res.status(400).json({
        success: false,
        error: "OAuth authorization failed",
        details: error,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate required parameters
    if (!shop || !code) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "Shop and code parameters are required",
        received: { shop: !!shop, code: !!code, state: !!state },
        timestamp: new Date().toISOString()
      });
    }
    
    // Exchange code for access token
    const accessTokenResponse = await fetch(`https://${shop}.myshopify.com/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      })
    });
    
    if (!accessTokenResponse.ok) {
      throw new Error(`Failed to exchange code for access token: ${accessTokenResponse.status}`);
    }
    
    const tokenData = await accessTokenResponse.json();
    
    // Store the access token (in a real app, you'd store this securely)
    console.log('Access token obtained for shop:', shop);
    
    // Redirect to success page or app
    const successHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>WishCraft - Installation Complete</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; text-align: center; min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
        }
        .container { 
            background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; 
            backdrop-filter: blur(10px); max-width: 500px;
        }
        .success { color: #4ade80; font-size: 4em; margin-bottom: 20px; }
        h1 { margin: 20px 0; }
        .details { background: rgba(0,0,0,0.2); padding: 20px; border-radius: 12px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✅</div>
        <h1>WishCraft Successfully Installed!</h1>
        <p>Your Shopify app has been installed and configured.</p>
        
        <div class="details">
            <strong>Shop:</strong> ${shop}<br>
            <strong>Scopes:</strong> ${tokenData.scope}<br>
            <strong>Installed:</strong> ${new Date().toISOString()}
        </div>
        
        <p>You can now close this window and return to your Shopify admin.</p>
    </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(successHtml);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: "OAuth callback failed",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}