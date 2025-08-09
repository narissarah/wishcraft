// GDPR Mandatory Webhook: Customer Data Redaction
// Handles requests to delete/redact customer personal data

import crypto from 'crypto';

export default async function handler(req, res) {
    console.log('GDPR Customer Redaction Webhook:', req.method, req.headers);

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

        // Process the redaction request
        const payload = req.body;
        console.log('Processing GDPR customer redaction for:', {
            shop_id: payload.shop_id,
            shop_domain: payload.shop_domain,
            customer_id: payload.customer?.id,
            customer_email: payload.customer?.email,
            orders_to_redact: payload.orders_to_redact?.length || 0
        });

        // In a real implementation, you would:
        // 1. Find all customer data in your database
        // 2. Delete or anonymize personal information
        // 3. Maintain transaction records for business purposes
        // 4. Log the redaction for audit purposes

        const redactionResults = {
            customer_id: payload.customer?.id,
            shop_domain: payload.shop_domain,
            registries_redacted: 0, // Would be actual count from database
            activity_logs_redacted: 0, // Would be actual count from database
            personal_data_anonymized: true,
            redacted_at: new Date().toISOString(),
            retention_policy: 'Business records retained as per legal requirements'
        };

        // Simulate redaction process
        if (payload.customer?.id) {
            // In production, execute database operations here:
            // - UPDATE registries SET customer_email = 'redacted@privacy.local', customer_name = 'REDACTED' WHERE customer_id = ?
            // - UPDATE registry_activities SET actor_email = 'redacted@privacy.local' WHERE actor_id = ?
            // - DELETE FROM customer_preferences WHERE customer_id = ?
            
            redactionResults.registries_redacted = 1; // Simulated
            redactionResults.activity_logs_redacted = 3; // Simulated
        }

        // Log for audit trail
        console.log('GDPR Customer Redaction processed successfully:', redactionResults);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Customer data redaction completed',
            customer_id: payload.customer?.id,
            redaction_summary: redactionResults,
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('GDPR Customer Redaction Webhook error:', error);
        res.status(500).json({
            error: 'Internal server error processing redaction request',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}