/**
 * Collaborative Registry Management
 * Handles invitations, permissions, and activity tracking for collaborative registries
 */

import { db } from './db.server';
import { log } from './logger.server';
import { cache, cacheKeys } from './cache-unified.server';
import { encryptPII, decryptPII } from './encryption.server';
import { notificationManager, NotificationTemplates } from './notifications.server';
import type { Registry, RegistryCollaborator, RegistryActivity, Prisma } from '@prisma/client';

/**
 * Collaboration enums and types
 */
export enum CollaboratorRole {
  OWNER = 'owner',
  COLLABORATOR = 'collaborator',
  VIEWER = 'viewer'
}

export enum CollaboratorPermission {
  READ_ONLY = 'read_only',
  READ_WRITE = 'read_write',
  ADMIN = 'admin'
}

export enum CollaboratorStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REVOKED = 'revoked'
}

export enum ActivityAction {
  ITEM_ADDED = 'item_added',
  ITEM_REMOVED = 'item_removed',
  ITEM_UPDATED = 'item_updated',
  COLLABORATOR_INVITED = 'collaborator_invited',
  COLLABORATOR_ACCEPTED = 'collaborator_accepted',
  COLLABORATOR_REMOVED = 'collaborator_removed',
  REGISTRY_UPDATED = 'registry_updated',
  ITEM_PURCHASED = 'item_purchased',
  SETTINGS_UPDATED = 'settings_updated'
}

export interface CollaborationSettings {
  maxCollaborators: number;
  allowPublicInvites: boolean;
  requireApproval: boolean;
  autoExpireInvites: boolean;
  expireInvitesAfterDays: number;
}

export interface InviteCollaboratorInput {
  registryId: string;
  email: string;
  role: CollaboratorRole;
  permissions: CollaboratorPermission;
  invitedBy: string;
  message?: string;
}

export interface ActivityInput {
  registryId: string;
  actorEmail: string;
  actorName?: string;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, any>;
  isSystem?: boolean;
}

/**
 * Collaborative Registry Manager
 */
export class CollaborativeRegistryManager {
  /**
   * Enable collaboration for a registry
   */
  static async enableCollaboration(
    registryId: string,
    settings: Partial<CollaborationSettings> = {}
  ): Promise<Registry> {
    const defaultSettings: CollaborationSettings = {
      maxCollaborators: 10,
      allowPublicInvites: false,
      requireApproval: true,
      autoExpireInvites: true,
      expireInvitesAfterDays: 7
    };

    const collaborationSettings = { ...defaultSettings, ...settings };

    const registry = await db.registry.update({
      where: { id: registryId },
      data: {
        collaborationEnabled: true,
        collaborationSettings: collaborationSettings as any
      }
    });

    // Track activity
    await this.trackActivity({
      registryId,
      actorEmail: registry.customerEmail,
      actorName: registry.customerFirstName || 'Registry Owner',
      action: ActivityAction.SETTINGS_UPDATED,
      description: 'Enabled collaboration for registry',
      metadata: { collaborationSettings },
      isSystem: false
    });

    // Clear cache
    await this.clearRegistryCache(registryId);

    return registry;
  }

  /**
   * Disable collaboration for a registry
   */
  static async disableCollaboration(registryId: string): Promise<Registry> {
    // Remove all collaborators first
    await db.registryCollaborator.deleteMany({
      where: { registryId }
    });

    const registry = await db.registry.update({
      where: { id: registryId },
      data: {
        collaborationEnabled: false,
        collaborationSettings: null
      }
    });

    // Track activity
    await this.trackActivity({
      registryId,
      actorEmail: registry.customerEmail,
      actorName: registry.customerFirstName || 'Registry Owner',
      action: ActivityAction.SETTINGS_UPDATED,
      description: 'Disabled collaboration for registry',
      isSystem: false
    });

    // Clear cache
    await this.clearRegistryCache(registryId);

    return registry;
  }

