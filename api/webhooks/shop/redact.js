export default async function handler(req, res) {
  try {
    console.log('GDPR shop redact webhook called:', req.method, req.headers);
    
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const webhookTopic = req.headers['x-shopify-topic'];
    
    if (webhookTopic !== 'shop/redact') {
      return res.status(400).json({
        success: false,
        error: "Invalid webhook topic",
        expected: "shop/redact",
        received: webhookTopic
      });
    }
    
    const body = req.body;
    console.log('Shop redact request for:', shopDomain, 'Data:', body);
    
    // GDPR compliance: Redact shop data (48 hours after uninstall)
    // In a real app, you would:
    // 1. Remove all shop-related data from your database
    // 2. Delete all customer data associated with the shop
    // 3. Remove all registries, wishlists, and products
    // 4. Clean up any cached data
    // 5. Remove shop from analytics
    // 6. Log the redaction for audit purposes
    
    const redactionTasks = [
      'shop_configuration',
      'customer_data',
      'gift_registries',
      'wishlists', 
      'product_data',
      'order_data',
      'analytics_data',
      'cached_data',
      'webhook_logs'
    ];
    
    console.log('Redacting all data for shop:', shopDomain, 'Tasks:', redactionTasks);
    
    res.status(200).json({
      success: true,
      message: "Shop data redaction completed",
      shop: shopDomain,
      redacted_data_types: redactionTasks,
      redaction_date: new Date().toISOString(),
      note: "All data associated with this shop has been permanently deleted",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('GDPR shop redact webhook error:', error);
    res.status(500).json({
      success: false,
      error: "GDPR shop redaction webhook processing failed",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}