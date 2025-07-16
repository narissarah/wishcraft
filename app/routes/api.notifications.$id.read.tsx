import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { notificationManager } from "~/lib/notifications.server";

/**
 * Mark notification as read
 * POST /api/notifications/:id/read
 */
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);
  
  if (!admin) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const notificationId = params.id;
  
  if (!notificationId) {
    return json({ error: "Notification ID required" }, { status: 400 });
  }

  try {
    await notificationManager.markAsRead(notificationId);
    return json({ success: true });
  } catch (error) {
    return json({ error: "Failed to mark notification as read" }, { status: 500 });
  }
}