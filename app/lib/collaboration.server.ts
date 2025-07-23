/**
 * Simplified collaboration management for WishCraft
 * Direct functions without unnecessary class wrapper
 */

import { db } from "~/lib/db.server";
import { encryptPII, decryptPII, verifyInvitationToken } from "~/lib/crypto.server";
import bcrypt from 'bcrypt';
import crypto from "crypto";

/**
 * Add a collaborator to a registry
 */
export async function addCollaborator(params: {
  registryId: string;
  email: string;
  role: 'viewer' | 'editor';
  addedBy: string;
}) {
  const { registryId, email, role } = params;
  
  // Check for existing collaborator
  const existingCollaborators = await db.registry_collaborators.findMany({
    where: { registryId }
  });
  
  const existing = existingCollaborators.find(collab => {
    try {
      const decryptedEmail = decryptPII(collab.email);
      return decryptedEmail.toLowerCase() === email.toLowerCase();
    } catch {
      return false;
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
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const invitationTokenHash = await bcrypt.hash(invitationToken, 10);
  
  // Create new collaborator
  const collaborator = await db.registry_collaborators.create({
    data: {
      id: crypto.randomUUID(),
      registryId,
      email: encryptPII(email.toLowerCase()),
      role,
      status: 'pending',
      inviteToken: invitationTokenHash,
      invitedAt: new Date(),
      updatedAt: new Date()
    }
  });
  
  // In production, send email here
  console.log('Invitation email would be sent', { email, invitationToken });
  
  return collaborator;
}

/**
 * Remove a collaborator from a registry
 */
export async function removeCollaborator(collaboratorId: string, removedBy: string) {
  const collaborator = await db.registry_collaborators.findUnique({
    where: { id: collaboratorId }
  });
  
  if (!collaborator) {
    throw new Error('Collaborator not found');
  }
  
  await db.registry_collaborators.delete({
    where: { id: collaboratorId }
  });
  
  return { success: true };
}

/**
 * Accept collaboration invitation
 */
export async function acceptInvitation(params: {
  collaboratorId: string;
  token: string;
  name?: string;
}) {
  const { collaboratorId, token, name } = params;
  
  const collaborator = await db.registry_collaborators.findUnique({
    where: { id: collaboratorId }
  });
  
  if (!collaborator || !collaborator.inviteToken) {
    throw new Error('Invalid invitation');
  }
  
  // Verify token
  const isValidToken = await bcrypt.compare(token, collaborator.inviteToken);
  if (!isValidToken) {
    throw new Error('Invalid invitation token');
  }
  
  // Update collaborator status
  return await db.registry_collaborators.update({
    where: { id: collaboratorId },
    data: {
      status: 'active',
      name: name ? encryptPII(name) : null,
      acceptedAt: new Date(),
      inviteToken: null // Clear token after use
    }
  });
}

/**
 * Decline collaboration invitation
 */
export async function declineInvitation(collaboratorId: string, token: string) {
  const collaborator = await db.registry_collaborators.findUnique({
    where: { id: collaboratorId }
  });
  
  if (!collaborator || !collaborator.inviteToken) {
    throw new Error('Invalid invitation');
  }
  
  // Verify token
  const isValidToken = await bcrypt.compare(token, collaborator.inviteToken);
  if (!isValidToken) {
    throw new Error('Invalid invitation token');
  }
  
  // Delete the invitation
  await db.registry_collaborators.delete({
    where: { id: collaboratorId }
  });
  
  return { success: true };
}

/**
 * Get collaborators for a registry
 */
export async function getCollaborators(registryId: string) {
  const collaborators = await db.registry_collaborators.findMany({
    where: { registryId },
    orderBy: { createdAt: 'desc' }
  });
  
  // Decrypt PII for display
  return collaborators.map(collab => ({
    ...collab,
    email: decryptPII(collab.email),
    name: collab.name ? decryptPII(collab.name) : null
  }));
}

/**
 * Check if user has permission
 */
export async function checkPermission(params: {
  registryId: string;
  userId?: string;
  email?: string;
  requiredRole?: 'viewer' | 'editor' | 'owner';
}) {
  const { registryId, userId, email, requiredRole = 'viewer' } = params;
  
  // Check if owner
  if (userId) {
    const registry = await db.registries.findFirst({
      where: { id: registryId, shopId: userId }
    });
    if (registry) return true;
  }
  
  // Check collaborator
  if (email) {
    const collaborators = await getCollaborators(registryId);
    const collaborator = collaborators.find(c => 
      c.email.toLowerCase() === email.toLowerCase() && c.status === 'active'
    );
    
    if (!collaborator) return false;
    
    // Check role hierarchy
    if (requiredRole === 'owner') return false;
    if (requiredRole === 'editor' && collaborator.role === 'viewer') return false;
    
    return true;
  }
  
  return false;
}

/**
 * Get invitation by token (moved from route file)
 */
export async function getInvitationByToken(token: string) {
  try {
    const tokenData = verifyInvitationToken(token);
    if (!tokenData.valid) return null;

    const collaborator = await db.registry_collaborators.findUnique({
      where: { id: tokenData.collaboratorId },
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

    if (!collaborator) return null;

    return {
      id: collaborator.id,
      email: decryptPII(collaborator.email),
      role: collaborator.role,
      status: collaborator.status,
      invitedAt: collaborator.invitedAt,
      registries: collaborator.registries
    };
  } catch (error) {
    console.error("Failed to get invitation by token:", error);
    return null;
  }
}