import { db } from "~/lib/db.server";
import { getCustomerSession } from "~/lib/customer-auth.server";
import crypto from "crypto";

// ============================================================================
// REGISTRY ACCESS CONTROL
// ============================================================================

export interface AccessControlResult {
  hasAccess: boolean;
  requiresPassword?: boolean;
  accessLevel: 'none' | 'view' | 'edit' | 'admin';
  reason?: string;
  registry?: any;
  customer?: any;
}

export interface RegistryAccessRequest {
  registryId?: string;
  registrySlug?: string;
  password?: string;
  customerId?: string;
  customerEmail?: string;
  inviteToken?: string;
}

export class RegistryAccessService {
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;
  }

  /**
   * Check access to a registry
   */
  async checkAccess(request: Request, accessRequest: RegistryAccessRequest): Promise<AccessControlResult> {
    try {
      // Get registry
      const registry = await this.getRegistry(accessRequest);
      if (!registry) {
        return {
          hasAccess: false,
          accessLevel: 'none',
          reason: 'Registry not found'
        };
      }

      // Get customer session if available
      const customerSession = await getCustomerSession(request);
      
      // Check owner access
      if (customerSession && registry.customerId === customerSession.customerId) {
        return {
          hasAccess: true,
          accessLevel: 'admin',
          registry,
          customer: customerSession
        };
      }

      // Check collaborator access
      if (customerSession) {
        const collaborator = await db.registryCollaborator.findFirst({
          where: {
            registryId: registry.id,
            email: customerSession.customerId, // Using customerId as email for now
            status: 'active'
          }
        });

        if (collaborator) {
          return {
            hasAccess: true,
            accessLevel: collaborator.permission === 'edit' ? 'edit' : 'view',
            registry,
            customer: customerSession
          };
        }
      }

      // Check visibility-based access
      return this.checkVisibilityAccess(registry, accessRequest, customerSession);
    } catch (error) {
      console.error('Error checking registry access:', error);
      return {
        hasAccess: false,
        accessLevel: 'none',
        reason: 'Access check failed'
      };
    }
  }

  /**
   * Check access based on registry visibility
   */
  private checkVisibilityAccess(
    registry: any, 
    accessRequest: RegistryAccessRequest, 
    customerSession: any
  ): AccessControlResult {
    switch (registry.visibility) {
      case 'public':
        return {
          hasAccess: true,
          accessLevel: 'view',
          registry,
          customer: customerSession
        };

      case 'private':
        // Only owner and collaborators can access
        return {
          hasAccess: false,
          accessLevel: 'none',
          reason: 'This registry is private',
          registry
        };

      case 'friends':
        // Check if customer is in friends list (implemented as collaborators)
        if (customerSession) {
          // This would be checked above in collaborator access
          return {
            hasAccess: false,
            accessLevel: 'none',
            reason: 'This registry is only accessible to friends',
            registry
          };
        }
        return {
          hasAccess: false,
          accessLevel: 'none',
          reason: 'Please sign in to access this registry',
          registry
        };

      case 'password':
        if (!accessRequest.password) {
          return {
            hasAccess: false,
            requiresPassword: true,
            accessLevel: 'none',
            reason: 'Password required',
            registry
          };
        }

        // Check password
        const isValidPassword = this.verifyPassword(registry.passwordHash, accessRequest.password);
        if (isValidPassword) {
          return {
            hasAccess: true,
            accessLevel: 'view',
            registry,
            customer: customerSession
          };
        }

        return {
          hasAccess: false,
          requiresPassword: true,
          accessLevel: 'none',
          reason: 'Incorrect password',
          registry
        };

      default:
        return {
          hasAccess: false,
          accessLevel: 'none',
          reason: 'Unknown registry visibility setting',
          registry
        };
    }
  }

  /**
   * Verify password for password-protected registry
   */
  private verifyPassword(passwordHash: string | null, password: string): boolean {
    if (!passwordHash) return false;
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash === passwordHash;
  }

  /**
   * Get registry by ID or slug
   */
  private async getRegistry(accessRequest: RegistryAccessRequest) {
    if (accessRequest.registryId) {
      return db.registry.findUnique({
        where: { 
          id: accessRequest.registryId,
          shopId: this.shopId
        }
      });
    }

    if (accessRequest.registrySlug) {
      return db.registry.findFirst({
        where: { 
          slug: accessRequest.registrySlug,
          shopId: this.shopId
        }
      });
    }

    return null;
  }

  /**
   * Add collaborator to registry
   */
  async addCollaborator(
    registryId: string, 
    email: string, 
    permission: 'view' | 'edit' = 'view',
    invitedBy?: string
  ): Promise<boolean> {
    try {
      // Check if registry exists and belongs to shop
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      // Check if collaborator already exists
      const existingCollaborator = await db.registryCollaborator.findFirst({
        where: {
          registryId,
          email
        }
      });

      if (existingCollaborator) {
        // Update existing collaborator
        await db.registryCollaborator.update({
          where: { id: existingCollaborator.id },
          data: {
            permission,
            status: 'active',
            updatedAt: new Date()
          }
        });
      } else {
        // Create new collaborator
        await db.registryCollaborator.create({
          data: {
            registryId,
            email,
            permission,
            status: 'pending',
            invitedBy: invitedBy || registry.customerId
          }
        });
      }

      // Send invitation (would integrate with email service)
      await this.sendCollaboratorInvitation(registry, email, permission);

      // Log activity
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'collaborator_added',
          description: `Collaborator ${email} added with ${permission} permission`,
          actorType: 'owner',
          actorId: invitedBy || registry.customerId || 'system',
          actorEmail: invitedBy || registry.customerEmail,
          actorName: registry.customerFirstName && registry.customerLastName 
            ? `${registry.customerFirstName} ${registry.customerLastName}`
            : null
        }
      });

      return true;
    } catch (error) {
      console.error('Error adding collaborator:', error);
      return false;
    }
  }

  /**
   * Remove collaborator from registry
   */
  async removeCollaborator(registryId: string, collaboratorId: string): Promise<boolean> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      const collaborator = await db.registryCollaborator.findUnique({
        where: { id: collaboratorId }
      });

      if (!collaborator || collaborator.registryId !== registryId) {
        throw new Error('Collaborator not found');
      }

      await db.registryCollaborator.delete({
        where: { id: collaboratorId }
      });

      // Log activity
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'collaborator_removed',
          description: `Collaborator ${collaborator.email} removed`,
          actorType: 'owner',
          actorId: registry.customerId || 'system',
          actorEmail: registry.customerEmail,
          actorName: registry.customerFirstName && registry.customerLastName 
            ? `${registry.customerFirstName} ${registry.customerLastName}`
            : null
        }
      });

      return true;
    } catch (error) {
      console.error('Error removing collaborator:', error);
      return false;
    }
  }

  /**
   * Update collaborator permissions
   */
  async updateCollaboratorPermission(
    registryId: string, 
    collaboratorId: string, 
    permission: 'view' | 'edit'
  ): Promise<boolean> {
    try {
      const collaborator = await db.registryCollaborator.findUnique({
        where: { id: collaboratorId }
      });

      if (!collaborator || collaborator.registryId !== registryId) {
        throw new Error('Collaborator not found');
      }

      await db.registryCollaborator.update({
        where: { id: collaboratorId },
        data: {
          permission,
          updatedAt: new Date()
        }
      });

      // Log activity
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'collaborator_updated',
          description: `Collaborator ${collaborator.email} permission changed to ${permission}`,
          actorType: 'owner',
          actorId: 'system',
          actorEmail: null,
          actorName: 'System'
        }
      });

      return true;
    } catch (error) {
      console.error('Error updating collaborator permission:', error);
      return false;
    }
  }

  /**
   * Accept collaboration invitation
   */
  async acceptCollaboratorInvitation(token: string, customerId?: string): Promise<boolean> {
    try {
      // Find invitation by token (would need to implement token system)
      // For now, find by email match
      const collaborator = await db.registryCollaborator.findFirst({
        where: {
          status: 'pending',
          // Would match by token in real implementation
        }
      });

      if (!collaborator) {
        throw new Error('Invitation not found or expired');
      }

      await db.registryCollaborator.update({
        where: { id: collaborator.id },
        data: {
          status: 'active',
          acceptedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Log activity
      await db.registryActivity.create({
        data: {
          registryId: collaborator.registryId,
          type: 'collaborator_accepted',
          description: `${collaborator.email} accepted collaboration invitation`,
          actorType: 'collaborator',
          actorId: customerId || collaborator.email,
          actorEmail: collaborator.email,
          actorName: collaborator.firstName && collaborator.lastName 
            ? `${collaborator.firstName} ${collaborator.lastName}`
            : null
        }
      });

      return true;
    } catch (error) {
      console.error('Error accepting collaborator invitation:', error);
      return false;
    }
  }

  /**
   * Generate shareable link for registry
   */
  async generateShareableLink(registryId: string, options: {
    expiresIn?: number; // hours
    allowGuests?: boolean;
    maxUses?: number;
  } = {}): Promise<string | null> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = options.expiresIn 
        ? new Date(Date.now() + options.expiresIn * 60 * 60 * 1000)
        : null;

      // Store link info
      await db.registryInvitation.create({
        data: {
          registryId,
          token,
          type: 'link',
          email: null, // Link invitations don't have specific email
          expiresAt,
          maxUses: options.maxUses || null,
          allowGuests: options.allowGuests ?? true,
          createdBy: registry.customerId || 'system'
        }
      });

      // Generate shareable URL
      const baseUrl = process.env.SHOPIFY_APP_URL || 'https://your-app.com';
      return `${baseUrl}/registry/${registry.slug}?token=${token}`;
    } catch (error) {
      console.error('Error generating shareable link:', error);
      return null;
    }
  }

  /**
   * Send collaborator invitation email
   */
  private async sendCollaboratorInvitation(
    registry: any, 
    email: string, 
    permission: string
  ): Promise<void> {
    try {
      // This would integrate with your email service
      console.log(`Sending collaboration invitation to ${email} for registry ${registry.title}`);
      
      // Log invitation sent
      await db.registryActivity.create({
        data: {
          registryId: registry.id,
          type: 'invitation_sent',
          description: `Collaboration invitation sent to ${email}`,
          actorType: 'system',
          actorId: 'email_service',
          actorEmail: null,
          actorName: 'Email Service'
        }
      });
    } catch (error) {
      console.error('Error sending collaborator invitation:', error);
    }
  }

  /**
   * Check if customer can edit registry
   */
  async canEdit(registryId: string, customerId: string): Promise<boolean> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) return false;

      // Owner can always edit
      if (registry.customerId === customerId) return true;

      // Check collaborator permission
      const collaborator = await db.registryCollaborator.findFirst({
        where: {
          registryId,
          email: customerId, // Using customerId as email
          status: 'active',
          permission: 'edit'
        }
      });

      return !!collaborator;
    } catch (error) {
      console.error('Error checking edit permission:', error);
      return false;
    }
  }

  /**
   * Log registry access
   */
  async logAccess(registryId: string, accessType: string, customerId?: string, ipAddress?: string): Promise<void> {
    try {
      await db.registryActivity.create({
        data: {
          registryId,
          type: `access_${accessType}`,
          description: `Registry ${accessType} access`,
          actorType: customerId ? 'customer' : 'guest',
          actorId: customerId || ipAddress || 'anonymous',
          actorEmail: null,
          actorName: null,
          metadata: JSON.stringify({ 
            ipAddress,
            timestamp: new Date().toISOString(),
            accessType
          })
        }
      });
    } catch (error) {
      console.error('Error logging registry access:', error);
    }
  }
}

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Registry access middleware for routes
 */
