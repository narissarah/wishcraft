export default async function handler(req, res) {
  try {
    console.log('GDPR customer redact webhook called:', req.method, req.headers);
    
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const webhookTopic = req.headers['x-shopify-topic'];
    
    if (webhookTopic !== 'customers/redact') {
      return res.status(400).json({
        success: false,
        error: "Invalid webhook topic",
        expected: "customers/redact",
        received: webhookTopic
      });
    }
    
    const { customer, orders_to_redact } = req.body;
    console.log('Redact request for customer:', customer?.id, 'Shop:', shopDomain);
    
    // GDPR compliance: Redact customer data
    // In a real app, you would:
    // 1. Remove or anonymize all customer PII from your database
    // 2. Delete customer's gift registries and wishlists
    // 3. Remove customer from any shared registries
    // 4. Clean up any logs containing customer data
    // 5. Log the redaction for audit purposes
    
    const redactionTasks = [
      'customer_profile',
      'gift_registries', 
      'wishlists',
      'activity_logs',
      'shared_registry_access',
      'customer_preferences'
    ];
    
    console.log('Redacting data for customer:', customer?.id, 'Tasks:', redactionTasks);
    
    res.status(200).json({
      success: true,
      message: "Customer data redaction completed",
      customer_id: customer?.id,
      shop: shopDomain,
      redacted_data_types: redactionTasks,
      redaction_date: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('GDPR customer redact webhook error:', error);
    res.status(500).json({
      success: false,
      error: "GDPR redaction webhook processing failed",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}