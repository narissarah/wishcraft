import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { encrypt, decrypt } from "~/lib/crypto.server";
import crypto from "crypto";

export async function acceptInvitation(collaboratorId: string, shopId: string) {
  try {
    const result = await db.registry_collaborators.update({
      where: { id: collaboratorId },
      data: {
        status: 'accepted',
        acceptedAt: new Date()
      }
    });
    
    log.info("Invitation accepted", { collaboratorId, shopId });
    return result;
  } catch (error) {
    log.error("Error accepting invitation", { error, collaboratorId, shopId });
    throw error;
  }
}

export async function declineInvitation(collaboratorId: string, shopId: string) {
  try {
    const result = await db.registry_collaborators.update({
      where: { id: collaboratorId },
      data: {
        status: 'declined',
        updatedAt: new Date()
      }
    });
    
    log.info("Invitation declined", { collaboratorId, shopId });
    return result;
  } catch (error) {
    log.error("Error declining invitation", { error, collaboratorId, shopId });
    throw error;
  }
}

export async function addCollaborator(registryId: string, email: string, role: string = 'viewer') {
  try {
    const encryptedEmail = encrypt(email);
    const result = await db.registry_collaborators.create({
      data: {
        id: `collab_${crypto.randomUUID()}`,
        registryId,
        email: encryptedEmail,
        role,
        status: 'pending',
        invitedAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    log.info("Collaborator added", { registryId, role });
    return result;
  } catch (error) {
    log.error("Error adding collaborator", { error, registryId });
    throw error;
  }
}

export async function removeCollaborator(collaboratorId: string) {
  try {
    const result = await db.registry_collaborators.delete({
      where: { id: collaboratorId }
    });
    
    log.info("Collaborator removed", { collaboratorId });
    return result;
  } catch (error) {
    log.error("Error removing collaborator", { error, collaboratorId });
    throw error;
  }
}

export async function getCollaborators(registryId: string) {
  try {
    const collaborators = await db.registry_collaborators.findMany({
      where: { registryId },
      orderBy: { invitedAt: 'desc' }
    });
    
    return collaborators.map(collab => ({
      ...collab,
      email: decrypt(collab.email)
    }));
  } catch (error) {
    log.error("Error getting collaborators", { error, registryId });
    throw error;
  }
}