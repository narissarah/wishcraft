import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { acceptInvitation, declineInvitation } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { decrypt, verifyInvitationToken } from "~/lib/crypto.server";
import { log } from "~/lib/logger.server";
import { requireCSRFToken } from "~/lib/csrf.server";

async function validateInvitation(collaboratorId: string, token: string | null) {
  if (!token) {
    return { valid: false, error: "Token required" };
  }

  const tokenData = verifyInvitationToken(token);
  if (!tokenData.valid || tokenData.collaboratorId !== collaboratorId) {
    return { valid: false, error: "Invalid token" };
  }

  const collaborator = await db.registry_collaborators.findUnique({
    where: { id: collaboratorId },
    include: {
      registries: {
        include: {
          shops: {
            select: { domain: true, name: true }
          }
        }
      }
    }
  });

  if (!collaborator) {
    return { valid: false, error: "Invitation not found" };
  }

  if (collaborator.status !== 'pending') {
    return { valid: false, error: `Invitation already ${collaborator.status}` };
  }

  return { valid: true, collaborator };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const collaboratorId = params.id;
    if (!collaboratorId) {
      return json({ success: false, error: "ID required" }, { status: 400 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    const validation = await validateInvitation(collaboratorId, token);
    if (!validation.valid || !validation.collaborator) {
      return json({ success: false, error: validation.error! }, { status: 400 });
    }

    const collaborator = validation.collaborator;
    const registry = collaborator.registries;

    const decryptedEmail = decrypt(collaborator.email);
    const customerEmail = registry.customerEmail ? decrypt(registry.customerEmail) : null;

    return json({
      success: true,
      data: {
        invitation: {
          id: collaborator.id,
          email: decryptedEmail,
          role: collaborator.role,
          status: collaborator.status,
          invitedAt: collaborator.invitedAt
        },
        registry: {
          id: registry.id,
          title: registry.title,
          description: registry.description,
          eventType: registry.eventType,
          eventDate: registry.eventDate,
          shop: {
            name: registry.shops.name,
            domain: registry.shops.domain
          },
          owner: {
            email: customerEmail,
            firstName: registry.customerFirstName,
            lastName: registry.customerLastName
          }
        }
      }
    });
  } catch (error) {
    log.error("Collaborate loader error:", error);
    return json({ 
      success: false, 
      error: "An error occurred loading invitation data" 
    }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // Validate CSRF token for all mutations
    await requireCSRFToken(request);
    
    const collaboratorId = params.id;
    if (!collaboratorId) {
      return json({ success: false, error: "ID required" }, { status: 400 });
    }

    const formData = await request.formData();
    const action = formData.get("action");
    const token = formData.get("token") as string | null;
    
    if (!token) {
      return json({ success: false, error: "Token is required" }, { status: 400 });
    }

    if (!action || !["accept", "decline"].includes(action as string)) {
      return json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const validation = await validateInvitation(collaboratorId, token);
    if (!validation.valid || !validation.collaborator) {
      return json({ success: false, error: validation.error! }, { status: 400 });
    }

    const collaborator = validation.collaborator;

    if (action === "accept") {
      await acceptInvitation(collaboratorId, collaborator.registries.shopId);
      return json({
        success: true,
        message: "Invitation accepted",
        redirectUrl: `/app/registries/${collaborator.registryId}`
      });
    } else {
      await declineInvitation(collaboratorId, collaborator.registries.shopId);
      return json({ success: true, message: "Invitation declined" });
    }
  } catch (error) {
    log.error("Error processing invitation:", error);
    return json({ success: false, error: "An error occurred processing your request" }, { status: 500 });
  }
}