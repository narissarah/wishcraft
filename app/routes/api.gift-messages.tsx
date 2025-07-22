import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { encryptGiftMessage, decryptGiftMessage, validateGiftMessage, sanitizeGiftMessage, logGiftMessageOperation } from "~/lib/crypto.server";
import { db } from "~/lib/db.server";
import { apiResponse } from "~/lib/api-response.server";


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
    return apiResponse.unauthorized();
  }

  const url = new URL(request.url);
  const purchaseId = url.searchParams.get("purchaseId");
  
  if (!purchaseId) {
    return apiResponse.validationError({ purchaseId: ["Purchase ID is required"] });
  }

  try {
    // Get the purchase with gift message
    const purchase = await db.registry_purchases.findUnique({
      where: { id: purchaseId },
      include: {
        registry_items: {
          include: {
            registries: {
              select: {
                id: true,
                customerId: true,
                shopId: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return apiResponse.notFound("Purchase");
    }

    // Decrypt gift message if it exists
    let decryptedGiftMessage = null;
    
    if (purchase.giftMessage) {
      try {
        decryptedGiftMessage = decryptGiftMessage(
          purchase.giftMessage,
          purchase.purchaserEmail || 'anonymous',
          purchase.registry_items.registries.id
        );
        
        logGiftMessageOperation(
          'decrypt',
          purchase.purchaserEmail || 'anonymous',
          purchase.registry_items.registries.id,
          true
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logGiftMessageOperation(
          'decrypt',
          purchase.purchaserEmail || 'anonymous',
          purchase.registry_items.registries.id,
          false,
          errorMessage
        );
        
        return apiResponse.serverError(new Error("Failed to decrypt gift message"));
      }
    }

    return apiResponse.success({
      purchaseId: purchase.id,
      giftMessage: decryptedGiftMessage,
      purchaserName: purchase.purchaserName,
      purchaserEmail: purchase.purchaserEmail,
      createdAt: purchase.createdAt,
    });
  } catch (error) {
    log.error("Failed to retrieve gift message:", error as Error);
    return apiResponse.serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  if (!admin) {
    return apiResponse.unauthorized();
  }

  const method = request.method;
  
  if (method === "POST") {
    return handleCreateGiftMessage(request);
  } else if (method === "PUT") {
    return handleUpdateGiftMessage(request);
  } else if (method === "DELETE") {
    return handleDeleteGiftMessage(request);
  } else {
    return apiResponse.error("METHOD_NOT_ALLOWED", "Method not allowed", 405);
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
      return apiResponse.validationError({ 
        purchaseId: !purchaseId ? ["Purchase ID is required"] : [],
        giftMessage: !giftMessage ? ["Gift message is required"] : []
      });
    }

    // Get the purchase
    const purchase = await db.registry_purchases.findUnique({
      where: { id: purchaseId },
      include: {
        registry_items: {
          include: {
            registries: {
              select: {
                id: true,
                customerId: true,
                shopId: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return apiResponse.notFound("Purchase");
    }

    // Validate gift message
    const validation = validateGiftMessage(giftMessage);
    if (!validation.isValid) {
      logGiftMessageOperation('validate', purchaserEmail, purchase.registry_items.registries.id, false, validation.error);
      return apiResponse.validationError({ giftMessage: [validation.error || "Invalid gift message"] });
    }

    // Sanitize and encrypt gift message
    const sanitizedMessage = sanitizeGiftMessage(giftMessage);
    const encryptedMessage = encryptGiftMessage(sanitizedMessage, purchaserEmail, purchase.registry_items.registries.id);

    // Update the purchase with encrypted gift message
    const updatedPurchase = await db.registry_purchases.update({
      where: { id: purchaseId },
      data: {
        giftMessage: encryptedMessage,
      },
    });

    logGiftMessageOperation('encrypt', purchaserEmail, purchase.registry_items.registries.id, true);

    log.info('Gift message saved', {
      purchaserName: (purchase.purchaserName || 'Anonymous').substring(0, 3) + '****',
      shopId: purchase.registry_items.registries.shopId,
      customerId: purchase.registry_items.registries.customerId?.substring(0, 8) + '****',
      registryId: purchase.registry_items.registries.id,
      purchaseId: purchase.id
    });

    return apiResponse.created({ 
      purchaseId: updatedPurchase.id,
    }, "Gift message added successfully");
  } catch (error) {
    log.error("Failed to create gift message:", error as Error);
    return apiResponse.serverError(error);
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
      return apiResponse.validationError({ 
        purchaseId: !purchaseId ? ["Purchase ID is required"] : [],
        giftMessage: !giftMessage ? ["Gift message is required"] : []
      });
    }

    // Get the purchase
    const purchase = await db.registry_purchases.findUnique({
      where: { id: purchaseId },
      include: {
        registry_items: {
          include: {
            registries: {
              select: {
                id: true,
                customerId: true,
                shopId: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return apiResponse.notFound("Purchase");
    }

    // Validate gift message
    const validation = validateGiftMessage(giftMessage);
    if (!validation.isValid) {
      logGiftMessageOperation('validate', purchaserEmail, purchase.registry_items.registries.id, false, validation.error);
      return apiResponse.validationError({ giftMessage: [validation.error || "Invalid gift message"] });
    }

    // Sanitize and encrypt gift message
    const sanitizedMessage = sanitizeGiftMessage(giftMessage);
    const encryptedMessage = encryptGiftMessage(sanitizedMessage, purchaserEmail, purchase.registry_items.registries.id);

    // Update the purchase with encrypted gift message
    await db.registry_purchases.update({
      where: { id: purchaseId },
      data: {
        giftMessage: encryptedMessage,
      },
    });

    logGiftMessageOperation('encrypt', purchaserEmail, purchase.registry_items.registries.id, true);

    return apiResponse.success({ 
      message: "Gift message updated successfully"
    });
  } catch (error) {
    log.error("Failed to update gift message:", error as Error);
    return apiResponse.serverError(error);
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
      return apiResponse.validationError({ purchaseId: ["Purchase ID required"] });
    }

    // Update the purchase to remove gift message
    await db.registry_purchases.update({
      where: { id: purchaseId },
      data: {
        giftMessage: null,
      },
    });

    return apiResponse.success({ 
      message: "Gift message removed successfully"
    });
  } catch (error) {
    log.error("Failed to delete gift message:", error as Error);
    return apiResponse.serverError(error);
  }
}