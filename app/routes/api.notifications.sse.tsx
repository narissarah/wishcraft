import type { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import { authenticate } from "~/shopify.server";
import { notificationManager } from "~/lib/notifications.server";
import { log } from "~/lib/logger.server";

/**
 * Server-Sent Events endpoint for real-time notifications
 * GET /api/notifications/sse
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Authenticate the request
    const { admin, session } = await authenticate.admin(request);
    
    if (!admin) {
      return new Response("Unauthorized", { status: 401 });
    }
  
  const shop = session.shop;
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  
  // Create SSE connection key
  const connectionKey = customerId 
    ? `customer:${customerId}` 
    : `shop:${shop}`;
  
  log.info("SSE connection established", { shop, customerId });
  
  return eventStream(request.signal, function setup(send) {
    // Send initial connection message
    send({
      event: "connected",
      data: JSON.stringify({
        message: "Connected to notification stream",
        timestamp: new Date().toISOString(),
      }),
    });
    
    // Get and send recent notifications with error handling
    notificationManager
      .getRecentNotifications(shop, customerId || undefined, 10)
      .then(notifications => {
        send({
          event: "recent",
          data: JSON.stringify(notifications),
        });
      })
      .catch(error => {
        log.error("Failed to fetch recent notifications", error);
        // Send error event to client
        send({
          event: "error",
          data: JSON.stringify({
            error: "Failed to fetch recent notifications",
            recoverable: true,
            timestamp: new Date().toISOString(),
          }),
        });
      });
    
    // Set up real-time notification listener with error handling
    const notificationHandler = (notification: any) => {
      try {
        // Filter notifications for this connection
        if (notification.shopId === shop) {
          if (!customerId || notification.customerId === customerId) {
            send({
              event: "notification",
              data: JSON.stringify(notification),
            });
          }
        }
      } catch (error) {
        log.error("Error sending notification via SSE", error);
        // Send error event to client
        send({
          event: "error",
          data: JSON.stringify({
            error: "Failed to send notification",
            recoverable: true,
            timestamp: new Date().toISOString(),
          }),
        });
      }
    };
    
    // Register the handler
    notificationManager.on("notification", notificationHandler);
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        send({
          event: "heartbeat",
          data: JSON.stringify({
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        log.error("Error sending heartbeat", error);
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    
    // Cleanup function
    return function cleanup() {
      try {
        log.info("SSE connection closed", { shop, customerId });
        notificationManager.removeListener("notification", notificationHandler);
        clearInterval(heartbeatInterval);
      } catch (error) {
        log.error("Error during SSE cleanup", error);
      }
    };
  });
  
  } catch (error) {
    log.error("Failed to establish SSE connection", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}