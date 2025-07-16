/**
 * Collaboration Tests
 * Tests for collaborative registry management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CollaborativeRegistryManager,
  CollaboratorRole,
  CollaboratorPermission,
  CollaboratorStatus,
  ActivityAction,
  CollaborationUtils,
} from '../app/lib/collaboration.server';
import { testUtils } from './setup';

// Mock dependencies
vi.mock('../app/lib/db.server', () => ({
  db: testUtils.getMockPrismaClient(),
}));

vi.mock('../app/lib/encryption.server', () => ({
  encryptPII: vi.fn((data: string) => `encrypted_${data}`),
  decryptPII: vi.fn((data: string) => data.replace('encrypted_', '')),
}));

vi.mock('../app/lib/cache-manager.server', () => ({
  cacheManager: {
    generateKey: vi.fn((...args) => args.join(':')),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  CacheKeys: {
    REGISTRY: 'registry',
  },
}));

vi.mock('../app/lib/notifications.server', () => ({
  notificationManager: {
    sendNotification: vi.fn(),
  },
}));

vi.mock('../app/lib/logger.server', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('CollaborativeRegistryManager', () => {
  const mockPrismaClient = testUtils.getMockPrismaClient();

  beforeEach(() => {
    testUtils.resetMocks();
    testUtils.mockSuccessfulDbResponses();
  });

  describe('enableCollaboration', () => {
    it('should enable collaboration for a registry', async () => {
      const registryId = 'test-registry-id';
      const settings = {
        maxCollaborators: 5,
        requireApproval: false,
      };

      const mockRegistry = testUtils.createMockRegistry({
        id: registryId,
        collaborationEnabled: true,
        collaborationSettings: {
          maxCollaborators: 5,
          allowPublicInvites: false,
          requireApproval: false,
          autoExpireInvites: true,
          expireInvitesAfterDays: 7,
        },
      });

      mockPrismaClient.registry.update.mockResolvedValue(mockRegistry);

      const result = await CollaborativeRegistryManager.enableCollaboration(registryId, settings);

      expect(result.collaborationEnabled).toBe(true);
      expect(mockPrismaClient.registry.update).toHaveBeenCalledWith({
        where: { id: registryId },
        data: {
          collaborationEnabled: true,
          collaborationSettings: expect.objectContaining({
            maxCollaborators: 5,
            requireApproval: false,
          }),
        },
      });
    });

    it('should use default settings when none provided', async () => {
      const registryId = 'test-registry-id';
      const mockRegistry = testUtils.createMockRegistry();

      mockPrismaClient.registry.update.mockResolvedValue(mockRegistry);

      await CollaborativeRegistryManager.enableCollaboration(registryId);

      expect(mockPrismaClient.registry.update).toHaveBeenCalledWith({
        where: { id: registryId },
        data: {
          collaborationEnabled: true,
          collaborationSettings: {
            maxCollaborators: 10,
            allowPublicInvites: false,
            requireApproval: true,
            autoExpireInvites: true,
            expireInvitesAfterDays: 7,
          },
        },
      });
    });

    it('should track activity when enabling collaboration', async () => {
      const registryId = 'test-registry-id';
      const mockRegistry = testUtils.createMockRegistry();

      mockPrismaClient.registry.update.mockResolvedValue(mockRegistry);

      await CollaborativeRegistryManager.enableCollaboration(registryId);

      expect(mockPrismaClient.registryActivity.create).toHaveBeenCalledWith({
        data: {
          registryId,
          actorEmail: mockRegistry.customerEmail,
          actorName: mockRegistry.customerFirstName || 'Registry Owner',
          action: ActivityAction.SETTINGS_UPDATED,
          description: 'Enabled collaboration for registry',
          metadata: expect.any(Object),
          isSystem: false,
        },
      });
    });
  });

  describe('disableCollaboration', () => {
    it('should disable collaboration and remove collaborators', async () => {
      const registryId = 'test-registry-id';
      const mockRegistry = testUtils.createMockRegistry({
        collaborationEnabled: false,
        collaborationSettings: null,
      });

      mockPrismaClient.registry.update.mockResolvedValue(mockRegistry);

      const result = await CollaborativeRegistryManager.disableCollaboration(registryId);

      expect(result.collaborationEnabled).toBe(false);
      expect(mockPrismaClient.registryCollaborator.deleteMany).toHaveBeenCalledWith({
        where: { registryId },
      });
    });
  });

  describe('inviteCollaborator', () => {
    it('should invite a collaborator successfully', async () => {
      const inviteInput = {
        registryId: 'test-registry-id',
        email: 'collaborator@example.com',
        role: CollaboratorRole.COLLABORATOR,
        permissions: CollaboratorPermission.READ_WRITE,
        invitedBy: 'owner@example.com',
        message: 'Please help manage this registry',
      };

      const mockRegistry = testUtils.createMockRegistry({
        collaborationEnabled: true,
        collaborationSettings: {
          maxCollaborators: 10,
          requireApproval: true,
          autoExpireInvites: true,
          expireInvitesAfterDays: 7,
        },
      });

      const mockCollaborator = testUtils.createMockCollaborator({
        registryId: inviteInput.registryId,
        email: `encrypted_${inviteInput.email}`,
        role: inviteInput.role,
        permissions: inviteInput.permissions,
        status: CollaboratorStatus.PENDING,
      });

      mockPrismaClient.registry.findUnique.mockResolvedValue({
        ...mockRegistry,
        collaborators: [],
      });
      mockPrismaClient.registryCollaborator.create.mockResolvedValue(mockCollaborator);

      const result = await CollaborativeRegistryManager.inviteCollaborator(inviteInput);

      expect(result.email).toBe(`encrypted_${inviteInput.email}`);
      expect(result.role).toBe(inviteInput.role);
      expect(result.permissions).toBe(inviteInput.permissions);
      expect(result.status).toBe(CollaboratorStatus.PENDING);
    });

    it('should throw error if registry not found', async () => {
      const inviteInput = {
        registryId: 'non-existent-registry',
        email: 'collaborator@example.com',
        role: CollaboratorRole.COLLABORATOR,
        permissions: CollaboratorPermission.READ_WRITE,
        invitedBy: 'owner@example.com',
      };

      mockPrismaClient.registry.findUnique.mockResolvedValue(null);

      await expect(
        CollaborativeRegistryManager.inviteCollaborator(inviteInput)
      ).rejects.toThrow('Registry not found');
    });

    it('should throw error if collaboration is not enabled', async () => {
      const inviteInput = {
        registryId: 'test-registry-id',
        email: 'collaborator@example.com',
        role: CollaboratorRole.COLLABORATOR,
        permissions: CollaboratorPermission.READ_WRITE,
        invitedBy: 'owner@example.com',
      };

      const mockRegistry = testUtils.createMockRegistry({
        collaborationEnabled: false,
      });

      mockPrismaClient.registry.findUnique.mockResolvedValue({
        ...mockRegistry,
        collaborators: [],
      });

      await expect(
        CollaborativeRegistryManager.inviteCollaborator(inviteInput)
      ).rejects.toThrow('Collaboration is not enabled for this registry');
    });

    it('should throw error if max collaborators limit reached', async () => {
      const inviteInput = {
        registryId: 'test-registry-id',
        email: 'collaborator@example.com',
        role: CollaboratorRole.COLLABORATOR,
        permissions: CollaboratorPermission.READ_WRITE,
        invitedBy: 'owner@example.com',
      };

      const mockRegistry = testUtils.createMockRegistry({
        collaborationEnabled: true,
        collaborationSettings: {
          maxCollaborators: 1,
          requireApproval: true,
        },
      });

      const existingCollaborators = [testUtils.createMockCollaborator()];

      mockPrismaClient.registry.findUnique.mockResolvedValue({
        ...mockRegistry,
        collaborators: existingCollaborators,
      });

      await expect(
        CollaborativeRegistryManager.inviteCollaborator(inviteInput)
      ).rejects.toThrow('Maximum collaborators limit reached (1)');
    });

    it('should throw error if user is already a collaborator', async () => {
      const inviteInput = {
        registryId: 'test-registry-id',
        email: 'collaborator@example.com',
        role: CollaboratorRole.COLLABORATOR,
        permissions: CollaboratorPermission.READ_WRITE,
        invitedBy: 'owner@example.com',
      };

      const mockRegistry = testUtils.createMockRegistry({
        collaborationEnabled: true,
        collaborationSettings: {
          maxCollaborators: 10,
          requireApproval: true,
        },
      });

      const existingCollaborator = testUtils.createMockCollaborator({
        email: inviteInput.email,
        status: CollaboratorStatus.ACTIVE,
      });

      mockPrismaClient.registry.findUnique.mockResolvedValue({
        ...mockRegistry,
        collaborators: [existingCollaborator],
      });

      await expect(
        CollaborativeRegistryManager.inviteCollaborator(inviteInput)
      ).rejects.toThrow('User is already a collaborator');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation successfully', async () => {
      const collaboratorId = 'test-collaborator-id';
      const acceptorEmail = 'collaborator@example.com';
      const acceptorName = 'Test Collaborator';

      const mockCollaborator = testUtils.createMockCollaborator({
        id: collaboratorId,
        email: 'encrypted_collaborator@example.com',
        status: CollaboratorStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        registry: testUtils.createMockRegistry(),
      });

      const updatedCollaborator = {
        ...mockCollaborator,
        status: CollaboratorStatus.ACTIVE,
        acceptedAt: new Date(),
      };

      mockPrismaClient.registryCollaborator.findUnique.mockResolvedValue(mockCollaborator);
      mockPrismaClient.registryCollaborator.update.mockResolvedValue(updatedCollaborator);

      const result = await CollaborativeRegistryManager.acceptInvitation(
        collaboratorId,
        acceptorEmail,
        acceptorName
      );

      expect(result.status).toBe(CollaboratorStatus.ACTIVE);
      expect(result.acceptedAt).toBeDefined();
    });

    it('should throw error if invitation not found', async () => {
      const collaboratorId = 'non-existent-collaborator';
      const acceptorEmail = 'collaborator@example.com';

      mockPrismaClient.registryCollaborator.findUnique.mockResolvedValue(null);

      await expect(
        CollaborativeRegistryManager.acceptInvitation(collaboratorId, acceptorEmail)
      ).rejects.toThrow('Invitation not found');
    });

    it('should throw error if email mismatch', async () => {
      const collaboratorId = 'test-collaborator-id';
      const acceptorEmail = 'wrong@example.com';

      const mockCollaborator = testUtils.createMockCollaborator({
        email: 'encrypted_collaborator@example.com',
        status: CollaboratorStatus.PENDING,
        registry: testUtils.createMockRegistry(),
      });

      mockPrismaClient.registryCollaborator.findUnique.mockResolvedValue(mockCollaborator);

      await expect(
        CollaborativeRegistryManager.acceptInvitation(collaboratorId, acceptorEmail)
      ).rejects.toThrow('Email mismatch - invitation not for this user');
    });

    it('should throw error if invitation has expired', async () => {
      const collaboratorId = 'test-collaborator-id';
      const acceptorEmail = 'collaborator@example.com';

      const mockCollaborator = testUtils.createMockCollaborator({
        email: 'encrypted_collaborator@example.com',
        status: CollaboratorStatus.PENDING,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        registry: testUtils.createMockRegistry(),
      });

      mockPrismaClient.registryCollaborator.findUnique.mockResolvedValue(mockCollaborator);

      await expect(
        CollaborativeRegistryManager.acceptInvitation(collaboratorId, acceptorEmail)
      ).rejects.toThrow('Invitation has expired');
    });
  });

  describe('removeCollaborator', () => {
    it('should remove collaborator successfully', async () => {
      const registryId = 'test-registry-id';
      const collaboratorId = 'test-collaborator-id';
      const removedBy = 'owner@example.com';

      const mockCollaborator = testUtils.createMockCollaborator({
        id: collaboratorId,
        registryId,
        email: 'encrypted_collaborator@example.com',
        registry: testUtils.createMockRegistry(),
      });

      mockPrismaClient.registryCollaborator.findUnique.mockResolvedValue(mockCollaborator);
      mockPrismaClient.registryCollaborator.delete.mockResolvedValue(mockCollaborator);

      await CollaborativeRegistryManager.removeCollaborator(registryId, collaboratorId, removedBy);

      expect(mockPrismaClient.registryCollaborator.delete).toHaveBeenCalledWith({
        where: { id: collaboratorId },
      });
    });

    it('should throw error if collaborator not found', async () => {
      const registryId = 'test-registry-id';
      const collaboratorId = 'non-existent-collaborator';
      const removedBy = 'owner@example.com';

      mockPrismaClient.registryCollaborator.findUnique.mockResolvedValue(null);

      await expect(
        CollaborativeRegistryManager.removeCollaborator(registryId, collaboratorId, removedBy)
      ).rejects.toThrow('Collaborator not found');
    });
  });

  describe('checkPermission', () => {
    it('should allow registry owner full permissions', async () => {
      const registryId = 'test-registry-id';
      const ownerEmail = 'owner@example.com';

      const mockRegistry = testUtils.createMockRegistry({
        customerEmail: 'encrypted_owner@example.com',
      });

      mockPrismaClient.registry.findUnique.mockResolvedValue(mockRegistry);

      const hasPermission = await CollaborativeRegistryManager.checkPermission(
        registryId,
        ownerEmail,
        CollaboratorPermission.ADMIN
      );

      expect(hasPermission).toBe(true);
    });

    it('should check collaborator permissions correctly', async () => {
      const registryId = 'test-registry-id';
      const collaboratorEmail = 'collaborator@example.com';

      const mockRegistry = testUtils.createMockRegistry({
        customerEmail: 'encrypted_owner@example.com',
      });

      const mockCollaborator = testUtils.createMockCollaborator({
        email: 'encrypted_collaborator@example.com',
        permissions: CollaboratorPermission.READ_WRITE,
        status: CollaboratorStatus.ACTIVE,
      });

      mockPrismaClient.registry.findUnique.mockResolvedValue(mockRegistry);
      mockPrismaClient.registryCollaborator.findFirst.mockResolvedValue(mockCollaborator);

      const hasReadPermission = await CollaborativeRegistryManager.checkPermission(
        registryId,
        collaboratorEmail,
        CollaboratorPermission.READ_ONLY
      );

      const hasWritePermission = await CollaborativeRegistryManager.checkPermission(
        registryId,
        collaboratorEmail,
        CollaboratorPermission.READ_WRITE
      );

      const hasAdminPermission = await CollaborativeRegistryManager.checkPermission(
        registryId,
        collaboratorEmail,
        CollaboratorPermission.ADMIN
      );

      expect(hasReadPermission).toBe(true);
      expect(hasWritePermission).toBe(true);
      expect(hasAdminPermission).toBe(false);
    });

    it('should deny permission for non-collaborators', async () => {
      const registryId = 'test-registry-id';
      const randomEmail = 'random@example.com';

      const mockRegistry = testUtils.createMockRegistry({
        customerEmail: 'encrypted_owner@example.com',
      });

      mockPrismaClient.registry.findUnique.mockResolvedValue(mockRegistry);
      mockPrismaClient.registryCollaborator.findFirst.mockResolvedValue(null);

      const hasPermission = await CollaborativeRegistryManager.checkPermission(
        registryId,
        randomEmail,
        CollaboratorPermission.READ_ONLY
      );

      expect(hasPermission).toBe(false);
    });
  });

  describe('trackActivity', () => {
    it('should track activity successfully', async () => {
      const activityInput = {
        registryId: 'test-registry-id',
        actorEmail: 'actor@example.com',
        actorName: 'Test Actor',
        action: ActivityAction.ITEM_ADDED,
        description: 'Added item to registry',
        metadata: { itemId: 'test-item-id' },
        isSystem: false,
      };

      const mockActivity = testUtils.createMockActivity(activityInput);

      mockPrismaClient.registryActivity.create.mockResolvedValue(mockActivity);

      const result = await CollaborativeRegistryManager.trackActivity(activityInput);

      expect(result.action).toBe(ActivityAction.ITEM_ADDED);
      expect(result.description).toBe('Added item to registry');
      expect(mockPrismaClient.registryActivity.create).toHaveBeenCalledWith({
        data: {
          registryId: activityInput.registryId,
          actorEmail: activityInput.actorEmail,
          actorName: activityInput.actorName,
          action: activityInput.action,
          description: activityInput.description,
          metadata: activityInput.metadata,
          isSystem: activityInput.isSystem,
        },
      });
    });
  });

  describe('cleanupExpiredInvitations', () => {
    it('should clean up expired invitations', async () => {
      const expiredCount = 3;
      
      mockPrismaClient.registryCollaborator.deleteMany.mockResolvedValue({
        count: expiredCount,
      });

      const result = await CollaborativeRegistryManager.cleanupExpiredInvitations();

      expect(result).toBe(expiredCount);
      expect(mockPrismaClient.registryCollaborator.deleteMany).toHaveBeenCalledWith({
        where: {
          status: CollaboratorStatus.PENDING,
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});

describe('CollaborationUtils', () => {
  describe('validateCollaborationSettings', () => {
    it('should validate and return settings with defaults', () => {
      const inputSettings = {
        maxCollaborators: 5,
        requireApproval: false,
      };

      const result = CollaborationUtils.validateCollaborationSettings(inputSettings);

      expect(result).toEqual({
        maxCollaborators: 5,
        allowPublicInvites: false,
        requireApproval: false,
        autoExpireInvites: true,
        expireInvitesAfterDays: 7,
      });
    });

    it('should throw error for invalid max collaborators', () => {
      const inputSettings = {
        maxCollaborators: 0,
      };

      expect(() => {
        CollaborationUtils.validateCollaborationSettings(inputSettings);
      }).toThrow('Max collaborators must be between 1 and 50');
    });

    it('should throw error for invalid expire days', () => {
      const inputSettings = {
        expireInvitesAfterDays: 35,
      };

      expect(() => {
        CollaborationUtils.validateCollaborationSettings(inputSettings);
      }).toThrow('Expire invites after days must be between 1 and 30');
    });
  });

  describe('display name functions', () => {
    it('should return correct permission display names', () => {
      expect(CollaborationUtils.getPermissionDisplayName(CollaboratorPermission.READ_ONLY)).toBe('View Only');
      expect(CollaborationUtils.getPermissionDisplayName(CollaboratorPermission.READ_WRITE)).toBe('Edit Registry');
      expect(CollaborationUtils.getPermissionDisplayName(CollaboratorPermission.ADMIN)).toBe('Full Access');
    });

    it('should return correct role display names', () => {
      expect(CollaborationUtils.getRoleDisplayName(CollaboratorRole.OWNER)).toBe('Owner');
      expect(CollaborationUtils.getRoleDisplayName(CollaboratorRole.COLLABORATOR)).toBe('Collaborator');
      expect(CollaborationUtils.getRoleDisplayName(CollaboratorRole.VIEWER)).toBe('Viewer');
    });
  });

  describe('generateInvitationLink', () => {
    it('should generate correct invitation link', () => {
      const collaboratorId = 'test-collaborator-id';
      const baseUrl = 'https://example.com';

      const link = CollaborationUtils.generateInvitationLink(collaboratorId, baseUrl);

      expect(link).toBe(`${baseUrl}/app/collaborate/accept/${collaboratorId}`);
    });
  });
});