  /**
   * Invite a collaborator to a registry
   */
  static async inviteCollaborator(input: InviteCollaboratorInput): Promise<RegistryCollaborator> {
    // Check if registry exists and has collaboration enabled
    const registry = await db.registry.findUnique({
      where: { id: input.registryId },
      include: { collaborators: true }
    });

    if (!registry) {
      throw new Error('Registry not found');
    }

    if (!registry.collaborationEnabled) {
      throw new Error('Collaboration is not enabled for this registry');
    }

    // Check collaboration settings
    const settings = registry.collaborationSettings as CollaborationSettings;
    if (registry.collaborators.length >= settings.maxCollaborators) {
      throw new Error(`Maximum collaborators limit reached (${settings.maxCollaborators})`);
    }

    // Check if user is already a collaborator
    const existingCollaborator = registry.collaborators.find(
      c => c.email === input.email && c.status !== CollaboratorStatus.REVOKED
    );

    if (existingCollaborator) {
      throw new Error('User is already a collaborator');
    }

    // Calculate expiration date
    const expiresAt = settings.autoExpireInvites
      ? new Date(Date.now() + settings.expireInvitesAfterDays * 24 * 60 * 60 * 1000)
      : null;

    // Create collaborator invitation
    const collaborator = await db.registryCollaborator.create({
      data: {
        registryId: input.registryId,
        email: encryptPII(input.email),
        name: null, // Will be filled when they accept
        role: input.role,
        permissions: input.permissions,
        status: settings.requireApproval ? CollaboratorStatus.PENDING : CollaboratorStatus.ACTIVE,
        invitedBy: input.invitedBy,
        expiresAt
      }
    });

    // Track activity
    await this.trackActivity({
      registryId: input.registryId,
      actorEmail: input.invitedBy,
      action: ActivityAction.COLLABORATOR_INVITED,
      description: `Invited ${input.email} as ${input.role}`,
      metadata: {
        invitedEmail: input.email,
        role: input.role,
        permissions: input.permissions,
        expiresAt
      }
    });

    // Send invitation notification
    await notificationManager.sendNotification({
      type: 'collaboration_invite',
      priority: 'medium',
      title: 'Registry Collaboration Invitation',
      message: `You've been invited to collaborate on the registry "${registry.title}"`,
      shopId: registry.shopId,
      customerId: input.email, // Use email as customer ID for invitations
      registryId: input.registryId,
      metadata: {
        registryTitle: registry.title,
        invitedBy: input.invitedBy,
        role: input.role,
        message: input.message
      },
      actionUrl: `/app/collaborate/accept/${collaborator.id}`,
      actionLabel: 'Accept Invitation'
    });

    // Clear cache
    await this.clearRegistryCache(input.registryId);

    return collaborator;
  }

