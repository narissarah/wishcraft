import { test, expect, type Page } from '@playwright/test';

// Test configuration
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test.describe('Registry Creation and Management E2E', () => {
  test.beforeEach(async () => {
    // Reset database state before each test
    await page.goto('/test/reset-db');
    
    // Mock Shopify authentication
    await page.route('**/auth/shopify', async route => {
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/admin/registries'
        }
      });
    });

    // Mock Shopify GraphQL API responses
    await page.route('**/admin/api/**', async route => {
      const url = route.request().url();
      const method = route.request().method();
      const postData = route.request().postData();

      if (method === 'POST' && postData?.includes('products')) {
        // Mock products query
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              products: {
                edges: [
                  {
                    node: {
                      id: 'gid://shopify/Product/123',
                      title: 'Wedding Dress',
                      handle: 'wedding-dress',
                      description: 'Beautiful wedding dress',
                      featuredImage: {
                        url: 'https://example.com/dress.jpg',
                        altText: 'Wedding Dress'
                      },
                      priceRange: {
                        minVariantPrice: {
                          amount: '299.99',
                          currencyCode: 'USD'
                        }
                      },
                      variants: {
                        edges: [
                          {
                            node: {
                              id: 'gid://shopify/ProductVariant/456',
                              title: 'Size M',
                              price: '299.99',
                              availableForSale: true,
                              inventoryQuantity: 5
                            }
                          }
                        ]
                      }
                    }
                  },
                  {
                    node: {
                      id: 'gid://shopify/Product/789',
                      title: 'Wedding Shoes',
                      handle: 'wedding-shoes',
                      description: 'Elegant wedding shoes',
                      featuredImage: {
                        url: 'https://example.com/shoes.jpg',
                        altText: 'Wedding Shoes'
                      },
                      priceRange: {
                        minVariantPrice: {
                          amount: '149.99',
                          currencyCode: 'USD'
                        }
                      },
                      variants: {
                        edges: [
                          {
                            node: {
                              id: 'gid://shopify/ProductVariant/101',
                              title: 'Size 8',
                              price: '149.99',
                              availableForSale: true,
                              inventoryQuantity: 3
                            }
                          }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          })
        });
      } else {
        // Default successful response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: {} })
        });
      }
    });
  });

  test('should complete full registry creation journey', async () => {
    // Step 1: Navigate to create registry page
    await page.goto('/admin/registries/new');
    await expect(page.locator('h1')).toContainText('Create New Registry');

    // Step 2: Fill out registry basic information
    await page.getByLabel('Registry Title').fill('Sarah & John\'s Wedding Registry');
    await page.getByLabel('Description').fill('Help us celebrate our special day with these wonderful gifts!');
    
    // Select event type
    await page.getByLabel('Event Type').selectOption('wedding');
    
    // Set event date (future date)
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);
    await page.getByLabel('Event Date').fill(futureDate.toISOString().split('T')[0]);

    // Step 3: Configure privacy settings
    await page.getByRole('radio', { name: 'Public' }).check();
    await expect(page.getByRole('radio', { name: 'Public' })).toBeChecked();

    // Step 4: Add shipping address
    await page.getByLabel('First Name').fill('Sarah');
    await page.getByLabel('Last Name').fill('Johnson');
    await page.getByLabel('Address').fill('123 Wedding Lane');
    await page.getByLabel('City').fill('Love City');
    await page.getByLabel('State/Province').fill('CA');
    await page.getByLabel('ZIP/Postal Code').fill('90210');

    // Step 5: Create the registry
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Verify successful creation
    await expect(page.locator('.banner--success')).toContainText('Registry created successfully');
    await expect(page.url()).toMatch(/\/admin\/registries\/[a-zA-Z0-9_-]+/);
    
    // Verify registry details are displayed
    await expect(page.locator('h1')).toContainText('Sarah & John\'s Wedding Registry');
    await expect(page.locator('[data-testid="registry-description"]')).toContainText('Help us celebrate our special day');
    await expect(page.locator('[data-testid="event-type"]')).toContainText('Wedding');
  });

  test('should add products to registry from catalog', async () => {
    // First create a registry
    await page.goto('/admin/registries/new');
    await page.getByLabel('Registry Title').fill('Test Registry for Products');
    await page.getByLabel('Description').fill('Test description');
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Navigate to add products
    await page.getByRole('link', { name: 'Add Products' }).click();
    await expect(page.locator('h1')).toContainText('Add Products to Registry');

    // Wait for products to load
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount(2);

    // Select first product (Wedding Dress)
    await page.locator('[data-testid="product-card"]:first-child').click();
    await expect(page.locator('[data-testid="product-card"]:first-child')).toHaveClass(/selected/);

    // Configure product options
    await page.getByLabel('Quantity').fill('1');
    await page.getByLabel('Priority').selectOption('high');
    await page.getByLabel('Notes').fill('Size M preferred, white color');

    // Add to registry
    await page.getByRole('button', { name: 'Add Selected Products' }).click();

    // Verify success message
    await expect(page.locator('.banner--success')).toContainText('Products added to registry successfully');

    // Verify product appears in registry
    await page.goto('/admin/registries');
    await page.locator('[data-testid="registry-link"]:first-child').click();
    
    await expect(page.locator('[data-testid="registry-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="registry-item"]')).toContainText('Wedding Dress');
    await expect(page.locator('[data-testid="item-priority"]')).toContainText('High');
    await expect(page.locator('[data-testid="item-notes"]')).toContainText('Size M preferred');
  });

  test('should manage registry items (edit, remove, reorder)', async () => {
    // Setup: Create registry with products
    await page.goto('/admin/registries/new');
    await page.getByLabel('Registry Title').fill('Test Item Management');
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Add multiple products
    await page.getByRole('link', { name: 'Add Products' }).click();
    await page.locator('[data-testid="product-card"]:first-child').click();
    await page.locator('[data-testid="product-card"]:nth-child(2)').click();
    await page.getByRole('button', { name: 'Add Selected Products' }).click();

    // Return to registry view
    await page.goto('/admin/registries');
    await page.locator('[data-testid="registry-link"]:first-child').click();

    // Test editing an item
    await page.locator('[data-testid="edit-item"]:first-child').click();
    await page.getByLabel('Quantity').fill('3');
    await page.getByLabel('Priority').selectOption('medium');
    await page.getByLabel('Notes').fill('Updated notes for this item');
    await page.getByRole('button', { name: 'Update Item' }).click();

    // Verify edit
    await expect(page.locator('[data-testid="item-quantity"]:first-child')).toContainText('3');
    await expect(page.locator('[data-testid="item-priority"]:first-child')).toContainText('Medium');

    // Test removing an item
    await page.locator('[data-testid="remove-item"]:nth-child(2)').click();
    await page.getByRole('button', { name: 'Confirm Remove' }).click();

    // Verify removal
    await expect(page.locator('[data-testid="registry-item"]')).toHaveCount(1);
    await expect(page.locator('.banner--success')).toContainText('Item removed from registry');

    // Test reordering (drag and drop simulation)
    if ((await page.locator('[data-testid="registry-item"]').count()) > 1) {
      const firstItem = page.locator('[data-testid="registry-item"]:first-child');
      const secondItem = page.locator('[data-testid="registry-item"]:nth-child(2)');
      
      await firstItem.dragTo(secondItem);
      
      // Verify order changed (this would need to be implemented in the actual app)
      await expect(page.locator('.banner--success')).toContainText('Item order updated');
    }
  });

  test('should update registry settings', async () => {
    // Create registry first
    await page.goto('/admin/registries/new');
    await page.getByLabel('Registry Title').fill('Settings Test Registry');
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.locator('h1')).toContainText('Registry Settings');

    // Test basic information updates
    await page.getByLabel('Registry Title').fill('Updated Registry Title');
    await page.getByLabel('Description').fill('This is an updated description for the registry');

    // Change privacy settings
    await page.getByRole('radio', { name: 'Private' }).check();
    await expect(page.getByRole('radio', { name: 'Private' })).toBeChecked();

    // Update event date
    const newDate = new Date();
    newDate.setMonth(newDate.getMonth() + 12);
    await page.getByLabel('Event Date').fill(newDate.toISOString().split('T')[0]);

    // Save settings
    await page.getByRole('button', { name: 'Save Settings' }).click();

    // Verify updates
    await expect(page.locator('.banner--success')).toContainText('Registry settings updated successfully');
    
    // Return to registry view and verify changes
    await page.getByRole('link', { name: 'View Registry' }).click();
    await expect(page.locator('h1')).toContainText('Updated Registry Title');
    await expect(page.locator('[data-testid="registry-description"]')).toContainText('This is an updated description');
    await expect(page.locator('[data-testid="privacy-badge"]')).toContainText('Private');
  });

  test('should handle registry sharing functionality', async () => {
    // Create public registry
    await page.goto('/admin/registries/new');
    await page.getByLabel('Registry Title').fill('Shareable Registry');
    await page.getByRole('radio', { name: 'Public' }).check();
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Navigate to sharing options
    await page.getByRole('link', { name: 'Share' }).click();
    await expect(page.locator('h2')).toContainText('Share Your Registry');

    // Test registry URL display
    const registryUrl = await page.locator('[data-testid="registry-url"]').textContent();
    expect(registryUrl).toMatch(/\/registry\/[a-zA-Z0-9_-]+/);

    // Test social media sharing buttons
    await expect(page.getByRole('link', { name: /Share on Facebook/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Share on Twitter/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Share on Pinterest/ })).toBeVisible();

    // Test email sharing
    await page.getByRole('button', { name: 'Share via Email' }).click();
    await page.getByLabel('Recipient Email').fill('friend@example.com');
    await page.getByLabel('Personal Message').fill('Check out our wedding registry!');
    await page.getByRole('button', { name: 'Send Email' }).click();

    // Verify email sharing success
    await expect(page.locator('.banner--success')).toContainText('Registry shared successfully');

    // Test QR code generation
    await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();
    
    // Test copy link functionality
    await page.getByRole('button', { name: 'Copy Link' }).click();
    await expect(page.locator('.banner--success')).toContainText('Link copied to clipboard');
  });

  test('should display registry analytics and insights', async () => {
    // Create registry with some mock activity
    await page.goto('/admin/registries/new');
    await page.getByLabel('Registry Title').fill('Analytics Test Registry');
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Add products to registry
    await page.getByRole('link', { name: 'Add Products' }).click();
    await page.locator('[data-testid="product-card"]:first-child').click();
    await page.getByRole('button', { name: 'Add Selected Products' }).click();

    // Navigate to analytics
    await page.getByRole('link', { name: 'Analytics' }).click();
    await expect(page.locator('h1')).toContainText('Registry Analytics');

    // Check analytics cards are displayed
    await expect(page.locator('[data-testid="total-views"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-purchases"]')).toBeVisible();
    await expect(page.locator('[data-testid="completion-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-items"]')).toBeVisible();

    // Test date range filtering
    await page.getByLabel('Date Range').selectOption('last-30-days');
    await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();

    // Test export functionality
    await page.getByRole('button', { name: 'Export Data' }).click();
    
    // Verify export options
    await expect(page.getByRole('menuitem', { name: 'Export as CSV' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Export as PDF' })).toBeVisible();
  });

  test('should handle registry deletion with confirmation', async () => {
    // Create registry to delete
    await page.goto('/admin/registries/new');
    await page.getByLabel('Registry Title').fill('Registry to Delete');
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();

    // Scroll to danger zone
    await page.locator('[data-testid="danger-zone"]').scrollIntoViewIfNeeded();

    // Attempt deletion
    await page.getByRole('button', { name: 'Delete Registry' }).click();

    // Verify confirmation modal
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('Delete Registry');

    // Type confirmation text
    await page.getByLabel('Type "DELETE" to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Permanently Delete' }).click();

    // Verify deletion success and redirect
    await expect(page.locator('.banner--success')).toContainText('Registry deleted successfully');
    await expect(page.url()).toMatch(/\/admin\/registries$/);

    // Verify registry no longer appears in list
    const registryCards = page.locator('[data-testid="registry-card"]');
    for (let i = 0; i < await registryCards.count(); i++) {
      await expect(registryCards.nth(i)).not.toContainText('Registry to Delete');
    }
  });

  test('should validate form inputs and show appropriate errors', async () => {
    await page.goto('/admin/registries/new');

    // Try to submit empty form
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Check for validation errors
    await expect(page.locator('[data-testid="title-error"]')).toContainText('Registry title is required');
    await expect(page.locator('[data-testid="description-error"]')).toContainText('Description is required');

    // Test title length validation
    await page.getByLabel('Registry Title').fill('x'.repeat(101)); // Assuming 100 char limit
    await expect(page.locator('[data-testid="title-error"]')).toContainText('Title must be 100 characters or less');

    // Test invalid event date (past date)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    await page.getByLabel('Event Date').fill(pastDate.toISOString().split('T')[0]);
    await page.getByRole('button', { name: 'Create Registry' }).click();
    await expect(page.locator('[data-testid="date-error"]')).toContainText('Event date must be in the future');

    // Test email validation in shipping address
    await page.getByLabel('Email').fill('invalid-email');
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Please enter a valid email address');

    // Fix validation errors and submit successfully
    await page.getByLabel('Registry Title').fill('Valid Registry Title');
    await page.getByLabel('Description').fill('Valid description');
    
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    await page.getByLabel('Event Date').fill(futureDate.toISOString().split('T')[0]);
    
    await page.getByLabel('Email').fill('valid@example.com');
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Verify successful creation
    await expect(page.locator('.banner--success')).toContainText('Registry created successfully');
  });

  test('should handle network errors gracefully', async () => {
    // Mock network failure
    await page.route('**/api/registries', route => {
      route.abort('failed');
    });

    await page.goto('/admin/registries/new');
    await page.getByLabel('Registry Title').fill('Network Test Registry');
    await page.getByLabel('Description').fill('Testing network error handling');
    await page.getByRole('button', { name: 'Create Registry' }).click();

    // Verify error handling
    await expect(page.locator('.banner--critical')).toContainText('Failed to create registry. Please try again.');
    
    // Verify form data is preserved
    await expect(page.getByLabel('Registry Title')).toHaveValue('Network Test Registry');
    await expect(page.getByLabel('Description')).toHaveValue('Testing network error handling');
  });
});