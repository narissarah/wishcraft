import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { acceptInvitation, declineInvitation } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { decryptPII } from "~/lib/crypto.server";
import { verifyInvitationToken } from "~/lib/crypto.server";
import { apiResponse } from "~/lib/api-response.server";
import { log } from "~/lib/logger.server";

/**
 * Simplified Collaboration Invitation Handler
 * GET - View invitation details
 * POST - Accept/decline invitation
 */

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
  const collaboratorId = params.id;
  if (!collaboratorId) {
    return apiResponse.validationError({ id: ["ID required"] });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  const validation = await validateInvitation(collaboratorId, token);
  if (!validation.valid || !validation.collaborator) {
    return apiResponse.error("INVALID_INVITATION", validation.error!, 400);
  }

  const collaborator = validation.collaborator;
  const registry = collaborator.registries;

  // Decrypt PII for display
  const decryptedEmail = decryptPII(collaborator.email);
  const customerEmail = registry.customerEmail ? decryptPII(registry.customerEmail) : null;

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
}

export async function action({ request, params }: ActionFunctionArgs) {
  const collaboratorId = params.id;
  if (!collaboratorId) {
    return apiResponse.validationError({ id: ["ID required"] });
  }

  const formData = await request.formData();
  const action = formData.get("action");
  const token = formData.get("token") as string;
  const name = formData.get("name") as string;

  if (!action || !["accept", "decline"].includes(action as string)) {
    return apiResponse.validationError({ action: ["Invalid action"] });
  }

  const validation = await validateInvitation(collaboratorId, token);
  if (!validation.valid || !validation.collaborator) {
    return apiResponse.error("INVALID_INVITATION", validation.error!, 400);
  }

  const collaborator = validation.collaborator;

  try {
    if (action === "accept") {
      await acceptInvitation({ collaboratorId, token, name });
      return apiResponse.success({
        message: "Invitation accepted",
        redirectUrl: `/app/registries/${collaborator.registryId}`
      });
    } else {
      await declineInvitation(collaboratorId, token);
      return apiResponse.success({ message: "Invitation declined" });
    }
  } catch (error) {
    log.error("Error processing invitation:", error);
    return apiResponse.serverError();
  }
}