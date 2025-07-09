import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test.describe('Multi-Address Checkout E2E', () => {
  test.beforeEach(async () => {
    // Reset database state
    await page.goto('/test/reset-db');
    
    // Mock Shopify Checkout API
    await page.route('**/api/checkout/**', async route => {
      const url = route.request().url();
      
      if (url.includes('shipping-rates')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            shippingRates: [
              {
                id: 'standard',
                title: 'Standard Shipping',
                price: 9.99,
                deliveryDays: 5,
                estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
              },
              {
                id: 'express',
                title: 'Express Shipping',
                price: 19.99,
                deliveryDays: 2,
                estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
              }
            ]
          })
        });
      } else if (url.includes('create-orders')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orders: [
              {
                id: 'order_123',
                name: '#1001',
                totalPrice: { amount: '159.98', currencyCode: 'USD' }
              },
              {
                id: 'order_456',
                name: '#1002',
                totalPrice: { amount: '89.99', currencyCode: 'USD' }
              }
            ],
            trackingInfo: [
              {
                orderId: 'order_123',
                orderNumber: '#1001',
                estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
              },
              {
                orderId: 'order_456',
                orderNumber: '#1002',
                estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
              }
            ]
          })
        });
      }
    });

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

    // Mock email notifications
    await page.route('**/api/emails/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
  });

  test('should complete multi-address checkout with different shipping preferences', async () => {
    // Step 1: Navigate to registry and add items to cart
    await page.goto('/registry/wedding-registry-demo');
    
    // Add multiple items with different shipping preferences
    await page.locator('[data-testid="add-to-cart"]:first-child').click();
    await page.locator('[data-testid="add-to-cart"]:nth-child(2)').click();
    await page.locator('[data-testid="add-to-cart"]:nth-child(3)').click();

    // Verify cart items
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('3');

    // Step 2: Proceed to checkout
    await page.getByRole('button', { name: 'Checkout' }).click();
    
    // Verify checkout page loads
    await expect(page.locator('h1')).toContainText('Checkout');
    await expect(page.locator('[data-testid="checkout-step"]')).toContainText('1');

    // Step 3: Configure buyer address
    await page.getByLabel('First Name').fill('Jane');
    await page.getByLabel('Last Name').fill('Smith');
    await page.getByLabel('Address').fill('456 Buyer Street');
    await page.getByLabel('City').fill('Buyer City');
    await page.getByLabel('State/Province').fill('NY');
    await page.getByLabel('ZIP/Postal Code').fill('10001');

    // Step 4: Configure shipping preferences for each item
    // Item 1: Ship to registry owner (recipient)
    const item1 = page.locator('[data-testid="item-shipping-config"]:first-child');
    await item1.getByRole('radio', { name: 'Registry owner' }).check();
    await item1.getByLabel('Gift Message').fill('Congratulations on your wedding!');
    await item1.getByLabel('Gift wrap this item').check();

    // Item 2: Ship to gift giver
    const item2 = page.locator('[data-testid="item-shipping-config"]:nth-child(2)');
    await item2.getByRole('radio', { name: 'Me (gift giver)' }).check();
    await item2.getByLabel('Gift Message').fill('I want to give this personally');

    // Item 3: Ship to custom address
    const item3 = page.locator('[data-testid="item-shipping-config"]:nth-child(3)');
    await item3.getByRole('radio', { name: 'Custom address' }).check();
    
    // Fill custom address details
    await item3.getByLabel('Recipient First Name').fill('Bob');
    await item3.getByLabel('Recipient Last Name').fill('Wilson');
    await item3.getByLabel('Recipient Address').fill('789 Custom Lane');
    await item3.getByLabel('Recipient City').fill('Custom City');
    await item3.getByLabel('Recipient State').fill('CA');
    await item3.getByLabel('Recipient ZIP').fill('90210');
    await item3.getByLabel('Gift Message').fill('From the wedding guests!');

    // Step 5: Calculate shipping
    await page.getByRole('button', { name: 'Calculate Shipping' }).click();
    
    // Verify shipping groups are created
    await expect(page.locator('[data-testid="checkout-step"]')).toContainText('2');
    await expect(page.locator('h2')).toContainText('Review Shipping Groups');
    
    // Verify correct number of shipping groups
    await expect(page.locator('[data-testid="shipping-group"]')).toHaveCount(3);

    // Step 6: Review and configure shipping groups
    const group1 = page.locator('[data-testid="shipping-group"]:first-child');
    await expect(group1.locator('[data-testid="shipping-address"]')).toContainText('Registry owner');
    await expect(group1.locator('[data-testid="group-items"]')).toContainText('1 item');
    
    // Select shipping method for group 1
    await group1.getByRole('radio', { name: /Standard Shipping.*\$9\.99/ }).check();

    const group2 = page.locator('[data-testid="shipping-group"]:nth-child(2)');
    await expect(group2.locator('[data-testid="shipping-address"]')).toContainText('Jane Smith');
    await expect(group2.locator('[data-testid="shipping-address"]')).toContainText('456 Buyer Street');
    
    // Select shipping method for group 2
    await group2.getByRole('radio', { name: /Express Shipping.*\$19\.99/ }).check();

    const group3 = page.locator('[data-testid="shipping-group"]:nth-child(3)');
    await expect(group3.locator('[data-testid="shipping-address"]')).toContainText('Bob Wilson');
    await expect(group3.locator('[data-testid="shipping-address"]')).toContainText('789 Custom Lane');
    
    // Select shipping method for group 3
    await group3.getByRole('radio', { name: /Standard Shipping.*\$9\.99/ }).check();

    // Step 7: Configure delivery coordination
    await page.getByLabel('Synchronize all deliveries to arrive on the same day').check();
    await page.getByLabel('Special Delivery Instructions').fill('Please coordinate all deliveries for the wedding weekend');

    // Verify total calculations
    await expect(page.locator('[data-testid="shipping-total"]')).toContainText('$38.97'); // 9.99 + 19.99 + 9.99
    await expect(page.locator('[data-testid="order-total"]')).toContainText('$288.95'); // Items + shipping

    // Step 8: Proceed to payment
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    
    await expect(page.locator('[data-testid="checkout-step"]')).toContainText('3');
    await expect(page.locator('h2')).toContainText('Payment');

    // Verify order summary
    await expect(page.locator('[data-testid="order-summary"]')).toContainText('3 shipments');
    await expect(page.locator('[data-testid="final-total"]')).toContainText('$288.95');

    // Step 9: Complete payment
    await page.getByLabel('Card Number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByLabel('Name on Card').fill('Jane Smith');
    await page.getByLabel('Billing ZIP').fill('10001');

    await page.getByRole('button', { name: 'Complete Purchase' }).click();

    // Step 10: Verify successful completion
    await expect(page.locator('.banner--success')).toContainText('Orders placed successfully!');
    await expect(page.locator('h1')).toContainText('Order Confirmation');
    
    // Verify multiple orders created
    await expect(page.locator('[data-testid="order-summary"]')).toContainText('3 orders created');
    await expect(page.locator('[data-testid="order-number"]')).toHaveCount(3);
    
    // Verify each order has tracking information
    await expect(page.locator('[data-testid="tracking-info"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="estimated-delivery"]')).toHaveCount(3);
  });

  test('should handle shipping method selection and cost calculation', async () => {
    // Setup checkout with items
    await page.goto('/registry/test-registry/checkout?items=item1,item2');
    
    // Fill buyer information
    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('Buyer');
    await page.getByLabel('Address').fill('123 Test St');
    await page.getByLabel('City').fill('Test City');
    await page.getByLabel('State/Province').fill('TX');
    await page.getByLabel('ZIP/Postal Code').fill('75001');

    // Configure shipping - both items to recipient
    await page.locator('[data-testid="item-shipping-config"]').first().getByRole('radio', { name: 'Registry owner' }).check();
    await page.locator('[data-testid="item-shipping-config"]').last().getByRole('radio', { name: 'Registry owner' }).check();

    await page.getByRole('button', { name: 'Calculate Shipping' }).click();

    // Should create single shipping group
    await expect(page.locator('[data-testid="shipping-group"]')).toHaveCount(1);
    
    const shippingGroup = page.locator('[data-testid="shipping-group"]');
    
    // Test shipping method selection
    await expect(shippingGroup.getByRole('radio', { name: /Standard Shipping/ })).toBeVisible();
    await expect(shippingGroup.getByRole('radio', { name: /Express Shipping/ })).toBeVisible();

    // Select standard shipping
    await shippingGroup.getByRole('radio', { name: /Standard Shipping.*\$9\.99/ }).check();
    await expect(page.locator('[data-testid="shipping-total"]')).toContainText('$9.99');
    
    // Switch to express shipping
    await shippingGroup.getByRole('radio', { name: /Express Shipping.*\$19\.99/ }).check();
    await expect(page.locator('[data-testid="shipping-total"]')).toContainText('$19.99');

    // Verify delivery estimates
    await expect(shippingGroup.locator('[data-testid="delivery-estimate"]')).toContainText('2 business days');
  });

  test('should coordinate synchronized delivery across multiple shipments', async () => {
    await page.goto('/registry/test-registry/checkout?items=item1,item2,item3');
    
    // Setup different shipping addresses
    await page.getByLabel('First Name').fill('Coordinator');
    await page.getByLabel('Last Name').fill('Test');
    await page.getByLabel('Address').fill('123 Coord St');
    await page.getByLabel('City').fill('Coord City');
    await page.getByLabel('State/Province').fill('FL');
    await page.getByLabel('ZIP/Postal Code').fill('33101');

    // Configure mixed shipping preferences
    await page.locator('[data-testid="item-shipping-config"]:first-child')
      .getByRole('radio', { name: 'Registry owner' }).check();
    await page.locator('[data-testid="item-shipping-config"]:nth-child(2)')
      .getByRole('radio', { name: 'Me (gift giver)' }).check();
    await page.locator('[data-testid="item-shipping-config"]:nth-child(3)')
      .getByRole('radio', { name: 'Me (gift giver)' }).check();

    await page.getByRole('button', { name: 'Calculate Shipping' }).click();

    // Should create 2 shipping groups
    await expect(page.locator('[data-testid="shipping-group"]')).toHaveCount(2);

    // Configure different shipping speeds
    await page.locator('[data-testid="shipping-group"]:first-child')
      .getByRole('radio', { name: /Standard Shipping/ }).check(); // 5 days
    await page.locator('[data-testid="shipping-group"]:nth-child(2)')
      .getByRole('radio', { name: /Express Shipping/ }).check(); // 2 days

    // Enable delivery coordination
    await page.getByLabel('Synchronize all deliveries to arrive on the same day').check();
    
    // Verify coordination message appears
    await expect(page.locator('[data-testid="coordination-notice"]')).toContainText('All deliveries will be coordinated to arrive on the same day');
    
    // Verify latest delivery date is shown
    await expect(page.locator('[data-testid="coordinated-delivery-date"]')).toContainText('5 business days');

    await page.getByLabel('Special Delivery Instructions').fill('Please hold express shipment to coordinate with standard shipment');

    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    
    // Verify coordination is reflected in order summary
    await expect(page.locator('[data-testid="delivery-coordination"]')).toContainText('Synchronized delivery requested');
  });

  test('should handle custom shipping addresses with validation', async () => {
    await page.goto('/registry/test-registry/checkout?items=item1');
    
    // Fill buyer information
    await page.getByLabel('First Name').fill('Custom');
    await page.getByLabel('Last Name').fill('Tester');
    await page.getByLabel('Address').fill('456 Custom Ave');
    await page.getByLabel('City').fill('Custom Town');
    await page.getByLabel('State/Province').fill('WA');
    await page.getByLabel('ZIP/Postal Code').fill('98101');

    // Select custom address for item
    await page.getByRole('radio', { name: 'Custom address' }).check();

    // Test validation - try to proceed without custom address
    await page.getByRole('button', { name: 'Calculate Shipping' }).click();
    
    await expect(page.locator('[data-testid="custom-address-error"]')).toContainText('Custom shipping address is required');

    // Fill custom address
    await page.getByLabel('Recipient First Name').fill('Custom');
    await page.getByLabel('Recipient Last Name').fill('Recipient');
    await page.getByLabel('Recipient Address').fill('789 Recipient Rd');
    await page.getByLabel('Recipient City').fill('Recipient City');
    await page.getByLabel('Recipient State').fill('OR');
    
    // Test ZIP validation
    await page.getByLabel('Recipient ZIP').fill('invalid');
    await page.getByRole('button', { name: 'Calculate Shipping' }).click();
    await expect(page.locator('[data-testid="zip-error"]')).toContainText('Please enter a valid ZIP code');

    // Fix ZIP and proceed
    await page.getByLabel('Recipient ZIP').fill('97201');
    await page.getByRole('button', { name: 'Calculate Shipping' }).click();

    // Verify custom address is used
    await expect(page.locator('[data-testid="shipping-address"]')).toContainText('Custom Recipient');
    await expect(page.locator('[data-testid="shipping-address"]')).toContainText('789 Recipient Rd');
    await expect(page.locator('[data-testid="shipping-address"]')).toContainText('Recipient City, OR 97201');
  });

  test('should handle gift wrapping and messages for multiple items', async () => {
    await page.goto('/registry/test-registry/checkout?items=item1,item2,item3');
    
    // Setup addresses
    await page.getByLabel('First Name').fill('Gift');
    await page.getByLabel('Last Name').fill('Wrapper');
    await page.getByLabel('Address').fill('123 Gift St');
    await page.getByLabel('City').fill('Gift City');
    await page.getByLabel('State/Province').fill('CO');
    await page.getByLabel('ZIP/Postal Code').fill('80201');

    // Configure different gift options for each item
    const item1 = page.locator('[data-testid="item-shipping-config"]:first-child');
    await item1.getByRole('radio', { name: 'Registry owner' }).check();
    await item1.getByLabel('Gift wrap this item').check();
    await item1.getByLabel('Gift Message').fill('Happy Wedding Day from the Johnsons!');

    const item2 = page.locator('[data-testid="item-shipping-config"]:nth-child(2)');
    await item2.getByRole('radio', { name: 'Registry owner' }).check();
    await item2.getByLabel('Gift Message').fill('Wishing you a lifetime of happiness!');
    // No gift wrap for item 2

    const item3 = page.locator('[data-testid="item-shipping-config"]:nth-child(3)');
    await item3.getByRole('radio', { name: 'Me (gift giver)' }).check();
    await item3.getByLabel('Gift wrap this item').check();
    await item3.getByLabel('Gift Message').fill('Can\'t wait to celebrate with you!');

    await page.getByRole('button', { name: 'Calculate Shipping' }).click();

    // Verify gift options in shipping groups
    const recipientGroup = page.locator('[data-testid="shipping-group"]').filter({ hasText: 'Registry owner' });
    await expect(recipientGroup.locator('[data-testid="gift-options"]')).toContainText('1 item with gift wrap');
    await expect(recipientGroup.locator('[data-testid="gift-options"]')).toContainText('2 items with messages');

    const giverGroup = page.locator('[data-testid="shipping-group"]').filter({ hasText: 'Gift Wrapper' });
    await expect(giverGroup.locator('[data-testid="gift-options"]')).toContainText('1 item with gift wrap');
    await expect(giverGroup.locator('[data-testid="gift-options"]')).toContainText('1 item with message');

    // Verify gift wrap charges in totals
    await expect(page.locator('[data-testid="gift-wrap-total"]')).toContainText('$9.98'); // 2 items × $4.99
    await expect(page.locator('[data-testid="subtotal"]')).toContainText('Gift wrap: $9.98');
  });

  test('should handle payment failures and retry mechanisms', async () => {
    // Mock payment failure
    await page.route('**/api/payments/**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Your card was declined. Please try a different payment method.'
        })
      });
    });

    // Setup basic checkout
    await page.goto('/registry/test-registry/checkout?items=item1');
    
    await page.getByLabel('First Name').fill('Payment');
    await page.getByLabel('Last Name').fill('Test');
    await page.getByLabel('Address').fill('123 Payment St');
    await page.getByLabel('City').fill('Payment City');
    await page.getByLabel('State/Province').fill('NV');
    await page.getByLabel('ZIP/Postal Code').fill('89101');

    await page.getByRole('radio', { name: 'Registry owner' }).check();
    await page.getByRole('button', { name: 'Calculate Shipping' }).click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();

    // Attempt payment
    await page.getByLabel('Card Number').fill('4000000000000002'); // Declined test card
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByLabel('Name on Card').fill('Payment Test');
    await page.getByRole('button', { name: 'Complete Purchase' }).click();

    // Verify error handling
    await expect(page.locator('.banner--critical')).toContainText('Your card was declined');
    
    // Verify form is still available for retry
    await expect(page.getByLabel('Card Number')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete Purchase' })).toBeVisible();

    // Fix payment method and retry
    await page.route('**/api/payments/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paymentIntentId: 'pi_retry_success',
          status: 'completed'
        })
      });
    });

    await page.getByLabel('Card Number').fill('4242424242424242'); // Valid test card
    await page.getByRole('button', { name: 'Complete Purchase' }).click();

    // Verify successful payment
    await expect(page.locator('.banner--success')).toContainText('Orders placed successfully!');
  });

  test('should provide order tracking and delivery notifications', async () => {
    // Complete a checkout first
    await page.goto('/registry/test-registry/checkout?items=item1,item2');
    
    // Quick setup
    await page.getByLabel('First Name').fill('Tracking');
    await page.getByLabel('Last Name').fill('Test');
    await page.getByLabel('Address').fill('123 Track St');
    await page.getByLabel('City').fill('Track City');
    await page.getByLabel('State/Province').fill('MT');
    await page.getByLabel('ZIP/Postal Code').fill('59101');

    await page.getByRole('radio', { name: 'Registry owner' }).first().check();
    await page.getByRole('radio', { name: 'Me (gift giver)' }).last().check();
    
    await page.getByRole('button', { name: 'Calculate Shipping' }).click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    
    await page.getByLabel('Card Number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');
    await page.getByLabel('Name on Card').fill('Tracking Test');
    await page.getByRole('button', { name: 'Complete Purchase' }).click();

    // Verify order confirmation page
    await expect(page.locator('h1')).toContainText('Order Confirmation');
    
    // Verify tracking information
    await expect(page.locator('[data-testid="order-tracking"]')).toHaveCount(2);
    
    const firstOrder = page.locator('[data-testid="order-tracking"]').first();
    await expect(firstOrder.locator('[data-testid="order-number"]')).toContainText('#1001');
    await expect(firstOrder.locator('[data-testid="shipping-to"]')).toContainText('Registry owner');
    await expect(firstOrder.locator('[data-testid="estimated-delivery"]')).toBeVisible();

    // Test email notification checkboxes
    await expect(page.locator('[data-testid="notification-preferences"]')).toBeVisible();
    await page.getByLabel('Send tracking updates to registry owner').check();
    await page.getByLabel('Send delivery notifications to recipients').check();

    // Save notification preferences
    await page.getByRole('button', { name: 'Save Notification Preferences' }).click();
    await expect(page.locator('.banner--success')).toContainText('Notification preferences saved');

    // Test order tracking links
    await page.getByRole('link', { name: 'Track Order #1001' }).click();
    await expect(page.url()).toMatch(/\/orders\/[^\/]+\/track/);
    await expect(page.locator('h1')).toContainText('Track Your Order');
  });

  test('should handle mobile responsive checkout flow', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/registry/test-registry/checkout?items=item1,item2');
    
    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-checkout-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-step-indicator"]')).toBeVisible();

    // Test mobile form interaction
    await page.getByLabel('First Name').fill('Mobile');
    await page.getByLabel('Last Name').fill('User');
    
    // Test mobile address autocomplete
    await page.getByLabel('Address').fill('123');
    await expect(page.locator('[data-testid="address-suggestions"]')).toBeVisible();
    
    await page.getByLabel('Address').fill('123 Mobile St');
    await page.getByLabel('City').fill('Mobile City');
    await page.getByLabel('State/Province').fill('AL');
    await page.getByLabel('ZIP/Postal Code').fill('36101');

    // Test mobile shipping configuration
    await page.locator('[data-testid="mobile-shipping-toggle"]').first().click();
    await expect(page.locator('[data-testid="mobile-shipping-options"]').first()).toBeVisible();
    
    await page.getByRole('radio', { name: 'Registry owner' }).first().check();
    await page.getByRole('button', { name: 'Calculate Shipping' }).click();

    // Verify mobile shipping review
    await expect(page.locator('[data-testid="mobile-shipping-summary"]')).toBeVisible();
    
    // Test mobile payment
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    
    // Verify mobile payment form
    await expect(page.locator('[data-testid="mobile-payment-form"]')).toBeVisible();
    
    // Test mobile card input with proper input modes
    const cardInput = page.getByLabel('Card Number');
    await expect(cardInput).toHaveAttribute('inputmode', 'numeric');
    
    await cardInput.fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');

    // Complete mobile checkout
    await page.getByRole('button', { name: 'Complete Purchase' }).click();
    
    // Verify mobile success page
    await expect(page.locator('[data-testid="mobile-success-animation"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-order-summary"]')).toBeVisible();

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});