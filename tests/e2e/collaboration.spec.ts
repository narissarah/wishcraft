import { test, expect } from '@playwright/test';

test.describe('Collaboration Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    
    // Mock authentication
    await page.evaluate(() => {
      window.localStorage.setItem('shopify_session', JSON.stringify({
        shop: 'test-shop.myshopify.com',
        accessToken: 'test-token',
        isOnline: true,
      }));
      
      // Mock registry with collaboration enabled
      window.localStorage.setItem('test_registry', JSON.stringify({
        id: 'test-registry-id',
        title: 'Wedding Registry',
        description: 'Our special day registry',
        customerEmail: 'bride@example.com',
        collaborationEnabled: true,
        collaborationSettings: {
          maxCollaborators: 10,
          requireApproval: true,
          allowPublicInvites: false,
        },
      }));
    });
  });

  test('should invite collaborator successfully', async ({ page }) => {
    // Navigate to registry collaboration page
    await page.goto('/app/registries/test-registry-id/collaborators');
    
    // Click invite collaborator button
    await page.click('[data-testid="invite-collaborator-button"]');
    
    // Fill invitation form
    await page.fill('[data-testid="collaborator-email"]', 'friend@example.com');
    await page.selectOption('[data-testid="collaborator-role"]', 'collaborator');
    await page.selectOption('[data-testid="collaborator-permissions"]', 'read_write');
    await page.fill('[data-testid="invitation-message"]', 'Please help me manage this registry!');
    
    // Send invitation
    await page.click('[data-testid="send-invitation-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Invitation sent successfully');
    
    // Verify collaborator appears in pending list
    await expect(page.locator('[data-testid="collaborator-friend@example.com"]')).toBeVisible();
    await expect(page.locator('[data-testid="collaborator-status"]')).toContainText('Pending');
  });

  test('should validate invitation form fields', async ({ page }) => {
    await page.goto('/app/registries/test-registry-id/collaborators');
    
    // Click invite collaborator button
    await page.click('[data-testid="invite-collaborator-button"]');
    
    // Try to submit without required fields
    await page.click('[data-testid="send-invitation-button"]');
    
    // Check for validation errors
    await expect(page.locator('[data-testid="error-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-role"]')).toBeVisible();
    
    // Fill invalid email
    await page.fill('[data-testid="collaborator-email"]', 'invalid-email');
    await page.click('[data-testid="send-invitation-button"]');
    
    // Check for email validation error
    await expect(page.locator('[data-testid="error-email"]')).toContainText('Invalid email format');
    
    // Fill valid email
    await page.fill('[data-testid="collaborator-email"]', 'valid@example.com');
    
    // Email error should disappear
    await expect(page.locator('[data-testid="error-email"]')).not.toBeVisible();
  });

  test('should remove collaborator with confirmation', async ({ page }) => {
    // Mock existing collaborator
    await page.evaluate(() => {
      window.localStorage.setItem('test_collaborators', JSON.stringify([
        {
          id: 'collaborator-1',
          email: 'collaborator@example.com',
          name: 'John Collaborator',
          role: 'collaborator',
          permissions: 'read_write',
          status: 'active',
          invitedAt: new Date().toISOString(),
        },
      ]));
    });
    
    await page.goto('/app/registries/test-registry-id/collaborators');
    
    // Click remove collaborator button
    await page.click('[data-testid="collaborator-collaborator-1"] [data-testid="remove-collaborator-button"]');
    
    // Confirm removal
    await page.click('[data-testid="confirm-remove-button"]');
    
    // Verify collaborator is removed
    await expect(page.locator('[data-testid="collaborator-collaborator-1"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Collaborator removed successfully');
  });

  test('should update collaborator permissions', async ({ page }) => {
    // Mock existing collaborator
    await page.evaluate(() => {
      window.localStorage.setItem('test_collaborators', JSON.stringify([
        {
          id: 'collaborator-1',
          email: 'collaborator@example.com',
          name: 'John Collaborator',
          role: 'collaborator',
          permissions: 'read_only',
          status: 'active',
        },
      ]));
    });
    
    await page.goto('/app/registries/test-registry-id/collaborators');
    
    // Click edit collaborator button
    await page.click('[data-testid="collaborator-collaborator-1"] [data-testid="edit-collaborator-button"]');
    
    // Update permissions
    await page.selectOption('[data-testid="collaborator-permissions"]', 'read_write');
    
    // Save changes
    await page.click('[data-testid="save-collaborator-button"]');
    
    // Verify permissions are updated
    await expect(page.locator('[data-testid="collaborator-collaborator-1"] [data-testid="permission-display"]')).toContainText('Edit Registry');
  });

  test('should display collaboration activity feed', async ({ page }) => {
    // Mock activity data
    await page.evaluate(() => {
      window.localStorage.setItem('test_activities', JSON.stringify([
        {
          id: 'activity-1',
          actorEmail: 'collaborator@example.com',
          actorName: 'John Collaborator',
          action: 'item_added',
          description: 'Added Test Product to registry',
          createdAt: new Date().toISOString(),
          isSystem: false,
        },
        {
          id: 'activity-2',
          actorEmail: 'bride@example.com',
          actorName: 'Jane Bride',
          action: 'collaborator_invited',
          description: 'Invited friend@example.com as collaborator',
          createdAt: new Date().toISOString(),
          isSystem: false,
        },
      ]));
    });
    
    await page.goto('/app/registries/test-registry-id/collaborators');
    
    // Verify activity feed is visible
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible();
    
    // Verify activities are displayed
    await expect(page.locator('[data-testid="activity-activity-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="activity-activity-1"]')).toContainText('Added Test Product to registry');
    await expect(page.locator('[data-testid="activity-activity-2"]')).toContainText('Invited friend@example.com as collaborator');
  });
});