export async function requireRegistryAccess(
  request: Request,
  shopId: string,
  accessRequest: RegistryAccessRequest,
  requiredLevel: 'view' | 'edit' | 'admin' = 'view'
): Promise<AccessControlResult> {
  const accessService = new RegistryAccessService(shopId);
  const result = await accessService.checkAccess(request, accessRequest);

  if (!result.hasAccess) {
    return result;
  }

  // Check if access level is sufficient
  const accessLevels = { 'view': 1, 'edit': 2, 'admin': 3 };
  const hasLevel = accessLevels[result.accessLevel] >= accessLevels[requiredLevel];

  if (!hasLevel) {
    return {
      hasAccess: false,
      accessLevel: result.accessLevel,
      reason: `Requires ${requiredLevel} access`,
      registry: result.registry
    };
  }

  // Log access
  await accessService.logAccess(
    result.registry?.id,
    requiredLevel,
    result.customer?.customerId,
    request.headers.get('x-forwarded-for') || 'unknown'
  );

  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create RegistryAccessService instance
 */
export function createRegistryAccessService(shopId: string): RegistryAccessService {
  return new RegistryAccessService(shopId);
}

/**
 * Extract registry identifier from URL parameters
 */
export function extractRegistryIdentifier(params: any, searchParams: URLSearchParams): RegistryAccessRequest {
  return {
    registryId: params.id || undefined,
    registrySlug: params.slug || undefined,
    password: searchParams.get('password') || undefined,
    inviteToken: searchParams.get('token') || undefined
  };
}

/**
 * Generate access token for temporary access
 */
export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Format access level for display
 */
export function formatAccessLevel(accessLevel: string): string {
  switch (accessLevel) {
    case 'admin': return 'Owner';
    case 'edit': return 'Can Edit';
    case 'view': return 'Can View';
    case 'none': return 'No Access';
    default: return 'Unknown';
  }
}