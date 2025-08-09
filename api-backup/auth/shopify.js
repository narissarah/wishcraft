export default async function handler(req, res) {
  try {
    console.log('Shopify auth endpoint called:', req.method, req.url);
    
    const { shop, code, state } = req.query;
    
    // Handle OAuth initiation
    if (!shop && !code) {
      return res.status(400).json({
        success: false,
        error: "Missing shop parameter",
        message: "Shop parameter is required to initiate OAuth flow",
        timestamp: new Date().toISOString()
      });
    }
    
    // OAuth initiation - redirect to Shopify
    if (shop && !code) {
      const apiKey = process.env.SHOPIFY_API_KEY;
      const redirectUri = `https://wishcraft-h3dqg9uni-narissarahs-projects.vercel.app/auth/shopify/callback`;
      const scopes = "read_customers,read_products,read_orders,write_orders,read_inventory";
      const nonce = Math.random().toString(36).substring(2, 15);
      
      const shopifyAuthUrl = `https://${shop}.myshopify.com/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
      
      res.redirect(302, shopifyAuthUrl);
      return;
    }
    
    // OAuth callback handling
    if (code) {
      res.status(200).json({
        success: true,
        message: "OAuth callback received",
        shop,
        hasCode: !!code,
        hasState: !!state,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Default response
    res.status(200).json({
      success: true,
      message: "Shopify authentication endpoint ready",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Shopify auth error:', error);
    res.status(500).json({
      success: false,
      error: "Authentication failed",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}