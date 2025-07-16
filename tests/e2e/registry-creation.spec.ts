import { test, expect } from '@playwright/test';

test.describe('Registry Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and authenticate
    await page.goto('/app');
    
    // Mock Shopify authentication
    await page.evaluate(() => {
      window.localStorage.setItem('shopify_session', JSON.stringify({
        shop: 'test-shop.myshopify.com',
        accessToken: 'test-token',
        isOnline: true,
      }));
    });
  });

  test('should create a new registry successfully', async ({ page }) => {
    // Navigate to registry creation
    await page.click('[data-testid="create-registry-button"]');
    
    // Fill out registry form
    await page.fill('[data-testid="registry-title"]', 'My Wedding Registry');
    await page.fill('[data-testid="registry-description"]', 'A registry for our special day');
    await page.selectOption('[data-testid="event-type"]', 'wedding');
    await page.fill('[data-testid="event-date"]', '2024-12-25');
    await page.fill('[data-testid="customer-email"]', 'bride@example.com');
    await page.fill('[data-testid="customer-name"]', 'Jane Doe');
    
    // Submit form
    await page.click('[data-testid="create-registry-submit"]');
    
    // Wait for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Registry created successfully');
    
    // Verify registry appears in list
    await expect(page.locator('[data-testid="registry-list"]')).toContainText('My Wedding Registry');
  });

  test('should validate required fields', async ({ page }) => {
    // Navigate to registry creation
    await page.click('[data-testid="create-registry-button"]');
    
    // Try to submit without required fields
    await page.click('[data-testid="create-registry-submit"]');
    
    // Check for validation errors
    await expect(page.locator('[data-testid="error-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-email"]')).toBeVisible();
    
    // Fill required fields
    await page.fill('[data-testid="registry-title"]', 'Test Registry');
    await page.fill('[data-testid="customer-email"]', 'test@example.com');
    
    // Validation errors should disappear
    await expect(page.locator('[data-testid="error-title"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="error-email"]')).not.toBeVisible();
  });

  test('should enable collaboration settings', async ({ page }) => {
    // Navigate to registry creation
    await page.click('[data-testid="create-registry-button"]');
    
    // Fill basic info
    await page.fill('[data-testid="registry-title"]', 'Collaborative Registry');
    await page.fill('[data-testid="customer-email"]', 'owner@example.com');
    
    // Enable collaboration
    await page.check('[data-testid="enable-collaboration"]');
    
    // Collaboration settings should appear
    await expect(page.locator('[data-testid="collaboration-settings"]')).toBeVisible();
    
    // Configure collaboration settings
    await page.fill('[data-testid="max-collaborators"]', '5');
    await page.check('[data-testid="require-approval"]');
    
    // Submit form
    await page.click('[data-testid="create-registry-submit"]');
    
    // Verify collaboration is enabled
    await expect(page.locator('[data-testid="collaboration-enabled"]')).toBeVisible();
  });
});

test.describe('Registry Management', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test data
    await page.goto('/app');
    await page.evaluate(() => {
      // Mock existing registry data
      window.localStorage.setItem('test_registry', JSON.stringify({
        id: 'test-registry-id',
        title: 'Test Registry',
        description: 'A test registry',
        customerEmail: 'test@example.com',
        collaborationEnabled: true,
      }));
    });
  });

  test('should edit registry details', async ({ page }) => {
    // Navigate to registry
    await page.click('[data-testid="registry-test-registry-id"]');
    
    // Click edit button
    await page.click('[data-testid="edit-registry-button"]');
    
    // Update title
    await page.fill('[data-testid="registry-title"]', 'Updated Test Registry');
    
    // Save changes
    await page.click('[data-testid="save-registry-button"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="registry-title"]')).toContainText('Updated Test Registry');
  });

  test('should delete registry with confirmation', async ({ page }) => {
    // Navigate to registry
    await page.click('[data-testid="registry-test-registry-id"]');
    
    // Click delete button
    await page.click('[data-testid="delete-registry-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Verify registry is removed
    await expect(page.locator('[data-testid="registry-test-registry-id"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Registry deleted successfully');
  });
});

test.describe('Registry Items', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/registries/test-registry-id');
  });

  test('should add item to registry', async ({ page }) => {
    // Click add item button
    await page.click('[data-testid="add-item-button"]');
    
    // Search for product
    await page.fill('[data-testid="product-search"]', 'Test Product');
    await page.click('[data-testid="search-button"]');
    
    // Select product from results
    await page.click('[data-testid="product-test-product-id"]');
    
    // Set quantity
    await page.fill('[data-testid="item-quantity"]', '2');
    
    // Add to registry
    await page.click('[data-testid="add-to-registry-button"]');
    
    // Verify item is added
    await expect(page.locator('[data-testid="registry-items"]')).toContainText('Test Product');
    await expect(page.locator('[data-testid="item-quantity"]')).toContainText('2');
  });

  test('should remove item from registry', async ({ page }) => {
    // Assuming item already exists
    await page.click('[data-testid="item-test-item-id"] [data-testid="remove-item-button"]');
    
    // Confirm removal
    await page.click('[data-testid="confirm-remove-button"]');
    
    // Verify item is removed
    await expect(page.locator('[data-testid="item-test-item-id"]')).not.toBeVisible();
  });

  test('should update item quantity', async ({ page }) => {
    // Click on item quantity
    await page.click('[data-testid="item-test-item-id"] [data-testid="edit-quantity-button"]');
    
    // Update quantity
    await page.fill('[data-testid="quantity-input"]', '5');
    
    // Save changes
    await page.click('[data-testid="save-quantity-button"]');
    
    // Verify quantity is updated
    await expect(page.locator('[data-testid="item-test-item-id"] [data-testid="item-quantity"]')).toContainText('5');
  });
});

test.describe('Accessibility Tests', () => {
  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/app');
    
    // Check main navigation
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    
    // Check form labels
    await page.click('[data-testid="create-registry-button"]');
    await expect(page.locator('[data-testid="registry-title"]')).toHaveAttribute('aria-label');
    
    // Check button accessibility
    await expect(page.locator('[data-testid="create-registry-submit"]')).toHaveAttribute('type', 'submit');
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/app');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Should open create registry modal
    await expect(page.locator('[data-testid="create-registry-modal"]')).toBeVisible();
    
    // Test escape key
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="create-registry-modal"]')).not.toBeVisible();
  });
});

test.describe('Performance Tests', () => {
  test('should load registry list quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/app');
    
    // Wait for registries to load
    await page.waitForSelector('[data-testid="registry-list"]');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle large registry lists efficiently', async ({ page }) => {
    // Mock large dataset
    await page.evaluate(() => {
      const largeRegistryList = Array.from({ length: 100 }, (_, i) => ({
        id: `registry-${i}`,
        title: `Registry ${i}`,
        customerEmail: `user${i}@example.com`,
        createdAt: new Date().toISOString(),
      }));
      
      window.localStorage.setItem('large_registry_list', JSON.stringify(largeRegistryList));
    });
    
    const startTime = Date.now();
    await page.goto('/app');
    
    // Wait for list to render
    await page.waitForSelector('[data-testid="registry-list"]');
    
    const loadTime = Date.now() - startTime;
    
    // Should still load within reasonable time
    expect(loadTime).toBeLessThan(5000);
    
    // Check that virtual scrolling is working
    const visibleItems = await page.locator('[data-testid^="registry-"]').count();
    expect(visibleItems).toBeLessThan(100); // Should not render all items at once
  });
});