import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { CollaborativeRegistryManager } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { decryptPII } from "~/lib/encryption.server";
import { authenticate } from "~/shopify.server";
import { validateRequest } from "~/lib/validation-unified.server";
import { verifyInvitationToken } from "~/lib/crypto-utils.server";
import crypto from "crypto";

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
    return json({ error: "Collaborator ID required" }, { status: 400 });
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
    return json({ error: "Unauthorized: Valid authentication or invitation token required" }, { status: 401 });
  }

  try {
    // Get invitation details
    const collaborator = await db.registryCollaborator.findUnique({
      where: { id: collaboratorId },
      include: {
        registry: {
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
            shop: {
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
      return json({ error: "Invitation not found" }, { status: 404 });
    }

    // SECURITY: Verify shop context if authenticated as admin
    if (shopId && collaborator.registry.shopId !== shopId) {
      log.warn("Cross-shop access attempt detected", {
        requestedShopId: collaborator.registry.shopId,
        authenticatedShopId: shopId,
        collaboratorId
      });
      return json({ error: "Access denied: Invalid shop context" }, { status: 403 });
    }

    // Check if invitation is still valid
    if (collaborator.status !== 'pending') {
      return json({ 
        error: "Invitation is no longer valid",
        status: collaborator.status 
      }, { status: 400 });
    }

    // Check if invitation has expired
    if (collaborator.expiresAt && collaborator.expiresAt < new Date()) {
      return json({ error: "Invitation has expired" }, { status: 400 });
    }

    return json({
      invitation: {
        id: collaborator.id,
        email: decryptPII(collaborator.email),
        role: collaborator.role,
        permissions: collaborator.permissions,
        invitedBy: collaborator.invitedBy,
        invitedAt: collaborator.invitedAt,
        expiresAt: collaborator.expiresAt,
        registry: {
          id: collaborator.registry.id,
          title: collaborator.registry.title,
          description: collaborator.registry.description,
          eventType: collaborator.registry.eventType,
          eventDate: collaborator.registry.eventDate,
          totalValue: collaborator.registry.totalValue,
          owner: {
            email: decryptPII(collaborator.registry.customerEmail),
            firstName: collaborator.registry.customerFirstName 
              ? decryptPII(collaborator.registry.customerFirstName) 
              : null,
            lastName: collaborator.registry.customerLastName 
              ? decryptPII(collaborator.registry.customerLastName) 
              : null
          },
          shop: {
            domain: collaborator.registry.shop.domain,
            name: collaborator.registry.shop.name
          }
        }
      }
    });
  } catch (error) {
    log.error("Failed to load invitation:", error as Error);
    return json({ error: "Failed to load invitation details" }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const collaboratorId = params.id;
  
  if (!collaboratorId) {
    return json({ error: "Collaborator ID required" }, { status: 400 });
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
    return json({ error: "Unauthorized: Valid authentication or invitation token required" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const acceptorEmail = formData.get("acceptorEmail") as string;
    const acceptorName = formData.get("acceptorName") as string;
    const action = formData.get("action") as string;

    if (!acceptorEmail) {
      return json({ error: "Acceptor email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(acceptorEmail)) {
      return json({ error: "Invalid email format" }, { status: 400 });
    }

    if (action === "accept") {
      // Accept the invitation
      const collaborator = await CollaborativeRegistryManager.acceptInvitation(
        collaboratorId,
        acceptorEmail,
        acceptorName
      );

      return json({
        success: true,
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
      await db.registryCollaborator.update({
        where: { id: collaboratorId },
        data: {
          status: 'revoked',
          updatedAt: new Date()
        }
      });

      // Track activity
      const collaborator = await db.registryCollaborator.findUnique({
        where: { id: collaboratorId },
        select: { registryId: true }
      });

      if (collaborator) {
        await CollaborativeRegistryManager.trackActivity({
          registryId: collaborator.registryId,
          actorEmail: acceptorEmail,
          actorName: acceptorName,
          action: 'collaborator_declined',
          description: `${acceptorName || acceptorEmail} declined collaboration invitation`,
          metadata: {
            collaboratorId,
            declinedBy: acceptorEmail
          }
        });
      }

      return json({
        success: true,
        message: "Invitation declined"
      });
    } else {
      return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process invitation";
    log.error("Failed to process invitation:", error as Error);
    return json({ error: message }, { status: 500 });
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
      throw new Error('Server configuration error: Missing required security secrets');
    }
    
    if (secret.length < 32) {
      log.error('CRITICAL SECURITY ERROR: Collaboration token secret too short', { 
        collaboratorId,
        secretLength: secret.length 
      });
      throw new Error('Server configuration error: Inadequate security configuration');
    }
    
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(collaboratorId)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      log.error('Invalid collaboration token signature', { collaboratorId });
      return null; // Invalid signature
    }
    
    const collaborator = await db.registryCollaborator.findUnique({
      where: { id: collaboratorId },
      include: {
        registry: {
          select: {
            id: true,
            title: true,
            description: true,
            customerEmail: true,
            customerFirstName: true,
            customerLastName: true,
            eventType: true,
            eventDate: true,
            shop: {
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

    return {
      id: collaborator.id,
      email: decryptPII(collaborator.email),
      role: collaborator.role,
      permissions: collaborator.permissions,
      status: collaborator.status,
      invitedBy: collaborator.invitedBy,
      invitedAt: collaborator.invitedAt,
      expiresAt: collaborator.expiresAt,
      registry: {
        id: collaborator.registry.id,
        title: collaborator.registry.title,
        description: collaborator.registry.description,
        eventType: collaborator.registry.eventType,
        eventDate: collaborator.registry.eventDate,
        owner: {
          email: decryptPII(collaborator.registry.customerEmail),
          firstName: collaborator.registry.customerFirstName 
            ? decryptPII(collaborator.registry.customerFirstName) 
            : null,
          lastName: collaborator.registry.customerLastName 
            ? decryptPII(collaborator.registry.customerLastName) 
            : null
        },
        shop: {
          domain: collaborator.registry.shop.domain,
          name: collaborator.registry.shop.name
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
    const collaborator = await db.registryCollaborator.findUnique({
      where: { id: collaboratorId },
      include: {
        registry: {
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