test.describe('Invitation Acceptance Flow', () => {
  test('should accept invitation successfully', async ({ page }) => {
    // Mock invitation data
    await page.evaluate(() => {
      window.localStorage.setItem('test_invitation', JSON.stringify({
        id: 'invitation-123',
        email: 'invited@example.com',
        role: 'collaborator',
        permissions: 'read_write',
        invitedBy: 'owner@example.com',
        registry: {
          id: 'test-registry-id',
          title: 'Wedding Registry',
          description: 'Our special day registry',
          owner: {
            email: 'owner@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
      }));
    });
    
    // Navigate to invitation acceptance page
    await page.goto('/app/collaborate/accept/invitation-123');
    
    // Verify invitation details are displayed
    await expect(page.locator('[data-testid="invitation-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="registry-title"]')).toContainText('Wedding Registry');
    await expect(page.locator('[data-testid="invited-by"]')).toContainText('Jane Doe');
    await expect(page.locator('[data-testid="role"]')).toContainText('Collaborator');
    
    // Fill acceptor information
    await page.fill('[data-testid="acceptor-name"]', 'John Friend');
    await page.fill('[data-testid="acceptor-email"]', 'invited@example.com');
    
    // Accept invitation
    await page.click('[data-testid="accept-invitation-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Invitation accepted successfully');
    
    // Should redirect to registry
    await expect(page).toHaveURL('/app/registries/test-registry-id');
  });

  test('should decline invitation', async ({ page }) => {
    await page.goto('/app/collaborate/accept/invitation-123');
    
    // Fill acceptor information
    await page.fill('[data-testid="acceptor-name"]', 'John Friend');
    await page.fill('[data-testid="acceptor-email"]', 'invited@example.com');
    
    // Decline invitation
    await page.click('[data-testid="decline-invitation-button"]');
    
    // Verify decline message
    await expect(page.locator('[data-testid="decline-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="decline-message"]')).toContainText('Invitation declined');
  });

  test('should handle expired invitations', async ({ page }) => {
    // Mock expired invitation
    await page.evaluate(() => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      window.localStorage.setItem('test_invitation', JSON.stringify({
        id: 'invitation-123',
        email: 'invited@example.com',
        expiresAt: expiredDate.toISOString(),
        status: 'pending',
      }));
    });
    
    await page.goto('/app/collaborate/accept/invitation-123');
    
    // Verify expired message
    await expect(page.locator('[data-testid="expired-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="expired-message"]')).toContainText('Invitation has expired');
    
    // Accept/decline buttons should be disabled
    await expect(page.locator('[data-testid="accept-invitation-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="decline-invitation-button"]')).toBeDisabled();
  });

  test('should validate email mismatch', async ({ page }) => {
    await page.goto('/app/collaborate/accept/invitation-123');
    
    // Fill wrong email
    await page.fill('[data-testid="acceptor-name"]', 'John Friend');
    await page.fill('[data-testid="acceptor-email"]', 'wrong@example.com');
    
    // Try to accept
    await page.click('[data-testid="accept-invitation-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Email mismatch');
  });
});

test.describe('Collaboration Permissions', () => {
  test('should enforce read-only permissions', async ({ page }) => {
    // Mock read-only collaborator session
    await page.evaluate(() => {
      window.localStorage.setItem('user_permissions', JSON.stringify({
        registryId: 'test-registry-id',
        permissions: 'read_only',
        role: 'viewer',
      }));
    });
    
    await page.goto('/app/registries/test-registry-id');
    
    // Verify read-only UI
    await expect(page.locator('[data-testid="add-item-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="edit-registry-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="delete-registry-button"]')).not.toBeVisible();
    
    // Verify view permissions
    await expect(page.locator('[data-testid="registry-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="registry-items"]')).toBeVisible();
  });

  test('should enforce edit permissions', async ({ page }) => {
    // Mock edit permissions
    await page.evaluate(() => {
      window.localStorage.setItem('user_permissions', JSON.stringify({
        registryId: 'test-registry-id',
        permissions: 'read_write',
        role: 'collaborator',
      }));
    });
    
    await page.goto('/app/registries/test-registry-id');
    
    // Verify edit permissions
    await expect(page.locator('[data-testid="add-item-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-registry-button"]')).toBeVisible();
    
    // Should not have admin permissions
    await expect(page.locator('[data-testid="delete-registry-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="invite-collaborator-button"]')).not.toBeVisible();
  });

  test('should enforce admin permissions', async ({ page }) => {
    // Mock admin permissions
    await page.evaluate(() => {
      window.localStorage.setItem('user_permissions', JSON.stringify({
        registryId: 'test-registry-id',
        permissions: 'admin',
        role: 'collaborator',
      }));
    });
    
    await page.goto('/app/registries/test-registry-id');
    
    // Verify admin permissions
    await expect(page.locator('[data-testid="add-item-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-registry-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-registry-button"]')).toBeVisible();
    
    // Should have collaboration management access
    await page.goto('/app/registries/test-registry-id/collaborators');
    await expect(page.locator('[data-testid="invite-collaborator-button"]')).toBeVisible();
  });
});

test.describe('Real-time Collaboration', () => {
  test('should receive real-time updates', async ({ page, context }) => {
    // Open two browser contexts to simulate collaboration
    const page1 = page;
    const page2 = await context.newPage();
    
    // Set up both pages
    await page1.goto('/app/registries/test-registry-id');
    await page2.goto('/app/registries/test-registry-id');
    
    // Mock real-time connection
    await page1.evaluate(() => {
      window.addEventListener('message', (event) => {
        if (event.data.type === 'registry_update') {
          // Simulate real-time update
          document.dispatchEvent(new CustomEvent('registry_updated', { detail: event.data }));
        }
      });
    });
    
    // Add item on page1
    await page1.click('[data-testid="add-item-button"]');
    await page1.fill('[data-testid="product-search"]', 'Test Product');
    await page1.click('[data-testid="add-to-registry-button"]');
    
    // Simulate real-time update to page2
    await page2.evaluate(() => {
      window.postMessage({
        type: 'registry_update',
        action: 'item_added',
        item: { id: 'test-item', title: 'Test Product' },
      }, '*');
    });
    
    // Verify page2 receives the update
    await expect(page2.locator('[data-testid="registry-items"]')).toContainText('Test Product');
  });
});