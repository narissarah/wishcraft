import { useState, useCallback } from 'react';
import { Card, Text, Button, Modal, TextField, Select, Badge, Icon, ButtonGroup, Tooltip, Box, InlineStack, BlockStack, DataTable, Divider, Banner, List, EmptyState } from '@shopify/polaris';
import { PersonAddIcon, DeleteIcon, EditIcon, CheckCircleIcon, AlertCircleIcon, ClockIcon } from '@shopify/polaris-icons';
import { useFetcher } from '@remix-run/react';
import type { RegistryCollaborator } from '@prisma/client';

interface CollaborationManagerProps {
  registryId: string;
  collaborators: Array<RegistryCollaborator & {
    roleDisplayName: string;
    permissionDisplayName: string;
  }>;
  activities: Array<{
    id: string;
    actorEmail: string;
    actorName?: string;
    action: string;
    description: string;
    createdAt: string;
    isSystem: boolean;
  }>;
  registry: {
    id: string;
    title: string;
    ownerEmail: string;
    collaborationEnabled: boolean;
    collaborationSettings: any;
  };
  currentUserEmail: string;
}

export function CollaborationManager({
  registryId,
  collaborators,
  activities,
  registry,
  currentUserEmail
}: CollaborationManagerProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'collaborator',
    permissions: 'read_write',
    message: ''
  });
  const [editForm, setEditForm] = useState({
    role: '',
    permissions: ''
  });

  const fetcher = useFetcher();
  const isLoading = fetcher.state === 'submitting';

  const handleInviteSubmit = useCallback(() => {
    if (!inviteForm.email.trim()) return;

    fetcher.submit(
      {
        email: inviteForm.email,
        role: inviteForm.role,
        permissions: inviteForm.permissions,
        message: inviteForm.message,
        invitedBy: currentUserEmail,
      },
      {
        method: 'POST',
        action: `/api/registries/${registryId}/collaborators`,
      }
    );

    setShowInviteModal(false);
    setInviteForm({ email: '', role: 'collaborator', permissions: 'read_write', message: '' });
  }, [inviteForm, registryId, currentUserEmail, fetcher]);

  const handleEditSubmit = useCallback(() => {
    if (!editingCollaborator) return;

    fetcher.submit(
      {
        role: editForm.role,
        permissions: editForm.permissions,
        updatedBy: currentUserEmail,
      },
      {
        method: 'PUT',
        action: `/api/registries/${registryId}/collaborators?collaboratorId=${editingCollaborator}`,
      }
    );

    setEditingCollaborator(null);
    setEditForm({ role: '', permissions: '' });
  }, [editingCollaborator, editForm, registryId, currentUserEmail, fetcher]);

  const handleRemoveCollaborator = useCallback((collaboratorId: string) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) return;

    fetcher.submit(
      {},
      {
        method: 'DELETE',
        action: `/api/registries/${registryId}/collaborators?collaboratorId=${collaboratorId}&removedBy=${currentUserEmail}`,
      }
    );
  }, [registryId, currentUserEmail, fetcher]);

  const openEditModal = useCallback((collaborator: RegistryCollaborator) => {
    setEditingCollaborator(collaborator.id);
    setEditForm({
      role: collaborator.role,
      permissions: collaborator.permissions || ''
    });
  }, []);

  const getStatusBadge = (collaborator: RegistryCollaborator) => {
    switch (collaborator.status) {
      case 'active':
        return <Badge tone="success" icon={CheckCircleIcon}>Active</Badge>;
      case 'pending':
        return <Badge tone="attention" icon={ClockIcon}>Pending</Badge>;
      case 'revoked':
        return <Badge tone="critical" icon={AlertCircleIcon}>Revoked</Badge>;
      default:
        return <Badge>collaborator.status</Badge>;
    }
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const collaboratorRows = collaborators.map((collaborator) => [
    <InlineStack gap="200" align="start">
      <div>
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {collaborator.name || collaborator.email}
        </Text>
        {collaborator.name && (
          <Text as="p" variant="bodySm" tone="subdued">
            {collaborator.email}
          </Text>
        )}
      </div>
    </InlineStack>,
    collaborator.roleDisplayName,
    collaborator.permissionDisplayName,
    getStatusBadge(collaborator),
    <Text as="p" variant="bodySm" tone="subdued">
      {formatDate(collaborator.invitedAt)}
    </Text>,
    <ButtonGroup>
      <Tooltip content="Edit collaborator">
        <Button
          variant="tertiary"
          icon={EditIcon}
          onClick={() => openEditModal(collaborator)}
          disabled={isLoading}
        />
      </Tooltip>
      <Tooltip content="Remove collaborator">
        <Button
          variant="tertiary"
          tone="critical"
          icon={DeleteIcon}
          onClick={() => handleRemoveCollaborator(collaborator.id)}
          disabled={isLoading}
        />
      </Tooltip>
    </ButtonGroup>
  ]);

  const recentActivities = activities.slice(0, 5).map((activity) => (
    <Box key={activity.id} paddingBlock="200">
      <InlineStack gap="200" align="start">
        <Icon
          source={activity.isSystem ? AlertCircleIcon : PersonAddIcon}
          tone={activity.isSystem ? 'subdued' : 'base'}
        />
        <Box>
          <Text as="p" variant="bodyMd">
            {activity.description}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {activity.actorName || activity.actorEmail} • {formatDate(activity.createdAt)}
          </Text>
        </Box>
      </InlineStack>
    </Box>
  ));

  return (
    <BlockStack gap="400">
      {/* Header */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <div>
              <Text as="h3" variant="headingMd">
                Collaboration
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Manage who can access and edit this registry
              </Text>
            </div>
            <Button
              variant="primary"
              icon={PersonAddIcon}
              onClick={() => setShowInviteModal(true)}
              disabled={isLoading}
            >
              Invite Collaborator
            </Button>
          </InlineStack>

          {!registry.collaborationEnabled && (
            <Banner tone="info">
              <Text as="p">
                Collaboration is not enabled for this registry. Enable it in registry settings to start inviting collaborators.
              </Text>
            </Banner>
          )}
        </BlockStack>
      </Card>

      {/* Collaborators Table */}
      <Card>
        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Collaborators ({collaborators.length})
          </Text>
          
          {collaborators.length === 0 ? (
            <EmptyState
              heading="No collaborators yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <Text as="p">
                Invite people to collaborate on this registry.
              </Text>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
              headings={['Name', 'Role', 'Permissions', 'Status', 'Invited', 'Actions']}
              rows={collaboratorRows}
            />
          )}
        </BlockStack>
      </Card>

      {/* Recent Activity */}
      <Card>
        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Recent Activity
          </Text>
          
          {activities.length === 0 ? (
            <Text as="p" variant="bodyMd" tone="subdued">
              No recent activity
            </Text>
          ) : (
            <BlockStack gap="200">
              {recentActivities}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {/* Invite Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Collaborator"
        primaryAction={{
          content: 'Send Invitation',
          onAction: handleInviteSubmit,
          loading: isLoading,
          disabled: !inviteForm.email.trim()
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowInviteModal(false)
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Email Address"
              value={inviteForm.email}
              onChange={(value) => setInviteForm({ ...inviteForm, email: value })}
              placeholder="collaborator@example.com"
              type="email"
              autoComplete="email"
              helpText="Enter the email address of the person you want to invite"
            />

            <Select
              label="Role"
              value={inviteForm.role}
              onChange={(value) => setInviteForm({ ...inviteForm, role: value })}
              options={[
                { label: 'Collaborator', value: 'collaborator' },
                { label: 'Viewer', value: 'viewer' }
              ]}
              helpText="Choose the role for this collaborator"
            />

            <Select
              label="Permissions"
              value={inviteForm.permissions}
              onChange={(value) => setInviteForm({ ...inviteForm, permissions: value })}
              options={[
                { label: 'View Only', value: 'read_only' },
                { label: 'Edit Registry', value: 'read_write' },
                { label: 'Full Access', value: 'admin' }
              ]}
              helpText="Set the permission level for this collaborator"
            />

            <TextField
              label="Personal Message (Optional)"
              value={inviteForm.message}
              onChange={(value) => setInviteForm({ ...inviteForm, message: value })}
              multiline={3}
              placeholder="Add a personal message to the invitation..."
              helpText="This message will be included in the invitation email"
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editingCollaborator}
        onClose={() => setEditingCollaborator(null)}
        title="Edit Collaborator"
        primaryAction={{
          content: 'Save Changes',
          onAction: handleEditSubmit,
          loading: isLoading
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setEditingCollaborator(null)
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Role"
              value={editForm.role}
              onChange={(value) => setEditForm({ ...editForm, role: value })}
              options={[
                { label: 'Collaborator', value: 'collaborator' },
                { label: 'Viewer', value: 'viewer' }
              ]}
            />

            <Select
              label="Permissions"
              value={editForm.permissions}
              onChange={(value) => setEditForm({ ...editForm, permissions: value })}
              options={[
                { label: 'View Only', value: 'read_only' },
                { label: 'Edit Registry', value: 'read_write' },
                { label: 'Full Access', value: 'admin' }
              ]}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}

/**
 * Collaboration Settings Component
 */
export function CollaborationSettings({ 
  registryId, 
  settings, 
  enabled 
}: { 
  registryId: string; 
  settings: any; 
  enabled: boolean; 
}) {
  const [localSettings, setLocalSettings] = useState(settings || {});
  const [isEnabled, setIsEnabled] = useState(enabled);
  const fetcher = useFetcher();

  const handleToggleCollaboration = useCallback(() => {
    fetcher.submit(
      {
        enabled: (!isEnabled).toString(),
        settings: JSON.stringify(localSettings)
      },
      {
        method: 'PUT',
        action: `/api/registries/${registryId}/collaboration/settings`
      }
    );
    setIsEnabled(!isEnabled);
  }, [isEnabled, localSettings, registryId, fetcher]);

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h3" variant="headingSm">
          Collaboration Settings
        </Text>
        
        <InlineStack align="space-between">
          <div>
            <Text as="p" variant="bodyMd">
              Enable Collaboration
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Allow others to help manage this registry
            </Text>
          </div>
          <Button
            variant={isEnabled ? 'primary' : 'secondary'}
            onClick={handleToggleCollaboration}
            loading={fetcher.state === 'submitting'}
          >
            {isEnabled ? 'Enabled' : 'Enable'}
          </Button>
        </InlineStack>

        {isEnabled && (
          <Box>
            <Divider />
            <BlockStack gap="300">
              <Text as="p" variant="bodySm" fontWeight="semibold">
                Collaboration Limits
              </Text>
              <List>
                <List.Item>
                  Maximum collaborators: {localSettings.maxCollaborators || 10}
                </List.Item>
                <List.Item>
                  Require approval: {localSettings.requireApproval ? 'Yes' : 'No'}
                </List.Item>
                <List.Item>
                  Auto-expire invites: {localSettings.autoExpireInvites ? 'Yes' : 'No'}
                </List.Item>
              </List>
            </BlockStack>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}

export default CollaborationManager;