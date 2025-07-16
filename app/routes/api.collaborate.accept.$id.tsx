import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { CollaborativeRegistryManager } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { decryptPII } from "~/lib/encryption.server";

/**
 * Collaboration Invitation Acceptance API
 * 
 * GET /api/collaborate/accept/:id - Get invitation details
 * POST /api/collaborate/accept/:id - Accept invitation
 */

export async function loader({ request, params }: LoaderFunctionArgs) {
  const collaboratorId = params.id;
  
  if (!collaboratorId) {
    return json({ error: "Collaborator ID required" }, { status: 400 });
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
    // In a real implementation, you'd use a signed token
    // For now, we'll use the collaborator ID directly
    const collaborator = await db.registryCollaborator.findUnique({
      where: { id: token },
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