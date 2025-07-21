/**
 * Webhook utility functions
 */

export interface OrderPayload {
  id: string;
  order_number: string;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  currency: string;
  line_items: Array<{
    id: string;
    product_id: string;
    variant_id: string;
    title: string;
    quantity: number;
    price: string;
  }>;
  customer?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export function parseWebhookPayload(payload: string): OrderPayload {
  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error('Invalid webhook payload format');
  }
}

export function handleWebhookResponse(data: any) {
  // Basic webhook response handler
  return {
    success: true,
    data
  };
}