  /**
   * Accept a collaboration invitation
   */
  static async acceptInvitation(
    collaboratorId: string,
    acceptorEmail: string,
    acceptorName?: string
  ): Promise<RegistryCollaborator> {
    const collaborator = await db.registryCollaborator.findUnique({
      where: { id: collaboratorId },
      include: { registry: true }
    });

    if (!collaborator) {
      throw new Error('Invitation not found');
    }

    // Decrypt and verify email
    const invitedEmail = decryptPII(collaborator.email);
    if (invitedEmail !== acceptorEmail) {
      throw new Error('Email mismatch - invitation not for this user');
    }

    if (collaborator.status !== CollaboratorStatus.PENDING) {
      throw new Error('Invitation is no longer pending');
    }

    // Check if invitation has expired
    if (collaborator.expiresAt && collaborator.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Update collaborator status
    const updatedCollaborator = await db.registryCollaborator.update({
      where: { id: collaboratorId },
      data: {
        status: CollaboratorStatus.ACTIVE,
        name: acceptorName ? encryptPII(acceptorName) : null,
        acceptedAt: new Date()
      }
    });

    // Track activity
    await this.trackActivity({
      registryId: collaborator.registryId,
      actorEmail: acceptorEmail,
      actorName: acceptorName,
      action: ActivityAction.COLLABORATOR_ACCEPTED,
      description: `${acceptorName || acceptorEmail} accepted collaboration invitation`,
      metadata: {
        collaboratorId,
        role: collaborator.role,
        permissions: collaborator.permissions
      }
    });

    // Notify registry owner
    await notificationManager.sendNotification({
      type: 'collaboration_accepted',
      priority: 'medium',
      title: 'Collaboration Invitation Accepted',
      message: `${acceptorName || acceptorEmail} has accepted your collaboration invitation`,
      shopId: collaborator.registry.shopId,
      customerId: collaborator.registry.customerId,
      registryId: collaborator.registryId,
      metadata: {
        acceptorEmail,
        acceptorName,
        role: collaborator.role
      },
      actionUrl: `/app/registries/${collaborator.registryId}/collaborators`,
      actionLabel: 'View Collaborators'
    });

    // Clear cache
    await this.clearRegistryCache(collaborator.registryId);

    return updatedCollaborator;
  }

  /**
   * Remove a collaborator from a registry
   */
  static async removeCollaborator(
    registryId: string,
    collaboratorId: string,
    removedBy: string
  ): Promise<void> {
    const collaborator = await db.registryCollaborator.findUnique({
      where: { id: collaboratorId },
      include: { registry: true }
    });

    if (!collaborator) {
      throw new Error('Collaborator not found');
    }

    if (collaborator.registryId !== registryId) {
      throw new Error('Collaborator does not belong to this registry');
    }

    // Remove collaborator
    await db.registryCollaborator.delete({
      where: { id: collaboratorId }
    });

    // Track activity
    await this.trackActivity({
      registryId,
      actorEmail: removedBy,
      action: ActivityAction.COLLABORATOR_REMOVED,
      description: `Removed collaborator ${decryptPII(collaborator.email)}`,
      metadata: {
        removedCollaboratorId: collaboratorId,
        removedEmail: decryptPII(collaborator.email),
        removedName: collaborator.name ? decryptPII(collaborator.name) : null,
        role: collaborator.role
      }
    });

    // Clear cache
    await this.clearRegistryCache(registryId);
  }

  /**
   * Get registry collaborators
   */
  static async getCollaborators(registryId: string): Promise<RegistryCollaborator[]> {
    const cacheKey = cacheKeys.collaborators(registryId);
    const cached = await cache.get<RegistryCollaborator[]>(cacheKey);
    
    if (cached) {
      return cached.map(c => ({
        ...c,
        email: decryptPII(c.email),
        name: c.name ? decryptPII(c.name) : null
      }));
    }

    const collaborators = await db.registryCollaborator.findMany({
      where: { registryId },
      orderBy: { createdAt: 'asc' }
    });

    // Cache encrypted version
    await cache.set(cacheKey, collaborators, { ttl: 900 * 1000, tags: [`registry:${registryId}`] }); // 15 minutes

    // Return decrypted version
    return collaborators.map(c => ({
      ...c,
      email: decryptPII(c.email),
      name: c.name ? decryptPII(c.name) : null
    }));
  }

  /**
   * Check if user has permission to perform action on registry
   */
  static async checkPermission(
    registryId: string,
    userEmail: string,
    requiredPermission: CollaboratorPermission
  ): Promise<boolean> {
    // Get registry with owner info
    const registry = await db.registry.findUnique({
      where: { id: registryId },
      select: { customerEmail: true }
    });

    if (!registry) {
      return false;
    }

    // Registry owner has all permissions
    if (decryptPII(registry.customerEmail) === userEmail) {
      return true;
    }

    // Check collaborator permissions
    const collaborator = await db.registryCollaborator.findFirst({
      where: {
        registryId,
        email: encryptPII(userEmail),
        status: CollaboratorStatus.ACTIVE
      }
    });

    if (!collaborator) {
      return false;
    }

    // Check permission hierarchy
    const permissionHierarchy = {
      [CollaboratorPermission.READ_ONLY]: 1,
      [CollaboratorPermission.READ_WRITE]: 2,
      [CollaboratorPermission.ADMIN]: 3
    };

    return permissionHierarchy[collaborator.permissions] >= permissionHierarchy[requiredPermission];
  }

  /**
   * Track registry activity
   */
  static async trackActivity(input: ActivityInput): Promise<RegistryActivity> {
    const activity = await db.registryActivity.create({
      data: {
        registryId: input.registryId,
        actorEmail: input.actorEmail,
        actorName: input.actorName,
        action: input.action,
        description: input.description,
        metadata: input.metadata || {},
        isSystem: input.isSystem || false
      }
    });

    // Clear activity cache
    const cacheKey = cacheKeys.activity(input.registryId);
    await cache.delete(cacheKey);

    return activity;
  }

  /**
   * Get registry activity feed
   */
  static async getActivityFeed(
    registryId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<RegistryActivity[]> {
    const cacheKey = `${cacheKeys.activity(registryId)}:${limit}:${offset}`;
    const cached = await cache.get<RegistryActivity[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const activities = await db.registryActivity.findMany({
      where: { registryId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Cache for 5 minutes
    await cache.set(cacheKey, activities, { ttl: 300 * 1000, tags: [`registry:${registryId}`] });

    return activities;
  }

  /**
   * Clear registry-related caches
   */
  private static async clearRegistryCache(registryId: string): Promise<void> {
    // Invalidate all cache entries for this registry using tags
    await cache.invalidateByTags([`registry:${registryId}`]);
  }

  /**
   * Clean up expired invitations
   */
  static async cleanupExpiredInvitations(): Promise<number> {
    const expiredInvitations = await db.registryCollaborator.deleteMany({
      where: {
        status: CollaboratorStatus.PENDING,
        expiresAt: {
          lt: new Date()
        }
      }
    });

    log.info(`Cleaned up ${expiredInvitations.count} expired collaboration invitations`);
    return expiredInvitations.count;
  }
}

/**
 * Utility functions for collaboration
 */
export const CollaborationUtils = {
  /**
   * Generate collaboration invitation link
   */
  generateInvitationLink(collaboratorId: string, baseUrl: string): string {
    return `${baseUrl}/app/collaborate/accept/${collaboratorId}`;
  },

  /**
   * Validate collaboration settings
   */
  validateCollaborationSettings(settings: Partial<CollaborationSettings>): CollaborationSettings {
    const defaults: CollaborationSettings = {
      maxCollaborators: 10,
      allowPublicInvites: false,
      requireApproval: true,
      autoExpireInvites: true,
      expireInvitesAfterDays: 7
    };

    const validated = { ...defaults, ...settings };

    // Validate constraints
    if (validated.maxCollaborators < 1 || validated.maxCollaborators > 50) {
      throw new Error('Max collaborators must be between 1 and 50');
    }

    if (validated.expireInvitesAfterDays < 1 || validated.expireInvitesAfterDays > 30) {
      throw new Error('Expire invites after days must be between 1 and 30');
    }

    return validated;
  },

  /**
   * Get permission display name
   */
  getPermissionDisplayName(permission: CollaboratorPermission): string {
    const displayNames = {
      [CollaboratorPermission.READ_ONLY]: 'View Only',
      [CollaboratorPermission.READ_WRITE]: 'Edit Registry',
      [CollaboratorPermission.ADMIN]: 'Full Access'
    };

    return displayNames[permission];
  },

  /**
   * Get role display name
   */
  getRoleDisplayName(role: CollaboratorRole): string {
    const displayNames = {
      [CollaboratorRole.OWNER]: 'Owner',
      [CollaboratorRole.COLLABORATOR]: 'Collaborator',
      [CollaboratorRole.VIEWER]: 'Viewer'
    };

    return displayNames[role];
  }
};

export default CollaborativeRegistryManager;