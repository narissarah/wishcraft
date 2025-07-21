import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { CollaborativeRegistryManager, CollaboratorRole, CollaboratorPermission, CollaborationUtils } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { decryptPII } from "~/lib/encryption.server";

/**
 * SECURITY: Validate that admin has access to registry's shop
 */
async function validateRegistryAccess(registryId: string, adminShop: string) {
  const registry = await db.registry.findUnique({
    where: { id: registryId },
    select: { shopId: true, id: true }
  });

  if (!registry) {
    return { error: json({ error: "Registry not found" }, { status: 404 }), registry: null };
  }

  if (adminShop !== registry.shopId) {
    log.error("Unauthorized registry access attempt", {
      adminShop,
      registryShop: registry.shopId,
      registryId
    });
    return { error: json({ error: "Unauthorized access to registry" }, { status: 403 }), registry: null };
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
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const registryId = params.id;
  
  if (!registryId) {
    return json({ error: "Registry ID required" }, { status: 400 });
  }

  try {
    // Get registry to verify ownership/access
    const registry = await db.registry.findUnique({
      where: { id: registryId },
      select: { 
        id: true, 
        title: true, 
        shopId: true,   // CRITICAL: Add shop validation
        customerEmail: true, 
        collaborationEnabled: true,
        collaborationSettings: true,
        metadata: true   // CRITICAL: Fix undefined metadata
      }
    });

    if (!registry) {
      return json({ error: "Registry not found" }, { status: 404 });
    }

    // CRITICAL SECURITY FIX: Validate shop access
    if (admin.shop !== registry.shopId) {
      log.error("Unauthorized access attempt to registry", {
        adminShop: admin.shop,
        registryShop: registry.shopId,
        registryId,
        adminSession: admin.session?.id
      });
      return json({ error: "Unauthorized access to registry" }, { status: 403 });
    }

    if (!registry.collaborationEnabled) {
      return json({ error: "Collaboration not enabled for this registry" }, { status: 400 });
    }

    // Get collaborators
    const collaborators = await CollaborativeRegistryManager.getCollaborators(registryId);

    // Get activity feed
    const activities = await CollaborativeRegistryManager.getActivityFeed(registryId, 10);

    // Parse metadata safely
    const metadata = registry.metadata ? JSON.parse(registry.metadata) : {};

    return json({
      registry: {
        id: registry.id,
        title: registry.title,
        ownerEmail: decryptPII(registry.customerEmail),
        collaborationEnabled: registry.collaborationEnabled,
        collaborationSettings: registry.collaborationSettings || metadata.collaborationSettings || {}
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
        action: a.action,
        description: a.description,
        metadata: a.metadata,
        isSystem: a.isSystem,
        createdAt: a.createdAt
      }))
    });
  } catch (error) {
    log.error("Failed to load collaborators:", error as Error);
    return json({ error: "Failed to load collaborators" }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  if (!admin) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const registryId = params.id;
  const method = request.method;
  
  if (!registryId) {
    return json({ error: "Registry ID required" }, { status: 400 });
  }

  // CRITICAL SECURITY: Validate registry access before any operations
  const { error: accessError } = await validateRegistryAccess(registryId, admin.shop);
  if (accessError) {
    return accessError;
  }

  if (method === "POST") {
    return handleInviteCollaborator(request, registryId, admin.shop);
  } else if (method === "PUT") {
    return handleUpdateCollaborator(request, registryId, admin.shop);
  } else if (method === "DELETE") {
    return handleRemoveCollaborator(request, registryId, admin.shop);
  } else {
    return json({ error: "Method not allowed" }, { status: 405 });
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
      return json({ error: "Email, role, permissions, and invitedBy are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ error: "Invalid email format" }, { status: 400 });
    }

    // Validate role and permissions
    if (!Object.values(CollaboratorRole).includes(role)) {
      return json({ error: "Invalid role" }, { status: 400 });
    }

    if (!Object.values(CollaboratorPermission).includes(permissions)) {
      return json({ error: "Invalid permissions" }, { status: 400 });
    }

    // Check if user has permission to invite
    const hasPermission = await CollaborativeRegistryManager.checkPermission(
      registryId,
      invitedBy,
      CollaboratorPermission.ADMIN
    );

    if (!hasPermission) {
      return json({ error: "You don't have permission to invite collaborators" }, { status: 403 });
    }

    // Invite collaborator
    const collaborator = await CollaborativeRegistryManager.inviteCollaborator({
      registryId,
      email,
      role,
      permissions,
      invitedBy,
      message
    });

    return json({
      success: true,
      message: "Collaborator invited successfully",
      collaborator: {
        id: collaborator.id,
        email: email,
        role: collaborator.role,
        permissions: collaborator.permissions,
        status: collaborator.status,
        invitedAt: collaborator.invitedAt,
        expiresAt: collaborator.expiresAt
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite collaborator";
    log.error("Failed to invite collaborator:", error as Error);
    return json({ error: message }, { status: 500 });
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
      return json({ error: "Collaborator ID, role, permissions, and updatedBy are required" }, { status: 400 });
    }

    // Check if user has permission to update
    const hasPermission = await CollaborativeRegistryManager.checkPermission(
      registryId,
      updatedBy,
      CollaboratorPermission.ADMIN
    );

    if (!hasPermission) {
      return json({ error: "You don't have permission to update collaborators" }, { status: 403 });
    }

    // Update collaborator
    const collaborator = await db.registryCollaborator.update({
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
      description: `Updated collaborator permissions for ${decryptPII(collaborator.email)}`,
      metadata: {
        collaboratorId,
        oldRole: collaborator.role,
        newRole: role,
        oldPermissions: collaborator.permissions,
        newPermissions: permissions
      }
    });

    return json({
      success: true,
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
    return json({ error: "Failed to update collaborator" }, { status: 500 });
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
      return json({ error: "Collaborator ID and removedBy are required" }, { status: 400 });
    }

    // Check if user has permission to remove
    const hasPermission = await CollaborativeRegistryManager.checkPermission(
      registryId,
      removedBy,
      CollaboratorPermission.ADMIN
    );

    if (!hasPermission) {
      return json({ error: "You don't have permission to remove collaborators" }, { status: 403 });
    }

    // Remove collaborator
    await CollaborativeRegistryManager.removeCollaborator(registryId, collaboratorId, removedBy);

    return json({
      success: true,
      message: "Collaborator removed successfully"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove collaborator";
    log.error("Failed to remove collaborator:", error as Error);
    return json({ error: message }, { status: 500 });
  }
}