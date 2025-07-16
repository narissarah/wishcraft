import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { encryptGiftMessage, decryptGiftMessage, validateGiftMessage, sanitizeGiftMessage, logGiftMessageOperation } from "~/lib/encryption.server";
import { db } from "~/lib/db.server";
import { notificationManager, NotificationTemplates } from "~/lib/notifications.server";

/**
 * Gift Message API Endpoints
 * 
 * GET /api/gift-messages?purchaseId=123 - Get decrypted gift message
 * POST /api/gift-messages - Create/update gift message
 * PUT /api/gift-messages/:id - Update gift message
 * DELETE /api/gift-messages/:id - Remove gift message
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  if (!admin) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const purchaseId = url.searchParams.get("purchaseId");
  
  if (!purchaseId) {
    return json({ error: "Purchase ID required" }, { status: 400 });
  }

  try {
    // Get the purchase with gift message
    const purchase = await db.registryPurchase.findUnique({
      where: { id: purchaseId },
      include: {
        registry: {
          select: {
            id: true,
            customerId: true,
            shopId: true,
          },
        },
      },
    });

    if (!purchase) {
      return json({ error: "Purchase not found" }, { status: 404 });
    }

    // Decrypt gift message if it exists
    let decryptedGiftMessage = null;
    
    if (purchase.giftMessage) {
      try {
        decryptedGiftMessage = decryptGiftMessage(
          purchase.giftMessage,
          purchase.purchaserEmail || 'anonymous',
          purchase.registry.id
        );
        
        logGiftMessageOperation(
          'decrypt',
          purchase.purchaserEmail || 'anonymous',
          purchase.registry.id,
          true
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logGiftMessageOperation(
          'decrypt',
          purchase.purchaserEmail || 'anonymous',
          purchase.registry.id,
          false,
          errorMessage
        );
        
        return json({ error: "Failed to decrypt gift message" }, { status: 500 });
      }
    }

    return json({
      purchaseId: purchase.id,
      giftMessage: decryptedGiftMessage,
      purchaserName: purchase.purchaserName,
      purchaserEmail: purchase.purchaserEmail,
      createdAt: purchase.createdAt,
    });
  } catch (error) {
    log.error("Failed to retrieve gift message:", error as Error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  if (!admin) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const method = request.method;
  
  if (method === "POST") {
    return handleCreateGiftMessage(request);
  } else if (method === "PUT") {
    return handleUpdateGiftMessage(request);
  } else if (method === "DELETE") {
    return handleDeleteGiftMessage(request);
  } else {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
}

/**
 * Create or attach gift message to purchase
 */
async function handleCreateGiftMessage(request: Request) {
  try {
    const formData = await request.formData();
    const purchaseId = formData.get("purchaseId") as string;
    const giftMessage = formData.get("giftMessage") as string;
    const purchaserEmail = formData.get("purchaserEmail") as string;
    
    if (!purchaseId || !giftMessage) {
      return json({ error: "Purchase ID and gift message are required" }, { status: 400 });
    }

    // Get the purchase
    const purchase = await db.registryPurchase.findUnique({
      where: { id: purchaseId },
      include: {
        registry: {
          select: {
            id: true,
            customerId: true,
            shopId: true,
          },
        },
      },
    });

    if (!purchase) {
      return json({ error: "Purchase not found" }, { status: 404 });
    }

    // Validate gift message
    const validation = validateGiftMessage(giftMessage);
    if (!validation.isValid) {
      logGiftMessageOperation('validate', purchaserEmail, purchase.registry.id, false, validation.error);
      return json({ error: validation.error }, { status: 400 });
    }

    // Sanitize and encrypt gift message
    const sanitizedMessage = sanitizeGiftMessage(giftMessage);
    const encryptedMessage = encryptGiftMessage(sanitizedMessage, purchaserEmail, purchase.registry.id);

    // Update the purchase with encrypted gift message
    const updatedPurchase = await db.registryPurchase.update({
      where: { id: purchaseId },
      data: {
        giftMessage: encryptedMessage,
      },
    });

    logGiftMessageOperation('encrypt', purchaserEmail, purchase.registry.id, true);

    // Send notification about gift message
    await notificationManager.sendNotification({
      ...NotificationTemplates.giftMessage(purchase.purchaserName || 'Anonymous'),
      shopId: purchase.registry.shopId,
      customerId: purchase.registry.customerId,
      registryId: purchase.registry.id,
      metadata: {
        purchaseId: purchase.id,
        purchaserEmail: purchase.purchaserEmail,
      },
      actionUrl: `/app/registries/${purchase.registry.id}`,
      actionLabel: 'View Registry',
    });

    return json({ 
      success: true, 
      message: "Gift message added successfully",
      purchaseId: updatedPurchase.id,
    });
  } catch (error) {
    log.error("Failed to create gift message:", error as Error);
    return json({ error: "Failed to create gift message" }, { status: 500 });
  }
}

/**
 * Update existing gift message
 */
async function handleUpdateGiftMessage(request: Request) {
  try {
    const formData = await request.formData();
    const purchaseId = formData.get("purchaseId") as string;
    const giftMessage = formData.get("giftMessage") as string;
    const purchaserEmail = formData.get("purchaserEmail") as string;
    
    if (!purchaseId || !giftMessage) {
      return json({ error: "Purchase ID and gift message are required" }, { status: 400 });
    }

    // Get the purchase
    const purchase = await db.registryPurchase.findUnique({
      where: { id: purchaseId },
      include: {
        registry: {
          select: {
            id: true,
            customerId: true,
            shopId: true,
          },
        },
      },
    });

    if (!purchase) {
      return json({ error: "Purchase not found" }, { status: 404 });
    }

    // Validate gift message
    const validation = validateGiftMessage(giftMessage);
    if (!validation.isValid) {
      logGiftMessageOperation('validate', purchaserEmail, purchase.registry.id, false, validation.error);
      return json({ error: validation.error }, { status: 400 });
    }

    // Sanitize and encrypt gift message
    const sanitizedMessage = sanitizeGiftMessage(giftMessage);
    const encryptedMessage = encryptGiftMessage(sanitizedMessage, purchaserEmail, purchase.registry.id);

    // Update the purchase with encrypted gift message
    await db.registryPurchase.update({
      where: { id: purchaseId },
      data: {
        giftMessage: encryptedMessage,
      },
    });

    logGiftMessageOperation('encrypt', purchaserEmail, purchase.registry.id, true);

    return json({ 
      success: true, 
      message: "Gift message updated successfully",
    });
  } catch (error) {
    log.error("Failed to update gift message:", error as Error);
    return json({ error: "Failed to update gift message" }, { status: 500 });
  }
}

/**
 * Delete gift message
 */
async function handleDeleteGiftMessage(request: Request) {
  try {
    const url = new URL(request.url);
    const purchaseId = url.searchParams.get("purchaseId");
    
    if (!purchaseId) {
      return json({ error: "Purchase ID required" }, { status: 400 });
    }

    // Update the purchase to remove gift message
    await db.registryPurchase.update({
      where: { id: purchaseId },
      data: {
        giftMessage: null,
      },
    });

    return json({ 
      success: true, 
      message: "Gift message removed successfully",
    });
  } catch (error) {
    log.error("Failed to delete gift message:", error as Error);
    return json({ error: "Failed to delete gift message" }, { status: 500 });
  }
}