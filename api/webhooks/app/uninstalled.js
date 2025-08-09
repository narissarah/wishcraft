export default async function handler(req, res) {
  try {
    console.log('App uninstalled webhook called:', req.method, req.headers);
    
    // Verify webhook (in production, you should verify the webhook signature)
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const webhookTopic = req.headers['x-shopify-topic'];
    
    if (webhookTopic !== 'app/uninstalled') {
      return res.status(400).json({
        success: false,
        error: "Invalid webhook topic",
        expected: "app/uninstalled",
        received: webhookTopic
      });
    }
    
    const body = req.body;
    console.log('App uninstalled for shop:', shopDomain, 'Data:', body);
    
    // Handle app uninstallation cleanup
    // In a real app, you would:
    // 1. Remove shop data from database
    // 2. Cancel any subscriptions
    // 3. Clean up resources
    // 4. Send notifications if needed
    
    res.status(200).json({
      success: true,
      message: "App uninstallation processed",
      shop: shopDomain,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('App uninstalled webhook error:', error);
    res.status(500).json({
      success: false,
      error: "Webhook processing failed",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}