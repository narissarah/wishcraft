/**
 * Collaboration management for WishCraft
 * Handles registry collaborators and permissions
 */

import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { generateRandomString, encryptCollaboratorPII, decryptCollaboratorPII } from "~/lib/crypto.server";
import bcrypt from 'bcrypt';
import crypto from "crypto";

function logEmailSend(params: any) {
  log.info('Email would be sent', params);
  return Promise.resolve(true);
}

export class CollaborativeRegistryManager {
  /**
   * Add a collaborator to a registry
   */
  static async addCollaborator(params: {
    registryId: string;
    email: string;
    role: 'viewer' | 'editor';
    addedBy: string;
  }) {
    const { registryId, email, role, addedBy } = params;
    
    try {
      // SECURITY NOTE: Since emails are encrypted, we need to query all collaborators 
      // for this registry and decrypt to check for duplicates
      const existingCollaborators = await db.registry_collaborators.findMany({
        where: { registryId }
      });
      
      const existing = existingCollaborators.find(collab => {
        try {
          const decryptedData = decryptCollaboratorPII({ email: collab.email, name: collab.name || undefined });
          return decryptedData.email.toLowerCase() === email.toLowerCase();
        } catch {
          return false; // Skip corrupted data
        }
      });
      
      if (existing) {
        // Update role if different
        if (existing.role !== role) {
          return await db.registry_collaborators.update({
            where: { id: existing.id },
            data: { role }
          });
        }
        return existing;
      }
      
      // Create invitation token
      const invitationToken = generateRandomString(32);
      const invitationTokenHash = await bcrypt.hash(invitationToken, 10);
      
      // CRITICAL: Encrypt PII before storing
      const encryptedCollaboratorData = encryptCollaboratorPII({
        email: email.toLowerCase(),
        name: undefined // Will be set when collaborator accepts
      });

      // Create new collaborator
      const collaborator = await db.registry_collaborators.create({
        data: {
          id: crypto.randomUUID(),
          registryId,
          email: encryptedCollaboratorData.email,
          role,
          status: 'pending',
          inviteToken: invitationTokenHash,
          invitedAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      // Send invitation email
      await logEmailSend({
        to: email,
        subject: 'You have been invited to collaborate on a registry',
        template: 'collaboration-invite',
        data: { invitationToken, role }
      });
      
      log.info(`Collaborator invited`, {
        registryId,
        email,
        role,
        collaboratorId: collaborator.id
      });
      
      return collaborator;
    } catch (error) {
      log.error('Failed to add collaborator', error as Error);
      throw error;
    }
  }
  
  /**
   * Remove a collaborator from a registry
   */
  static async removeCollaborator(registryId: string, collaboratorId: string) {
    try {
      await db.registry_collaborators.delete({
        where: {
          id: collaboratorId,
          registryId
        }
      });
      
      log.info(`Collaborator removed`, {
        registryId,
        collaboratorId
      });
    } catch (error) {
      log.error('Failed to remove collaborator', error as Error);
      throw error;
    }
  }
  
  /**
   * Accept a collaboration invitation
   */
  static async acceptInvitation(collaboratorId: string, customerId?: string) {
    try {
      const collaborator = await db.registry_collaborators.update({
        where: { id: collaboratorId },
        data: {
          status: 'active',
          acceptedAt: new Date()
          // customerId - this field doesn't exist in the registry_collaborators model
        }
      });
      
      log.info(`Collaboration invitation accepted`, {
        collaboratorId,
        registryId: collaborator.registryId
      });
      
      return collaborator;
    } catch (error) {
      log.error('Failed to accept invitation', error as Error);
      throw error;
    }
  }
  
  /**
   * Check if a user has access to a registry
   */
  static async checkAccess(registryId: string, userId: string, requiredRole?: 'viewer' | 'editor') {
    try {
      // Check if user is the owner
      const registry = await db.registries.findUnique({
        where: { id: registryId },
        select: { customerId: true }
      });
      
      if (registry?.customerId === userId) {
        return { hasAccess: true, role: 'owner' as const };
      }
      
      // Check if user is a collaborator
      const collaborator = await db.registry_collaborators.findFirst({
        where: {
          registryId,
          email: userId, // Email-based lookup only since customerId doesn't exist in the model
          status: 'active'
        }
      });
      
      if (!collaborator) {
        return { hasAccess: false, role: null };
      }
      
      // Check role requirement
      if (requiredRole === 'editor' && collaborator.role === 'viewer') {
        return { hasAccess: false, role: collaborator.role };
      }
      
      return { hasAccess: true, role: collaborator.role };
    } catch (error) {
      log.error('Failed to check access', error as Error);
      return { hasAccess: false, role: null };
    }
  }
  
  /**
   * Get all collaborators for a registry
   */
  static async getCollaborators(registryId: string) {
    try {
      return await db.registry_collaborators.findMany({
        where: { registryId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      log.error('Failed to get collaborators', error as Error);
      throw error;
    }
  }

  /**
   * Track registry activity (placeholder implementation)
   */
  static async trackActivity(params: {
    registryId: string;
    action: string;
    actorEmail?: string;
    actorName?: string;
    metadata?: any;
  }) {
    try {
      await db.registry_activities.create({
        data: {
          id: crypto.randomUUID(),
          registryId: params.registryId,
          type: params.action,
          actorEmail: params.actorEmail,
          actorName: params.actorName,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null
        }
      });
    } catch (error) {
      log.error('Failed to track activity', error as Error);
      throw error;
    }
  }

  /**
   * Check permission (placeholder implementation)
   */
  static async checkPermission(registryId: string, userId: string, permission: string) {
    const access = await this.checkAccess(registryId, userId);
    return access.hasAccess;
  }

  /**
   * Invite collaborator (alias for addCollaborator)
   */
  static async inviteCollaborator(params: {
    registryId: string;
    email: string;
    role: 'viewer' | 'editor';
    addedBy: string;
  }) {
    return this.addCollaborator(params);
  }

  /**
   * Get activity feed (placeholder implementation)
   */
  static async getActivityFeed(registryId: string, limit = 20) {
    try {
      return await db.registry_activities.findMany({
        where: { registryId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      log.error('Failed to get activity feed', error as Error);
      throw error;
    }
  }
}

// Email service is now imported from notifications.server

// Export enums and types for compatibility
export enum CollaboratorRole {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  OWNER = 'owner'
}

export enum CollaboratorPermission {
  VIEW = 'view',
  EDIT = 'edit',
  DELETE = 'delete',
  MANAGE_COLLABORATORS = 'manage_collaborators',
  ADMIN = 'admin'
}

export const CollaborationUtils = {
  canEdit: (role: string): role is 'editor' | 'owner' => role === 'editor' || role === 'owner',
  canManageCollaborators: (role: string): role is 'owner' => role === 'owner',
  getPermissions: (role: string): CollaboratorPermission[] => {
    switch (role) {
      case 'owner':
        return [CollaboratorPermission.VIEW, CollaboratorPermission.EDIT, CollaboratorPermission.DELETE, CollaboratorPermission.MANAGE_COLLABORATORS, CollaboratorPermission.ADMIN];
      case 'editor':
        return [CollaboratorPermission.VIEW, CollaboratorPermission.EDIT];
      case 'viewer':
        return [CollaboratorPermission.VIEW];
      default:
        return [];
    }
  },
  getRoleDisplayName: (role: string): string => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'editor': return 'Editor';
      case 'viewer': return 'Viewer';
      default: return 'Unknown';
    }
  },
  getPermissionDisplayName: (permission: CollaboratorPermission): string => {
    switch (permission) {
      case CollaboratorPermission.VIEW: return 'View';
      case CollaboratorPermission.EDIT: return 'Edit';
      case CollaboratorPermission.DELETE: return 'Delete';
      case CollaboratorPermission.MANAGE_COLLABORATORS: return 'Manage Collaborators';
      case CollaboratorPermission.ADMIN: return 'Admin';
      default: return 'Unknown';
    }
  }
};