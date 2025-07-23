/**
 * Simplified Gift Messages API
 * Direct operations without excessive validation abstraction
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAdmin } from "~/lib/auth.server";
import { encrypt, decrypt } from "~/lib/crypto.server";
import { sanitizeString } from "~/lib/validation.server";
import { db } from "~/lib/db.server";
import crypto from "crypto";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await requireAdmin(request);
  
  const url = new URL(request.url);
  const purchaseId = url.searchParams.get("purchaseId");
  
  if (!purchaseId) {
    throw new Response("Purchase ID is required", { status: 400 });
  }

  // Get purchase with gift message
  const purchase = await db.registry_purchases.findUnique({
    where: { id: purchaseId },
    include: {
      registry_items: {
        include: {
          registries: {
            select: {
              id: true,
              shopId: true,
            },
          },
        },
      },
    },
  });

  if (!purchase) {
    throw new Response("Purchase not found", { status: 404 });
  }

  // Verify shop access
  const registryShop = purchase.registry_items?.registries?.shopId;
  if (registryShop !== session.shop) {
    throw new Response("Access denied", { status: 403 });
  }

  // Get gift message (stored as plain text in this schema)
  const giftMessage = purchase.giftMessage || null;

  return json({
    purchaseId: purchase.id,
    giftMessage,
    hasGiftMessage: !!purchase.giftMessage,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await requireAdmin(request);
  const method = request.method;
  
  const formData = await request.formData();
  
  switch (method) {
    case "POST":
    case "PUT": {
      const purchaseId = formData.get("purchaseId") as string;
      const message = formData.get("message") as string;
      
      if (!purchaseId) {
        throw new Response("Purchase ID is required", { status: 400 });
      }

      // Get purchase to verify access
      const purchase = await db.registry_purchases.findUnique({
        where: { id: purchaseId },
        include: {
          registry_items: {
            include: {
              registries: {
                select: { shopId: true },
              },
            },
          },
        },
      });

      if (!purchase) {
        throw new Response("Purchase not found", { status: 404 });
      }

      const registryShop = purchase.registry_items?.registries?.shopId;
      if (registryShop !== session.shop) {
        throw new Response("Access denied", { status: 403 });
      }

      // Sanitize and save message
      let sanitizedMessage = null;
      if (message && message.trim()) {
        sanitizedMessage = sanitizeString(message);
      }

      const updatedPurchase = await db.registry_purchases.update({
        where: { id: purchaseId },
        data: {
          giftMessage: sanitizedMessage,
          updatedAt: new Date(),
        },
      });

      return json({
        success: true,
        purchaseId: updatedPurchase.id,
        hasGiftMessage: !!sanitizedMessage,
      });
    }
    
    case "DELETE": {
      const purchaseId = formData.get("purchaseId") as string;
      
      if (!purchaseId) {
        throw new Response("Purchase ID is required", { status: 400 });
      }

      // Verify access and remove gift message
      const purchase = await db.registry_purchases.findUnique({
        where: { id: purchaseId },
        include: {
          registry_items: {
            include: {
              registries: {
                select: { shopId: true },
              },
            },
          },
        },
      });

      if (!purchase) {
        throw new Response("Purchase not found", { status: 404 });
      }

      const registryShop = purchase.registry_items?.registries?.shopId;
      if (registryShop !== session.shop) {
        throw new Response("Access denied", { status: 403 });
      }

      await db.registry_purchases.update({
        where: { id: purchaseId },
        data: {
          giftMessage: null,
          updatedAt: new Date(),
        },
      });

      return json({ success: true });
    }
    
    default:
      throw new Response("Method not allowed", { status: 405 });
  }
}