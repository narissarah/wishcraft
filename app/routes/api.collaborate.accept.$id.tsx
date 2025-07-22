import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { CollaborativeRegistryManager } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { decryptPII } from "~/lib/crypto.server";
import { authenticate } from "~/shopify.server";
import { withValidation } from "~/lib/validation.server";
import { verifyInvitationToken } from "~/lib/crypto.server";
import crypto from "crypto";
import { apiResponse } from "~/lib/api-response.server";

/**
 * Collaboration Invitation Acceptance API
 * 
 * SECURITY: This endpoint requires either:
 * 1. Valid Shopify admin authentication (for admins)
 * 2. Valid invitation token (for external collaborators)
 * 
 * GET /api/collaborate/accept/:id - Get invitation details
 * POST /api/collaborate/accept/:id - Accept invitation
 */

export async function loader({ request, params }: LoaderFunctionArgs) {
  const collaboratorId = params.id;
  
  if (!collaboratorId) {
    return apiResponse.validationError({ collaboratorId: ["Collaborator ID is required"] });
  }

  // SECURITY: Validate request and check authentication
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  let isAuthenticated = false;
  let shopId: string | null = null;
  
  try {
    // Try admin authentication first
    const { admin, session } = await authenticate.admin(request);
    if (admin && session) {
      isAuthenticated = true;
      shopId = session.shop;
    }
  } catch {
    // Not authenticated as admin, check for valid invitation token
    if (token) {
      const tokenData = await verifyInvitationToken(token, collaboratorId);
      if (tokenData && tokenData.valid) {
        isAuthenticated = true;
      }
    }
  }
  
  if (!isAuthenticated) {
    return apiResponse.unauthorized("Valid authentication or invitation token required");
  }

  try {
    // Get invitation details
    const collaborator = await db.registry_collaborators.findUnique({
      where: { id: collaboratorId },
      include: {
        registries: {
          select: {
            id: true,
            title: true,
            description: true,
            customerEmail: true,
            customerFirstName: true,
            customerLastName: true,
            eventType: true,
            eventDate: true,
            totalValue: true,
            shopId: true,
            shops: {
              select: {
                domain: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!collaborator) {
      return apiResponse.notFound("Invitation");
    }

    // SECURITY: Verify shop context if authenticated as admin
    if (shopId && collaborator.registries.shopId !== shopId) {
      log.warn("Cross-shop access attempt detected", {
        requestedShopId: collaborator.registries.shopId,
        authenticatedShopId: shopId,
        collaboratorId
      });
      return apiResponse.forbidden("Access denied: Invalid shop context");
    }

    // Check if invitation is still valid
    if (collaborator.status !== 'pending') {
      return apiResponse.error(
        "INVALID_INVITATION",
        "Invitation is no longer valid",
        400,
        { status: [collaborator.status] }
      );
    }

    // Check if invitation has expired (using createdAt + 7 days)
    const expiryDate = new Date(collaborator.createdAt);
    expiryDate.setDate(expiryDate.getDate() + 7);
    if (expiryDate < new Date()) {
      return apiResponse.error("EXPIRED_INVITATION", "Invitation has expired", 400);
    }

    return apiResponse.success({
      invitation: {
        id: collaborator.id,
        email: decryptPII(collaborator.email),
        role: collaborator.role,
        permissions: collaborator.permissions,
        invitedBy: "system", // Not stored in current schema
        invitedAt: collaborator.invitedAt,
        expiresAt: expiryDate,
        registries: {
          id: collaborator.registries.id,
          title: collaborator.registries.title,
          description: collaborator.registries.description,
          eventType: collaborator.registries.eventType,
          eventDate: collaborator.registries.eventDate,
          totalValue: collaborator.registries.totalValue,
          owner: {
            email: decryptPII(collaborator.registries.customerEmail),
            firstName: collaborator.registries.customerFirstName 
              ? decryptPII(collaborator.registries.customerFirstName) 
              : null,
            lastName: collaborator.registries.customerLastName 
              ? decryptPII(collaborator.registries.customerLastName) 
              : null
          },
          shop: {
            domain: collaborator.registries.shops.domain,
            name: collaborator.registries.shops.name
          }
        }
      }
    });
  } catch (error) {
    log.error("Failed to load invitation:", error as Error);
    return apiResponse.serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const collaboratorId = params.id;
  
  if (!collaboratorId) {
    return apiResponse.validationError({ collaboratorId: ["Collaborator ID is required"] });
  }

  // SECURITY: Validate request and check authentication
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  let isAuthenticated = false;
  let authenticatedShopId: string | null = null;
  
  try {
    // Try admin authentication first
    const { admin, session } = await authenticate.admin(request);
    if (admin && session) {
      isAuthenticated = true;
      authenticatedShopId = session.shop;
    }
  } catch {
    // Not authenticated as admin, check for valid invitation token
    if (token) {
      const tokenData = await verifyInvitationToken(token, collaboratorId);
      if (tokenData && tokenData.valid) {
        isAuthenticated = true;
      }
    }
  }
  
  if (!isAuthenticated) {
    return apiResponse.unauthorized("Valid authentication or invitation token required");
  }

  try {
    const formData = await request.formData();
    const acceptorEmail = formData.get("acceptorEmail") as string;
    const acceptorName = formData.get("acceptorName") as string;
    const action = formData.get("action") as string;

    if (!acceptorEmail) {
      return apiResponse.validationError({ acceptorEmail: ["Acceptor email is required"] });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(acceptorEmail)) {
      return apiResponse.validationError({ acceptorEmail: ["Invalid email format"] });
    }

    if (action === "accept") {
      // Accept the invitation
      const collaborator = await CollaborativeRegistryManager.acceptInvitation(
        collaboratorId,
        acceptorEmail
      );

      return apiResponse.success({
        message: "Invitation accepted successfully",
        collaborator: {
          id: collaborator.id,
          registryId: collaborator.registryId,
          role: collaborator.role,
          permissions: collaborator.permissions,
          acceptedAt: collaborator.acceptedAt
        },
        redirectUrl: `/app/registries/${collaborator.registryId}`
      });
    } else if (action === "decline") {
      // Decline the invitation
      await db.registry_collaborators.update({
        where: { id: collaboratorId },
        data: {
          status: 'revoked',
          updatedAt: new Date()
        }
      });

      // Track activity
      const collaborator = await db.registry_collaborators.findUnique({
        where: { id: collaboratorId },
        select: { registryId: true }
      });

      if (collaborator) {
        await CollaborativeRegistryManager.trackActivity({
          registryId: collaborator.registryId,
          actorEmail: acceptorEmail,
          actorName: acceptorName,
          action: 'collaborator_declined',
          metadata: {
            collaboratorId,
            declinedBy: acceptorEmail
          }
        });
      }

      return apiResponse.success({
        message: "Invitation declined"
      });
    } else {
      return apiResponse.validationError({ action: ["Invalid action"] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process invitation";
    log.error("Failed to process invitation:", error as Error);
    return apiResponse.serverError(error);
  }
}

/**
 * Get invitation by token (for public access)
 */
export async function getInvitationByToken(token: string) {
  try {
    // SECURITY FIX: Use proper cryptographic token verification
    // Token format: base64url(collaboratorId.signature)
    const [collaboratorId, signature] = token.split('.');
    
    if (!collaboratorId || !signature) {
      return null; // Invalid token format
    }
    
    // SECURITY FIX: Verify the token signature with proper secret validation
    const secret = process.env.COLLABORATION_TOKEN_SECRET || process.env.SESSION_SECRET;
    
    if (!secret) {
      log.error('CRITICAL SECURITY ERROR: No collaboration token secret available', { collaboratorId });
      // SECURITY FIX: Don't expose server configuration details in error messages
      throw new Error('Authentication failed');
    }
    
    if (secret.length < 32) {
      log.error('CRITICAL SECURITY ERROR: Collaboration token secret too short', { 
        collaboratorId,
        secretLength: secret.length 
      });
      // SECURITY FIX: Don't expose server configuration details in error messages
      throw new Error('Authentication failed');
    }
    
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(collaboratorId)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      log.error('Invalid collaboration token signature', { collaboratorId });
      return null; // Invalid signature
    }
    
    const collaborator = await db.registry_collaborators.findUnique({
      where: { id: collaboratorId },
      include: {
        registries: {
          select: {
            id: true,
            title: true,
            description: true,
            customerEmail: true,
            customerFirstName: true,
            customerLastName: true,
            eventType: true,
            eventDate: true,
            shops: {
              select: {
                domain: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!collaborator) {
      return null;
    }

    // Calculate expiry date (7 days from invitation date)
    const expiryDate = new Date(collaborator.invitedAt);
    expiryDate.setDate(expiryDate.getDate() + 7);

    return {
      id: collaborator.id,
      email: decryptPII(collaborator.email),
      role: collaborator.role,
      permissions: collaborator.permissions,
      status: collaborator.status,
      invitedBy: "system", // Not stored in current schema
      invitedAt: collaborator.invitedAt,
      expiresAt: expiryDate,
      registries: {
        id: collaborator.registries.id,
        title: collaborator.registries.title,
        description: collaborator.registries.description,
        eventType: collaborator.registries.eventType,
        eventDate: collaborator.registries.eventDate,
        owner: {
          email: decryptPII(collaborator.registries.customerEmail),
          firstName: collaborator.registries.customerFirstName 
            ? decryptPII(collaborator.registries.customerFirstName) 
            : null,
          lastName: collaborator.registries.customerLastName 
            ? decryptPII(collaborator.registries.customerLastName) 
            : null
        },
        shop: {
          domain: collaborator.registries.shops.domain,
          name: collaborator.registries.shops.name
        }
      }
    };
  } catch (error) {
    log.error("Failed to get invitation by token:", error as Error);
    return null;
  }
}

/**
 * Send invitation reminder
 */
export async function sendInvitationReminder(collaboratorId: string) {
  try {
    const collaborator = await db.registry_collaborators.findUnique({
      where: { id: collaboratorId },
      include: {
        registries: {
          select: {
            id: true,
            title: true,
            shopId: true,
            customerId: true
          }
        }
      }
    });

    if (!collaborator || collaborator.status !== 'pending') {
      return false;
    }

    // Send reminder notification
    // This would integrate with your notification system
    
    return true;
  } catch (error) {
    log.error("Failed to send invitation reminder:", error as Error);
    return false;
  }
}