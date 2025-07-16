/**
 * Performance Alert API Endpoint
 * Handles real-time performance violations from client-side monitoring
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { checkPerformanceThreshold, sendPerformanceAlert } from "~/lib/performance-alerts.server";
import { log } from "~/lib/logger.server";

interface PerformanceAlertRequest {
  metric: string;
  value: number;
  rating: string;
  path: string;
  timestamp: number;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Authenticate the request (optional - can be public for monitoring)
    let shop: string | undefined;
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
    } catch {
      // Allow unauthenticated performance monitoring
      shop = undefined;
    }

    const alertData: PerformanceAlertRequest = await request.json();

    // Validate the alert data
    if (!alertData.metric || typeof alertData.value !== 'number') {
      return json({ error: "Invalid alert data" }, { status: 400 });
    }

    // Check if this metric value exceeds alert thresholds
    const alert = checkPerformanceThreshold(
      alertData.metric,
      alertData.value,
      shop,
      alertData.path
    );

    if (alert) {
      // Configure alert settings based on environment
      const alertConfig = {
        enabled: process.env.NODE_ENV === 'production',
        webhookUrl: process.env.PERFORMANCE_WEBHOOK_URL,
        slackChannel: process.env.SLACK_WEBHOOK_URL,
        discordWebhook: process.env.DISCORD_WEBHOOK_URL,
        emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(','),
      };

      // Send the alert
      await sendPerformanceAlert(alert, alertConfig);

      log.info('Performance alert processed', {
        alert,
        shop,
        alertSent: true,
      });

      return json({
        success: true,
        alert: {
          metric: alert.metric,
          severity: alert.severity,
          threshold: alert.threshold,
        },
      });
    }

    // No alert needed
    return json({
      success: true,
      alert: null,
    });

  } catch (error) {
    log.error('Failed to process performance alert', { error });
    
    return json(
      { error: "Failed to process alert" },
      { status: 500 }
    );
  }
}

// Handle GET requests for health checks
export async function loader() {
  return json({
    status: "ok",
    endpoint: "performance-alert",
    description: "Endpoint for receiving client-side performance alerts",
  });
}