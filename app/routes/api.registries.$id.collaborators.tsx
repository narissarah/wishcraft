import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { CollaborativeRegistryManager, CollaboratorRole, CollaboratorPermission, CollaborationUtils } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { decryptPII } from "~/lib/crypto.server";
import { apiResponse } from "~/lib/api-response.server";

/**
 * SECURITY: Validate that admin has access to registry's shop
 */
async function validateRegistryAccess(registryId: string, adminShop: string) {
  const registry = await db.registries.findUnique({
    where: { id: registryId },
    select: { shopId: true, id: true }
  });

  if (!registry) {
    return { error: apiResponse.notFound("Registry"), registry: null };
  }

  if (adminShop !== registry.shopId) {
    log.error("Unauthorized registry access attempt", {
      adminShop,
      registryShop: registry.shopId,
      registryId
    });
    return { error: apiResponse.forbidden("Unauthorized access to registry"), registry: null };
  }

  return { error: null, registry };
}

/**
 * Registry Collaborators API
 * 
 * GET /api/registries/:id/collaborators - Get collaborators for registry
 * POST /api/registries/:id/collaborators - Invite new collaborator
 * PUT /api/registries/:id/collaborators/:collaboratorId - Update collaborator
 * DELETE /api/registries/:id/collaborators/:collaboratorId - Remove collaborator
 */

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  if (!admin) {
    return apiResponse.unauthorized();
  }

  const registryId = params.id;
  
  if (!registryId) {
    return apiResponse.validationError({ registryId: ["Registry ID is required"] });
  }

  try {
    // Get session to validate shop ownership
    const { session } = await authenticate.admin(request);
    if (!session || !session.shop) {
      return apiResponse.unauthorized();
    }

    // Get registry with shop validation to prevent cross-tenant access
    const registry = await db.registries.findFirst({
      where: { 
        id: registryId,
        shopId: session.shop  // SECURITY: Ensure registry belongs to authenticated shop
      },
      select: { 
        id: true, 
        title: true, 
        shopId: true,
        customerEmail: true, 
        metadata: true
      }
    });

    if (!registry) {
      return apiResponse.notFound("Registry");
    }

    // Get shop from session (already authenticated above)
    const adminShop = session.shop;
    
    // CRITICAL SECURITY FIX: Validate shop access
    if (adminShop !== registry.shopId) {
      log.error("Unauthorized access attempt to registry", {
        adminShop: adminShop,
        registryShop: registry.shopId,
        registryId,
        sessionId: session.id
      });
      return apiResponse.forbidden("Unauthorized access to registry");
    }

    // Parse metadata to check collaboration settings
    const metadata = registry.metadata ? JSON.parse(registry.metadata) : {};
    const collaborationEnabled = metadata.collaborationEnabled || false;
    
    if (!collaborationEnabled) {
      return apiResponse.error("COLLABORATION_DISABLED", "Collaboration not enabled for this registry", 400);
    }

    // Get collaborators
    const collaborators = await CollaborativeRegistryManager.getCollaborators(registryId);

    // Get activity feed
    const activities = await CollaborativeRegistryManager.getActivityFeed(registryId, 10);

    return apiResponse.success({
      registries: {
        id: registry.id,
        title: registry.title,
        ownerEmail: decryptPII(registry.customerEmail),
        collaborationEnabled: metadata.collaborationEnabled || false,
        collaborationSettings: metadata.collaborationSettings || {}
      },
      collaborators: collaborators.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name,
        role: c.role,
        permissions: c.permissions,
        status: c.status,
        invitedAt: c.invitedAt,
        acceptedAt: c.acceptedAt,
        expiresAt: c.inviteExpiresAt,
        roleDisplayName: CollaborationUtils.getRoleDisplayName(c.role as CollaboratorRole),
        permissionDisplayName: CollaborationUtils.getPermissionDisplayName(c.permissions as CollaboratorPermission)
      })),
      activities: activities.map(a => ({
        id: a.id,
        actorEmail: a.actorEmail,
        actorName: a.actorName,
        action: a.type, // type maps to action
        description: a.description,
        metadata: a.metadata,
        createdAt: a.createdAt
      }))
    });
  } catch (error) {
    log.error("Failed to load collaborators:", error as Error);
    return apiResponse.serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  if (!admin) {
    return apiResponse.unauthorized();
  }

  const registryId = params.id;
  const method = request.method;
  
  if (!registryId) {
    return apiResponse.validationError({ registryId: ["Registry ID is required"] });
  }

  // CRITICAL SECURITY: Validate registry access before any operations
  const { session } = await authenticate.admin(request);
  const { error: accessError } = await validateRegistryAccess(registryId, session.shop);
  if (accessError) {
    return accessError;
  }

  if (method === "POST") {
    return handleInviteCollaborator(request, registryId, session.shop);
  } else if (method === "PUT") {
    return handleUpdateCollaborator(request, registryId, session.shop);
  } else if (method === "DELETE") {
    return handleRemoveCollaborator(request, registryId, session.shop);
  } else {
    return apiResponse.error("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }
}

/**
 * Invite new collaborator
 */
async function handleInviteCollaborator(request: Request, registryId: string, adminShop: string) {
  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const role = formData.get("role") as CollaboratorRole;
    const permissions = formData.get("permissions") as CollaboratorPermission;
    const message = formData.get("message") as string;
    const invitedBy = formData.get("invitedBy") as string;

    if (!email || !role || !permissions || !invitedBy) {
      return apiResponse.validationError({
        email: !email ? ["Email is required"] : [],
        role: !role ? ["Role is required"] : [],
        permissions: !permissions ? ["Permissions are required"] : [],
        invitedBy: !invitedBy ? ["InvitedBy is required"] : []
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiResponse.validationError({ email: ["Invalid email format"] });
    }

    // Validate role and permissions
    if (!Object.values(CollaboratorRole).includes(role)) {
      return apiResponse.validationError({ role: ["Invalid role"] });
    }

    if (!Object.values(CollaboratorPermission).includes(permissions)) {
      return apiResponse.validationError({ permissions: ["Invalid permissions"] });
    }

    // Check if user has permission to invite
    const hasPermission = await CollaborativeRegistryManager.checkPermission(
      registryId,
      invitedBy,
      CollaboratorPermission.ADMIN
    );

    if (!hasPermission) {
      return apiResponse.forbidden("You don't have permission to invite collaborators");
    }

    // Invite collaborator
    const collaborator = await CollaborativeRegistryManager.inviteCollaborator({
      registryId,
      email,
      role: role as "viewer" | "editor", // Cast to expected schema type
      addedBy: invitedBy
    });

    return apiResponse.created({
      message: "Collaborator invited successfully",
      collaborator: {
        id: collaborator.id,
        email: email,
        role: collaborator.role,
        permissions: collaborator.permissions,
        status: collaborator.status,
        invitedAt: collaborator.invitedAt,
        expiresAt: collaborator.inviteExpiresAt
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite collaborator";
    log.error("Failed to invite collaborator:", error as Error);
    return apiResponse.serverError(error);
  }
}

/**
 * Update collaborator role/permissions
 */
async function handleUpdateCollaborator(request: Request, registryId: string, adminShop: string) {
  try {
    const url = new URL(request.url);
    const collaboratorId = url.searchParams.get("collaboratorId");
    const formData = await request.formData();
    const role = formData.get("role") as CollaboratorRole;
    const permissions = formData.get("permissions") as CollaboratorPermission;
    const updatedBy = formData.get("updatedBy") as string;

    if (!collaboratorId || !role || !permissions || !updatedBy) {
      return apiResponse.validationError({
        collaboratorId: !collaboratorId ? ["Collaborator ID is required"] : [],
        role: !role ? ["Role is required"] : [],
        permissions: !permissions ? ["Permissions are required"] : [],
        updatedBy: !updatedBy ? ["UpdatedBy is required"] : []
      });
    }

    // Check if user has permission to update
    const hasPermission = await CollaborativeRegistryManager.checkPermission(
      registryId,
      updatedBy,
      CollaboratorPermission.ADMIN
    );

    if (!hasPermission) {
      return apiResponse.forbidden("You don't have permission to update collaborators");
    }

    // Update collaborator
    const collaborator = await db.registry_collaborators.update({
      where: { id: collaboratorId },
      data: {
        role,
        permissions,
        updatedAt: new Date()
      }
    });

    // Track activity
    await CollaborativeRegistryManager.trackActivity({
      registryId,
      actorEmail: updatedBy,
      action: 'collaborator_updated',
      metadata: {
        collaboratorId,
        oldRole: collaborator.role,
        newRole: role,
        oldPermissions: collaborator.permissions,
        newPermissions: permissions
      }
    });

    return apiResponse.success({
      message: "Collaborator updated successfully",
      collaborator: {
        id: collaborator.id,
        role: collaborator.role,
        permissions: collaborator.permissions,
        updatedAt: collaborator.updatedAt
      }
    });
  } catch (error) {
    log.error("Failed to update collaborator:", error as Error);
    return apiResponse.serverError(error);
  }
}

/**
 * Remove collaborator
 */
async function handleRemoveCollaborator(request: Request, registryId: string, adminShop: string) {
  try {
    const url = new URL(request.url);
    const collaboratorId = url.searchParams.get("collaboratorId");
    const removedBy = url.searchParams.get("removedBy");

    if (!collaboratorId || !removedBy) {
      return apiResponse.validationError({
        collaboratorId: !collaboratorId ? ["Collaborator ID is required"] : [],
        removedBy: !removedBy ? ["RemovedBy is required"] : []
      });
    }

    // Check if user has permission to remove
    const hasPermission = await CollaborativeRegistryManager.checkPermission(
      registryId,
      removedBy,
      CollaboratorPermission.ADMIN
    );

    if (!hasPermission) {
      return apiResponse.forbidden("You don't have permission to remove collaborators");
    }

    // Remove collaborator
    await CollaborativeRegistryManager.removeCollaborator(registryId, collaboratorId);

    return apiResponse.success({
      message: "Collaborator removed successfully"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove collaborator";
    log.error("Failed to remove collaborator:", error as Error);
    return apiResponse.serverError(error);
  }
}