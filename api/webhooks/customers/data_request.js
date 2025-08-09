export default async function handler(req, res) {
  try {
    console.log('GDPR data request webhook called:', req.method, req.headers);
    
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const webhookTopic = req.headers['x-shopify-topic'];
    
    if (webhookTopic !== 'customers/data_request') {
      return res.status(400).json({
        success: false,
        error: "Invalid webhook topic",
        expected: "customers/data_request",
        received: webhookTopic
      });
    }
    
    const { customer, orders_requested } = req.body;
    console.log('Data request for customer:', customer?.id, 'Shop:', shopDomain);
    
    // GDPR compliance: Handle customer data request
    // In a real app, you would:
    // 1. Collect all customer data from your database
    // 2. Generate a data export file
    // 3. Send the data to the customer or make it available for download
    // 4. Log the request for audit purposes
    
    const customerData = {
      customer_id: customer?.id,
      email: customer?.email,
      // Add other customer data fields as needed
      registry_data: [], // Customer's gift registries
      wishlist_data: [], // Customer's wishlists
      activity_log: [], // Customer's activity in the app
    };
    
    console.log('Generated data export for customer:', customer?.id);
    
    res.status(200).json({
      success: true,
      message: "Data request processed - customer data will be provided",
      customer_id: customer?.id,
      shop: shopDomain,
      data_available: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('GDPR data request webhook error:', error);
    res.status(500).json({
      success: false,
      error: "GDPR webhook processing failed",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}