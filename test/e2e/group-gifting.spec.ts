import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test.describe('Group Gifting E2E Journey', () => {
  test.beforeEach(async () => {
    // Reset database state
    await page.goto('/test/reset-db');
    
    // Mock payment processing
    await page.route('**/api/payments/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paymentIntentId: 'pi_test_123',
          status: 'completed'
        })
      });
    });

    // Mock email sending
    await page.route('**/api/emails/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Mock real-time updates (WebSocket)
    await page.addInitScript(() => {
      // Mock WebSocket for real-time updates
      class MockWebSocket extends EventTarget {
        readyState = 1; // OPEN
        send(data: string) {
          // Simulate server response for group gift updates
          setTimeout(() => {
            const message = {
              type: 'group_gift_update',
              data: {
                currentAmount: Math.random() * 100,
                contributorCount: Math.floor(Math.random() * 10) + 1
              }
            };
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify(message)
            }));
          }, 100);
        }
        close() {}
      }
      (window as any).WebSocket = MockWebSocket;
    });
  });

  test('should create group gift campaign successfully', async () => {
    // Step 1: Navigate to registry with items
    await page.goto('/registry/sarah-johns-wedding-registry');
    
    // Wait for registry to load
    await expect(page.locator('h1')).toContainText('Wedding Registry');
    await expect(page.locator('[data-testid="registry-item"]')).toHaveCount.greaterThan(0);

    // Step 2: Select an item for group gifting
    const firstItem = page.locator('[data-testid="registry-item"]:first-child');
    await expect(firstItem).toBeVisible();
    
    // Click on group gift option
    await firstItem.locator('[data-testid="group-gift-button"]').click();
    
    // Verify group gift modal opens
    await expect(page.locator('[data-testid="group-gift-modal"]')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('Start Group Gift');

    // Step 3: Configure group gift settings
    await page.getByLabel('Campaign Title').fill('Wedding Photo Album Group Gift');
    await page.getByLabel('Target Amount').fill('150');
    await page.getByLabel('Description').fill('Let\'s all chip in for this beautiful photo album for Sarah & John!');
    
    // Set organizer information
    await page.getByLabel('Your Name').fill('Jane Smith');
    await page.getByLabel('Your Email').fill('jane@example.com');
    
    // Configure settings
    await page.getByLabel('Minimum Contribution').fill('10');
    await page.getByLabel('Maximum Contributors').fill('15');
    
    // Set deadline (30 days from now)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    await page.getByLabel('Deadline').fill(deadline.toISOString().split('T')[0]);
    
    // Privacy settings
    await page.getByLabel('Allow anonymous contributions').check();
    await page.getByLabel('Show contributor list publicly').check();

    // Step 4: Create the group gift
    await page.getByRole('button', { name: 'Create Group Gift' }).click();

    // Verify successful creation
    await expect(page.locator('.banner--success')).toContainText('Group gift created successfully');
    
    // Verify redirect to group gift page
    await expect(page.url()).toMatch(/\/registry\/[^\/]+\/group-gift\/[^\/]+/);
    await expect(page.locator('h1')).toContainText('Wedding Photo Album Group Gift');
    
    // Verify initial state
    await expect(page.locator('[data-testid="current-amount"]')).toContainText('$0.00');
    await expect(page.locator('[data-testid="target-amount"]')).toContainText('$150.00');
    await expect(page.locator('[data-testid="contributor-count"]')).toContainText('0 contributors');
  });

  test('should allow contributions to group gift with real-time updates', async () => {
    // Setup: Create a group gift first
    await page.goto('/registry/test-registry/group-gift/test-group-gift-123');
    
    // Verify group gift page loads
    await expect(page.locator('h1')).toContainText('Group Gift');
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();

    // Step 1: Make first contribution
    await page.getByLabel('Your Name').fill('Alice Johnson');
    await page.getByLabel('Email Address').fill('alice@example.com');
    await page.getByLabel('Contribution Amount').fill('25');
    await page.getByLabel('Message (Optional)').fill('So excited for your wedding!');
    
    // Submit contribution
    await page.getByRole('button', { name: 'Contribute Now' }).click();

    // Mock payment flow
    await expect(page.locator('[data-testid="payment-modal"]')).toBeVisible();
    await page.getByLabel('Card Number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByLabel('Name on Card').fill('Alice Johnson');
    
    await page.getByRole('button', { name: 'Complete Payment' }).click();

    // Verify successful contribution
    await expect(page.locator('.banner--success')).toContainText('Thank you for your contribution!');

    // Step 2: Verify real-time updates
    await expect(page.locator('[data-testid="current-amount"]')).toContainText('$25.00');
    await expect(page.locator('[data-testid="contributor-count"]')).toContainText('1 contributor');
    
    // Check progress bar
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toHaveAttribute('aria-valuenow', '16.7'); // 25/150 * 100

    // Step 3: Verify contributor appears in list
    await expect(page.locator('[data-testid="contributor-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="contributor-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="contributor-item"]')).toContainText('Alice Johnson');
    await expect(page.locator('[data-testid="contributor-item"]')).toContainText('$25.00');
    await expect(page.locator('[data-testid="contributor-message"]')).toContainText('So excited for your wedding!');

    // Step 4: Make second contribution (anonymous)
    await page.getByLabel('Your Name').fill('Anonymous Friend');
    await page.getByLabel('Email Address').fill('anon@example.com');
    await page.getByLabel('Contribution Amount').fill('40');
    await page.getByLabel('Contribute anonymously').check();
    
    await page.getByRole('button', { name: 'Contribute Now' }).click();

    // Complete payment flow again
    await page.getByLabel('Card Number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByRole('button', { name: 'Complete Payment' }).click();

    // Step 5: Verify anonymous contribution
    await expect(page.locator('[data-testid="current-amount"]')).toContainText('$65.00');
    await expect(page.locator('[data-testid="contributor-count"]')).toContainText('2 contributors');
    
    // Check that anonymous contributor shows as "Anonymous"
    await expect(page.locator('[data-testid="contributor-item"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="contributor-item"]:last-child')).toContainText('Anonymous');
    await expect(page.locator('[data-testid="contributor-item"]:last-child')).toContainText('$40.00');
  });

  test('should handle group gift completion and automatic order creation', async () => {
    // Setup: Group gift that's close to target
    await page.goto('/registry/test-registry/group-gift/almost-complete-gift');
    
    // Verify current state (assume $140 of $150 target)
    await expect(page.locator('[data-testid="current-amount"]')).toContainText('$140.00');
    await expect(page.locator('[data-testid="remaining-amount"]')).toContainText('$10.00 remaining');

    // Make the final contribution
    await page.getByLabel('Your Name').fill('Final Contributor');
    await page.getByLabel('Email Address').fill('final@example.com');
    await page.getByLabel('Contribution Amount').fill('15'); // Slightly over target
    
    await page.getByRole('button', { name: 'Contribute Now' }).click();

    // Complete payment
    await page.getByLabel('Card Number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByRole('button', { name: 'Complete Payment' }).click();

    // Verify goal reached
    await expect(page.locator('.banner--success')).toContainText('Goal reached! Order will be placed automatically.');
    await expect(page.locator('[data-testid="current-amount"]')).toContainText('$150.00'); // Capped at target
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '100');

    // Verify completion banner
    await expect(page.locator('[data-testid="completion-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="completion-banner"]')).toContainText('🎉 Goal reached! Order will be placed automatically.');

    // Verify order creation notification
    await expect(page.locator('[data-testid="order-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-notification"]')).toContainText('Order #1001 has been created');

    // Check that contribution form is disabled
    await expect(page.getByRole('button', { name: 'Contribute Now' })).toBeDisabled();
    await expect(page.locator('[data-testid="contribution-form"]')).toHaveClass(/disabled/);
  });

  test('should handle group gift expiration and refunds', async () => {
    // Setup: Expired group gift
    await page.goto('/registry/test-registry/group-gift/expired-gift');
    
    // Verify expired state
    await expect(page.locator('[data-testid="expiration-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="expiration-banner"]')).toContainText('This group gift has expired');
    
    // Verify current amount is less than target
    await expect(page.locator('[data-testid="current-amount"]')).toContainText('$75.00');
    await expect(page.locator('[data-testid="target-amount"]')).toContainText('$150.00');

    // Verify contribution form is disabled
    await expect(page.getByRole('button', { name: 'Contribute Now' })).toBeDisabled();
    
    // Check refund notification
    await expect(page.locator('[data-testid="refund-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="refund-notification"]')).toContainText('Refunds will be processed automatically');

    // Verify contributors are notified about refunds
    await expect(page.locator('[data-testid="contributor-refund-status"]')).toHaveCount.greaterThan(0);
    
    const firstContributor = page.locator('[data-testid="contributor-item"]:first-child');
    await expect(firstContributor.locator('[data-testid="refund-status"]')).toContainText('Refund processed');
  });

  test('should enforce contribution limits and validations', async () => {
    await page.goto('/registry/test-registry/group-gift/test-gift-validation');
    
    // Test minimum contribution validation
    await page.getByLabel('Your Name').fill('Test User');
    await page.getByLabel('Email Address').fill('test@example.com');
    await page.getByLabel('Contribution Amount').fill('2'); // Below minimum of $5
    
    await page.getByRole('button', { name: 'Contribute Now' }).click();
    await expect(page.locator('[data-testid="amount-error"]')).toContainText('Minimum contribution is $5.00');

    // Test maximum contribution (don't exceed target)
    await page.getByLabel('Contribution Amount').fill('200'); // Exceeds remaining amount
    await page.getByRole('button', { name: 'Contribute Now' }).click();
    await expect(page.locator('[data-testid="amount-error"]')).toContainText('Contribution would exceed target amount');

    // Test email validation
    await page.getByLabel('Email Address').fill('invalid-email');
    await page.getByLabel('Contribution Amount').fill('25');
    await page.getByRole('button', { name: 'Contribute Now' }).click();
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Please enter a valid email address');

    // Test required fields
    await page.getByLabel('Your Name').fill('');
    await page.getByLabel('Email Address').fill('valid@example.com');
    await page.getByRole('button', { name: 'Contribute Now' }).click();
    await expect(page.locator('[data-testid="name-error"]')).toContainText('Name is required');

    // Test valid contribution
    await page.getByLabel('Your Name').fill('Valid User');
    await page.getByLabel('Email Address').fill('valid@example.com');
    await page.getByLabel('Contribution Amount').fill('25');
    await page.getByRole('button', { name: 'Contribute Now' }).click();

    // Should proceed to payment
    await expect(page.locator('[data-testid="payment-modal"]')).toBeVisible();
  });

  test('should handle payment failures gracefully', async () => {
    // Mock payment failure
    await page.route('**/api/payments/**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Your card was declined.'
        })
      });
    });

    await page.goto('/registry/test-registry/group-gift/test-payment-failure');
    
    // Fill out contribution form
    await page.getByLabel('Your Name').fill('Payment Test');
    await page.getByLabel('Email Address').fill('payment@example.com');
    await page.getByLabel('Contribution Amount').fill('30');
    await page.getByRole('button', { name: 'Contribute Now' }).click();

    // Fill payment details
    await page.getByLabel('Card Number').fill('4000000000000002'); // Declined card
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByRole('button', { name: 'Complete Payment' }).click();

    // Verify payment failure handling
    await expect(page.locator('.banner--critical')).toContainText('Your card was declined.');
    
    // Verify user can retry
    await expect(page.locator('[data-testid="payment-modal"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
    
    // Verify contribution form is still available
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="contribution-form"]')).toBeVisible();
    await expect(page.getByLabel('Your Name')).toHaveValue('Payment Test');
  });

  test('should share group gift with social media and email', async () => {
    await page.goto('/registry/test-registry/group-gift/shareable-gift');
    
    // Verify sharing section is visible
    await expect(page.locator('[data-testid="sharing-section"]')).toBeVisible();
    
    // Test social media sharing buttons
    const facebookShare = page.getByRole('link', { name: /Share on Facebook/ });
    await expect(facebookShare).toBeVisible();
    await expect(facebookShare).toHaveAttribute('href', expect.stringContaining('facebook.com'));

    const twitterShare = page.getByRole('link', { name: /Share on Twitter/ });
    await expect(twitterShare).toBeVisible();
    await expect(twitterShare).toHaveAttribute('href', expect.stringContaining('twitter.com'));

    // Test email sharing
    await page.getByRole('button', { name: 'Share via Email' }).click();
    await expect(page.locator('[data-testid="email-share-modal"]')).toBeVisible();
    
    await page.getByLabel('Recipient Emails').fill('friend1@example.com, friend2@example.com');
    await page.getByLabel('Personal Message').fill('Help us reach our goal for this amazing gift!');
    await page.getByRole('button', { name: 'Send Invitations' }).click();

    await expect(page.locator('.banner--success')).toContainText('Invitations sent successfully');

    // Test copy link functionality
    await page.getByRole('button', { name: 'Copy Link' }).click();
    await expect(page.locator('.banner--success')).toContainText('Link copied to clipboard');
  });

  test('should display real-time activity feed', async () => {
    await page.goto('/registry/test-registry/group-gift/active-gift');
    
    // Verify activity feed is visible
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible();
    await expect(page.locator('[data-testid="activity-feed"] h3')).toContainText('Recent Activity');

    // Make a contribution to generate activity
    await page.getByLabel('Your Name').fill('Activity Tester');
    await page.getByLabel('Email Address').fill('activity@example.com');
    await page.getByLabel('Contribution Amount').fill('20');
    await page.getByRole('button', { name: 'Contribute Now' }).click();

    // Complete payment
    await page.getByLabel('Card Number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByRole('button', { name: 'Complete Payment' }).click();

    // Verify new activity appears in feed
    await expect(page.locator('[data-testid="activity-item"]:first-child')).toContainText('Activity Tester contributed $20.00');
    await expect(page.locator('[data-testid="activity-timestamp"]:first-child')).toContainText('just now');

    // Verify live indicator
    await expect(page.locator('[data-testid="live-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="live-indicator"]')).toContainText('Live');
  });

  test('should work responsively on mobile devices', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/registry/test-registry/group-gift/mobile-test');
    
    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-progress-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-contribution-form"]')).toBeVisible();

    // Test mobile contribution flow
    await page.getByLabel('Your Name').fill('Mobile User');
    await page.getByLabel('Email Address').fill('mobile@example.com');
    await page.getByLabel('Contribution Amount').fill('35');
    
    // Test mobile-specific interactions
    await page.locator('[data-testid="amount-preset-button"]', { hasText: '$25' }).click();
    await expect(page.getByLabel('Contribution Amount')).toHaveValue('25');

    await page.getByRole('button', { name: 'Contribute Now' }).click();

    // Verify mobile payment modal
    await expect(page.locator('[data-testid="mobile-payment-modal"]')).toBeVisible();
    
    // Test mobile keyboard behavior
    await page.getByLabel('Card Number').focus();
    await expect(page.locator('input[inputmode="numeric"]')).toBeFocused();

    // Complete mobile payment flow
    await page.getByLabel('Card Number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByRole('button', { name: 'Complete Payment' }).click();

    // Verify mobile success state
    await expect(page.locator('[data-testid="mobile-success-animation"]')).toBeVisible();
    await expect(page.locator('.banner--success')).toContainText('Thank you for your contribution!');

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});