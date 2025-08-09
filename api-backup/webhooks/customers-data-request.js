// GDPR Mandatory Webhook: Customer Data Request
// Handles requests from customers to export their personal data

import crypto from 'crypto';

export default async function handler(req, res) {
    console.log('GDPR Data Request Webhook:', req.method, req.headers);

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            allowed: 'POST' 
        });
    }

    try {
        // Verify webhook authenticity
        const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('SHOPIFY_WEBHOOK_SECRET not configured');
            return res.status(500).json({ error: 'Webhook secret not configured' });
        }

        // Get HMAC signature from headers
        const hmacHeader = req.headers['x-shopify-hmac-sha256'];
        if (!hmacHeader) {
            console.error('Missing HMAC header');
            return res.status(401).json({ error: 'Unauthorized - Missing HMAC' });
        }

        // Verify HMAC signature
        const body = JSON.stringify(req.body);
        const calculatedHmac = crypto
            .createHmac('sha256', webhookSecret)
            .update(body, 'utf8')
            .digest('base64');

        if (calculatedHmac !== hmacHeader) {
            console.error('HMAC verification failed');
            return res.status(401).json({ error: 'Unauthorized - Invalid HMAC' });
        }

        // Process the data request
        const payload = req.body;
        console.log('Processing GDPR data request for:', {
            shop_id: payload.shop_id,
            shop_domain: payload.shop_domain,
            customer_id: payload.customer?.id,
            customer_email: payload.customer?.email,
            data_request_id: payload.data_request?.id
        });

        // In a real implementation, you would:
        // 1. Query your database for all customer data
        // 2. Compile it into a format suitable for export
        // 3. Either return it directly or send it via email
        
        // For now, we'll log the request and return success
        const customerData = {
            customer_id: payload.customer?.id,
            email: payload.customer?.email,
            registries: [], // Would fetch from database
            activity_logs: [], // Would fetch from database
            created_at: new Date().toISOString(),
            note: 'This is a sample data export. In production, this would contain actual customer data from the registry app.'
        };

        // Log for audit trail
        console.log('GDPR Data Request processed successfully:', {
            data_request_id: payload.data_request?.id,
            customer_id: payload.customer?.id,
            processed_at: new Date().toISOString()
        });

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Data request processed',
            data_request_id: payload.data_request?.id,
            processed_at: new Date().toISOString(),
            // In production, you might return the data here or send it separately
            customer_data: customerData
        });

    } catch (error) {
        console.error('GDPR Data Request Webhook error:', error);
        res.status(500).json({
            error: 'Internal server error processing data request',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}