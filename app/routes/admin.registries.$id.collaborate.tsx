import { LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Button, 
  TextField, 
  Select, 
  Badge,
  BlockStack,
  InlineStack,
  Divider,
  Banner,
  Modal,
  DataTable,
  Avatar,
  Tooltip,
  Icon
} from "@shopify/polaris";
import { PersonIcon, SettingsIcon, ViewIcon, EditIcon } from '@shopify/polaris-icons';
import { authenticate } from "~/shopify.server";
import { getRegistryWithCollaborators, addCollaborator, updateCollaborator, removeCollaborator } from "~/lib/registry.server";
import { LiveViewers, ActivityFeed } from "~/components/RealtimeComponents";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Registry not found", { status: 404 });
  }

  try {
    // SECURITY FIX: Pass shopId for proper multi-store isolation
    const registry = await getRegistryWithCollaborators(id, session.shop);
    
    if (!registry) {
      throw new Response("Registry not found", { status: 404 });
    }

    // Shop validation is now handled by the secure function
    return json({ registry, session });
  } catch (error) {
    throw new Response("Failed to load registry", { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (!id) {
    return json({ error: "Registry ID required" }, { status: 400 });
  }

  try {
    switch (intent) {
      case "add_collaborator": {
        const collaborator = await addCollaborator(id, {
          email: formData.get("email") as string,
          role: formData.get("role") as string,
          permissions: JSON.parse(formData.get("permissions") as string || "[]"),
          invitedBy: session.shop
        });

        return json({ 
          success: true, 
          collaborator,
          message: "Collaborator invited successfully" 
        });
      }

      case "update_collaborator": {
        const collaboratorId = formData.get("collaboratorId") as string;
        const updates = {
          role: formData.get("role") as string,
          permissions: JSON.parse(formData.get("permissions") as string || "[]"),
          status: formData.get("status") as string
        };

        const collaborator = await updateCollaborator(collaboratorId, updates);
        
        return json({ 
          success: true, 
          collaborator,
          message: "Collaborator updated successfully" 
        });
      }

      case "remove_collaborator": {
        const collaboratorId = formData.get("collaboratorId") as string;
        await removeCollaborator(collaboratorId);
        
        return json({ 
          success: true,
          message: "Collaborator removed successfully" 
        });
      }

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    return json({ 
      error: error instanceof Error ? error.message : "Action failed" 
    }, { status: 400 });
  }
}

export default function RegistryCollaboratePage() {
  const { registry, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'viewer',
    permissions: [] as string[]
  });

  const roleOptions = [
    { label: 'Viewer', value: 'viewer' },
    { label: 'Editor', value: 'editor' },
    { label: 'Manager', value: 'manager' }
  ];

  const permissionOptions = [
    { id: 'view_registry', label: 'View registry', description: 'Can view all registry items and details' },
    { id: 'edit_items', label: 'Edit items', description: 'Can add, remove, and modify registry items' },
    { id: 'manage_settings', label: 'Manage settings', description: 'Can change registry settings and privacy' },
    { id: 'invite_collaborators', label: 'Invite collaborators', description: 'Can invite and manage other collaborators' },
    { id: 'view_analytics', label: 'View analytics', description: 'Can access registry analytics and insights' },
    { id: 'manage_group_gifts', label: 'Manage group gifts', description: 'Can create and manage group gift campaigns' }
  ];

  const getDefaultPermissions = (role: string): string[] => {
    switch (role) {
      case 'viewer':
        return ['view_registry'];
      case 'editor':
        return ['view_registry', 'edit_items'];
      case 'manager':
        return ['view_registry', 'edit_items', 'manage_settings', 'invite_collaborators', 'view_analytics', 'manage_group_gifts'];
      default:
        return ['view_registry'];
    }
  };

  const handleRoleChange = (role: string) => {
    setInviteForm({
      ...inviteForm,
      role,
      permissions: getDefaultPermissions(role)
    });
  };

  const handlePermissionToggle = (permission: string) => {
    const newPermissions = inviteForm.permissions.includes(permission)
      ? inviteForm.permissions.filter(p => p !== permission)
      : [...inviteForm.permissions, permission];
    
    setInviteForm({ ...inviteForm, permissions: newPermissions });
  };

  const collaboratorRows = registry.collaborators.map((collab: any) => [
    <InlineStack gap="200" blockAlign="center" key={`avatar-${collab.id}`}>
      <Avatar size="extraSmall" name={collab.name || collab.email} />
      <BlockStack gap="100">
        <Text variant="bodyMd" fontWeight="medium">
          {collab.name || collab.email}
        </Text>
        <Text variant="bodySm" tone="subdued">
          {collab.email}
        </Text>
      </BlockStack>
    </InlineStack>,
    <Badge tone={collab.role === 'manager' ? 'success' : collab.role === 'editor' ? 'info' : 'subdued'} key={`role-${collab.id}`}>
      {collab.role}
    </Badge>,
    <Badge 
      tone={collab.status === 'active' ? 'success' : collab.status === 'pending' ? 'attention' : 'critical'}
      key={`status-${collab.id}`}
    >
      {collab.status}
    </Badge>,
    <Text variant="bodySm" tone="subdued" key={`invited-${collab.id}`}>
      {new Date(collab.createdAt).toLocaleDateString()}
    </Text>,
    <InlineStack gap="100" key={`actions-${collab.id}`}>
      <Button 
        variant="plain" 
        size="micro"
        icon={EditIcon}
        onClick={() => setEditingCollaborator(collab)}
      />
      <Button 
        variant="plain" 
        size="micro" 
        tone="critical"
        onClick={() => {
          if (confirm('Remove this collaborator?')) {
            fetcher.submit({
              intent: 'remove_collaborator',
              collaboratorId: collab.id
            }, { method: 'post' });
          }
        }}
      >
        Remove
      </Button>
    </InlineStack>
  ]);

  return (
    <Page 
      title="Collaborate on Registry"
      subtitle={`Manage collaborators for "${registry.title}"`}
      backAction={{
        content: 'Back to Registry',
        url: `/admin/registries/${registry.id}`
      }}
      primaryAction={{
        content: 'Invite Collaborator',
        icon: PersonIcon,
        onAction: () => setShowInviteModal(true)
      }}
    >
      <Layout>
        <Layout.Section variant="oneThird">
          {/* Live Viewers */}
          <LiveViewers 
            registryId={registry.id} 
            currentUserId={session.shop}
            showDetails={true}
          />

          {/* Registry Stats */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">Registry Stats</Text>
              
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd">Total Items</Text>
                  <Badge>{registry._count?.items || 0}</Badge>
                </InlineStack>
                
                <InlineStack align="space-between">
                  <Text variant="bodyMd">Collaborators</Text>
                  <Badge>{registry.collaborators.length}</Badge>
                </InlineStack>
                
                <InlineStack align="space-between">
                  <Text variant="bodyMd">Views Today</Text>
                  <Badge>{registry.analytics?.viewsToday || 0}</Badge>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          {/* Activity Feed */}
          <ActivityFeed 
            registryId={registry.id}
            maxItems={8}
            showTimestamps={true}
          />
        </Layout.Section>

        <Layout.Section variant="twoThirds">
          {actionData?.error && (
            <Banner tone="critical">
              <Text>{actionData.error}</Text>
            </Banner>
          )}

          {actionData?.success && (
            <Banner tone="success">
              <Text>{actionData.message}</Text>
            </Banner>
          )}

          {/* Collaborators Table */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Collaborators</Text>
                <Button 
                  variant="primary"
                  icon={PersonIcon}
                  onClick={() => setShowInviteModal(true)}
                >
                  Invite Collaborator
                </Button>
              </InlineStack>

              {registry.collaborators.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Collaborator', 'Role', 'Status', 'Invited', 'Actions']}
                  rows={collaboratorRows}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <Icon source={PersonIcon} tone="subdued" />
                  <Text variant="bodyMd" tone="subdued" alignment="center">
                    No collaborators yet. Invite someone to help manage this registry.
                  </Text>
                  <div style={{ marginTop: '16px' }}>
                    <Button 
                      variant="primary"
                      onClick={() => setShowInviteModal(true)}
                    >
                      Invite Your First Collaborator
                    </Button>
                  </div>
                </div>
              )}
            </BlockStack>
          </Card>

          {/* Collaboration Settings */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Collaboration Settings</Text>
              
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="medium">
                      Allow public collaboration
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Anyone with the link can suggest items
                    </Text>
                  </BlockStack>
                  <Button variant="plain">
                    {registry.allowPublicCollaboration ? 'Enabled' : 'Disabled'}
                  </Button>
                </InlineStack>

                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="medium">
                      Require approval for new items
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      New items need owner approval before being added
                    </Text>
                  </BlockStack>
                  <Button variant="plain">
                    {registry.requireApproval ? 'Enabled' : 'Disabled'}
                  </Button>
                </InlineStack>

                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="medium">
                      Show collaborator names
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Display who added each item
                    </Text>
                  </BlockStack>
                  <Button variant="plain">
                    {registry.showCollaboratorNames ? 'Enabled' : 'Disabled'}
                  </Button>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Invite Collaborator Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Collaborator"
        size="large"
        primaryAction={{
          content: 'Send Invitation',
          onAction: () => {
            fetcher.submit({
              intent: 'add_collaborator',
              email: inviteForm.email,
              role: inviteForm.role,
              permissions: JSON.stringify(inviteForm.permissions)
            }, { method: 'post' });
            setShowInviteModal(false);
            setInviteForm({ email: '', role: 'viewer', permissions: ['view_registry'] });
          }
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowInviteModal(false)
        }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Email Address"
              value={inviteForm.email}
              onChange={(value) => setInviteForm({ ...inviteForm, email: value })}
              autoComplete="email"
              placeholder="collaborator@example.com"
            />

            <Select
              label="Role"
              options={roleOptions}
              value={inviteForm.role}
              onChange={handleRoleChange}
            />

            <BlockStack gap="300">
              <Text variant="bodyMd" fontWeight="medium">Permissions</Text>
              
              {permissionOptions.map(permission => (
                <label key={permission.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={inviteForm.permissions.includes(permission.id)}
                    onChange={() => handlePermissionToggle(permission.id)}
                    style={{ marginTop: '2px' }}
                  />
                  <BlockStack gap="100">
                    <Text variant="bodyMd">{permission.label}</Text>
                    <Text variant="bodySm" tone="subdued">{permission.description}</Text>
                  </BlockStack>
                </label>
              ))}
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Edit Collaborator Modal */}
      {editingCollaborator && (
        <Modal
          open={!!editingCollaborator}
          onClose={() => setEditingCollaborator(null)}
          title="Edit Collaborator"
          size="large"
          primaryAction={{
            content: 'Update',
            onAction: () => {
              // Submit updates
              setEditingCollaborator(null);
            }
          }}
          secondaryActions={[{
            content: 'Cancel',
            onAction: () => setEditingCollaborator(null)
          }]}
        >
          <Modal.Section>
            <Text>Edit collaborator functionality would be implemented here...</Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}