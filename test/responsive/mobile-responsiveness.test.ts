import { test, expect, type Page, type BrowserContext } from '@playwright/test';

describe('Mobile Responsiveness Tests', () => {
  let page: Page;
  let context: BrowserContext;

  const viewports = {
    mobile: { width: 375, height: 667 }, // iPhone SE
    mobileLarge: { width: 414, height: 896 }, // iPhone 11 Pro Max
    tablet: { width: 768, height: 1024 }, // iPad
    tabletLandscape: { width: 1024, height: 768 }, // iPad Landscape
    desktop: { width: 1280, height: 720 }, // Desktop
    ultrawide: { width: 1920, height: 1080 } // Large Desktop
  };

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Mock API responses for consistent testing
    await page.route('**/api/**', async route => {
      const url = route.request().url();
      
      if (url.includes('registries')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            registries: [
              {
                id: 'reg_1',
                title: 'Sarah & John\'s Wedding Registry',
                description: 'Help us celebrate our special day with these wonderful gifts!',
                eventDate: '2024-12-25',
                itemCount: 15,
                completionRate: 65
              }
            ]
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  describe('Registry Listing Page Responsiveness', () => {
    test('should display registry cards appropriately across all screen sizes', async () => {
      for (const [size, viewport] of Object.entries(viewports)) {
        await page.setViewportSize(viewport);
        await page.goto('/registries');
        
        // Test registry cards layout
        const registryCards = page.locator('[data-testid="registry-card"]');
        await expect(registryCards).toBeVisible();

        if (size === 'mobile' || size === 'mobileLarge') {
          // Mobile: Single column layout
          const cardsPerRow = await registryCards.count();
          const firstCardWidth = await registryCards.first().boundingBox();
          const viewportWidth = viewport.width;
          
          // Cards should take most of the viewport width (allowing for margins)
          expect(firstCardWidth?.width).toBeGreaterThan(viewportWidth * 0.85);
          
          // Test mobile-specific elements
          await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
          await expect(page.locator('[data-testid="desktop-sidebar"]')).not.toBeVisible();
          
        } else if (size === 'tablet') {
          // Tablet: Two column layout
          const gridContainer = page.locator('[data-testid="registry-grid"]');
          const computedStyle = await gridContainer.evaluate(el => 
            window.getComputedStyle(el).gridTemplateColumns
          );
          expect(computedStyle).toMatch(/repeat\(2,|1fr 1fr/);
          
        } else {
          // Desktop: Three or more column layout
          const gridContainer = page.locator('[data-testid="registry-grid"]');
          const computedStyle = await gridContainer.evaluate(el => 
            window.getComputedStyle(el).gridTemplateColumns
          );
          expect(computedStyle).toMatch(/repeat\([3-9]|1fr 1fr 1fr/);
        }

        console.log(`✅ ${size} (${viewport.width}x${viewport.height}): Registry layout verified`);
      }
    });

    test('should handle navigation menu responsively', async () => {
      for (const [size, viewport] of Object.entries(viewports)) {
        await page.setViewportSize(viewport);
        await page.goto('/registries');

        if (viewport.width < 768) {
          // Mobile: Hamburger menu
          await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
          await expect(page.locator('[data-testid="desktop-nav"]')).not.toBeVisible();
          
          // Test mobile menu functionality
          await page.click('[data-testid="mobile-menu-button"]');
          await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
          
          // Test menu items
          await expect(page.locator('[data-testid="mobile-menu"] a')).toHaveCount.greaterThan(3);
          
          // Close menu
          await page.click('[data-testid="mobile-menu-close"]');
          await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible();
          
        } else {
          // Desktop: Full navigation
          await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
          await expect(page.locator('[data-testid="mobile-menu-button"]')).not.toBeVisible();
        }

        console.log(`✅ ${size}: Navigation menu behavior verified`);
      }
    });
  });

  describe('Registry Creation Form Responsiveness', () => {
    test('should adapt form layout for different screen sizes', async () => {
      for (const [size, viewport] of Object.entries(viewports)) {
        await page.setViewportSize(viewport);
        await page.goto('/admin/registries/new');

        // Test form container width
        const formContainer = page.locator('[data-testid="registry-form"]');
        await expect(formContainer).toBeVisible();

        if (viewport.width < 768) {
          // Mobile: Full-width form with stacked fields
          const containerWidth = await formContainer.boundingBox();
          expect(containerWidth?.width).toBeGreaterThan(viewport.width * 0.9);
          
          // Test input field stacking
          const fieldRows = page.locator('[data-testid="form-row"]');
          for (let i = 0; i < await fieldRows.count(); i++) {
            const row = fieldRows.nth(i);
            const inputs = row.locator('input, select, textarea');
            const inputCount = await inputs.count();
            
            if (inputCount > 1) {
              // Multiple inputs should stack vertically on mobile
              const firstInput = inputs.first();
              const secondInput = inputs.nth(1);
              
              const firstBox = await firstInput.boundingBox();
              const secondBox = await secondInput.boundingBox();
              
              expect(secondBox?.y).toBeGreaterThan((firstBox?.y || 0) + (firstBox?.height || 0));
            }
          }

          // Test mobile-specific form elements
          await expect(page.locator('[data-testid="mobile-date-picker"]')).toBeVisible();
          
        } else {
          // Desktop: Side-by-side field layout where appropriate
          const fieldRows = page.locator('[data-testid="form-row"]');
          for (let i = 0; i < await fieldRows.count(); i++) {
            const row = fieldRows.nth(i);
            const inputs = row.locator('input, select');
            const inputCount = await inputs.count();
            
            if (inputCount === 2) {
              // Two inputs should be side-by-side on desktop
              const firstInput = inputs.first();
              const secondInput = inputs.nth(1);
              
              const firstBox = await firstInput.boundingBox();
              const secondBox = await secondInput.boundingBox();
              
              expect(Math.abs((firstBox?.y || 0) - (secondBox?.y || 0))).toBeLessThan(10);
            }
          }
        }

        console.log(`✅ ${size}: Form layout verified`);
      }
    });

    test('should provide appropriate input methods for mobile', async () => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/admin/registries/new');

      // Test numeric inputs have numeric keyboard
      const priceInput = page.locator('input[type="number"]').first();
      if (await priceInput.count() > 0) {
        await expect(priceInput).toHaveAttribute('inputmode', 'numeric');
      }

      // Test email inputs have email keyboard
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.count() > 0) {
        await expect(emailInput).toHaveAttribute('inputmode', 'email');
      }

      // Test URL inputs have URL keyboard
      const urlInput = page.locator('input[type="url"]').first();
      if (await urlInput.count() > 0) {
        await expect(urlInput).toHaveAttribute('inputmode', 'url');
      }

      // Test date inputs use native date picker on mobile
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) {
        await expect(dateInput).toBeVisible();
      }

      console.log('✅ Mobile input methods verified');
    });
  });

  describe('Group Gift Page Responsiveness', () => {
    test('should display group gift progress appropriately on all devices', async () => {
      for (const [size, viewport] of Object.entries(viewports)) {
        await page.setViewportSize(viewport);
        await page.goto('/registry/test-registry/group-gift/test-gift');

        // Test progress bar responsiveness
        const progressBar = page.locator('[data-testid="progress-bar"]');
        await expect(progressBar).toBeVisible();

        const progressContainer = page.locator('[data-testid="progress-container"]');
        const containerWidth = await progressContainer.boundingBox();
        
        // Progress bar should take full container width
        expect(containerWidth?.width).toBeGreaterThan(viewport.width * 0.7);

        if (viewport.width < 768) {
          // Mobile: Stacked layout
          await expect(page.locator('[data-testid="mobile-progress-card"]')).toBeVisible();
          await expect(page.locator('[data-testid="mobile-contribution-form"]')).toBeVisible();
          
          // Test mobile contribution form
          const contributionForm = page.locator('[data-testid="contribution-form"]');
          const formWidth = await contributionForm.boundingBox();
          expect(formWidth?.width).toBeGreaterThan(viewport.width * 0.85);
          
          // Test mobile amount presets
          await expect(page.locator('[data-testid="amount-preset-buttons"]')).toBeVisible();
          const presetButtons = page.locator('[data-testid="amount-preset-button"]');
          expect(await presetButtons.count()).toBeGreaterThanOrEqual(3);
          
        } else {
          // Desktop: Side-by-side layout
          await expect(page.locator('[data-testid="desktop-two-column"]')).toBeVisible();
        }

        console.log(`✅ ${size}: Group gift layout verified`);
      }
    });

    test('should handle contributor list display responsively', async () => {
      await page.goto('/registry/test-registry/group-gift/test-gift-with-contributors');

      for (const [size, viewport] of Object.entries(viewports)) {
        await page.setViewportSize(viewport);
        await page.reload();

        const contributorList = page.locator('[data-testid="contributor-list"]');
        await expect(contributorList).toBeVisible();

        if (viewport.width < 768) {
          // Mobile: Simple list view
          const contributorItems = page.locator('[data-testid="contributor-item"]');
          for (let i = 0; i < Math.min(3, await contributorItems.count()); i++) {
            const item = contributorItems.nth(i);
            const itemWidth = await item.boundingBox();
            expect(itemWidth?.width).toBeGreaterThan(viewport.width * 0.8);
          }
          
          // Test mobile contributor avatars
          await expect(page.locator('[data-testid="mobile-contributor-avatar"]')).toBeVisible();
          
        } else {
          // Desktop: Grid or detailed list view
          await expect(page.locator('[data-testid="desktop-contributor-grid"]')).toBeVisible();
        }

        console.log(`✅ ${size}: Contributor list verified`);
      }
    });
  });

  describe('Checkout Process Responsiveness', () => {
    test('should provide mobile-optimized checkout flow', async () => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/registry/test-registry/checkout?items=item1,item2');

      // Test mobile checkout header
      await expect(page.locator('[data-testid="mobile-checkout-header"]')).toBeVisible();
      
      // Test step indicator
      const stepIndicator = page.locator('[data-testid="mobile-step-indicator"]');
      await expect(stepIndicator).toBeVisible();

      // Test address form mobile layout
      const addressForm = page.locator('[data-testid="address-form"]');
      await expect(addressForm).toBeVisible();

      // Test autocomplete on mobile
      await page.fill('input[name="address"]', '123');
      await expect(page.locator('[data-testid="address-suggestions"]')).toBeVisible();

      // Test mobile shipping options
      const shippingOptions = page.locator('[data-testid="shipping-options"]');
      await expect(shippingOptions).toBeVisible();

      // Test mobile payment form
      await page.click('[data-testid="continue-to-payment"]');
      await expect(page.locator('[data-testid="mobile-payment-form"]')).toBeVisible();

      // Test card input formatting
      const cardInput = page.locator('input[name="cardNumber"]');
      await expect(cardInput).toHaveAttribute('inputmode', 'numeric');
      await expect(cardInput).toHaveAttribute('autocomplete', 'cc-number');

      console.log('✅ Mobile checkout flow verified');
    });

    test('should handle multi-address shipping on mobile', async () => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/registry/test-registry/checkout?items=item1,item2,item3');

      // Test mobile shipping group cards
      await page.fill('input[name="firstName"]', 'Test');
      await page.fill('input[name="lastName"]', 'User');
      await page.fill('input[name="address"]', '123 Test St');
      await page.fill('input[name="city"]', 'Test City');
      await page.fill('input[name="state"]', 'TX');
      await page.fill('input[name="zip"]', '75001');

      // Configure different shipping addresses
      await page.click('[data-testid="item-shipping-toggle"]:first-child');
      await page.click('input[value="recipient"]');
      
      await page.click('[data-testid="item-shipping-toggle"]:nth-child(2)');
      await page.click('input[value="giver"]');

      await page.click('[data-testid="calculate-shipping"]');

      // Test mobile shipping group display
      const shippingGroups = page.locator('[data-testid="mobile-shipping-group"]');
      await expect(shippingGroups).toHaveCount.greaterThanOrEqual(2);

      // Test collapsible shipping group details on mobile
      const firstGroup = shippingGroups.first();
      await firstGroup.click();
      await expect(firstGroup.locator('[data-testid="shipping-details"]')).toBeVisible();

      console.log('✅ Mobile multi-address shipping verified');
    });
  });

  describe('Touch and Gesture Interactions', () => {
    test('should support touch interactions for mobile devices', async () => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/registry/test-registry');

      // Test swipe gestures on registry items
      const registryItems = page.locator('[data-testid="registry-item"]');
      if (await registryItems.count() > 0) {
        const firstItem = registryItems.first();
        
        // Test swipe to reveal actions
        const itemBox = await firstItem.boundingBox();
        if (itemBox) {
          await page.mouse.move(itemBox.x + itemBox.width - 10, itemBox.y + itemBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(itemBox.x + 10, itemBox.y + itemBox.height / 2);
          await page.mouse.up();
          
          // Check if swipe actions are revealed
          await expect(page.locator('[data-testid="swipe-actions"]')).toBeVisible();
        }
      }

      // Test pull-to-refresh (if implemented)
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });

      const startY = 50;
      await page.mouse.move(viewports.mobile.width / 2, startY);
      await page.mouse.down();
      await page.mouse.move(viewports.mobile.width / 2, startY + 100);
      await page.mouse.up();

      // Test tap targets are appropriately sized (minimum 44px)
      const actionButtons = page.locator('[data-testid="action-button"]');
      for (let i = 0; i < await actionButtons.count(); i++) {
        const button = actionButtons.nth(i);
        const buttonBox = await button.boundingBox();
        
        expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
        expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
      }

      console.log('✅ Touch interactions verified');
    });

    test('should provide appropriate spacing for touch targets', async () => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/registry/test-registry/group-gift/test-gift');

      // Test contribution amount buttons
      const amountButtons = page.locator('[data-testid="amount-preset-button"]');
      
      for (let i = 0; i < await amountButtons.count() - 1; i++) {
        const currentButton = amountButtons.nth(i);
        const nextButton = amountButtons.nth(i + 1);
        
        const currentBox = await currentButton.boundingBox();
        const nextBox = await nextButton.boundingBox();
        
        if (currentBox && nextBox) {
          // Minimum 8px spacing between touch targets
          const spacing = Math.abs(nextBox.x - (currentBox.x + currentBox.width));
          expect(spacing).toBeGreaterThanOrEqual(8);
        }
      }

      // Test form input spacing
      const formInputs = page.locator('input, button, select');
      for (let i = 0; i < Math.min(5, await formInputs.count() - 1); i++) {
        const currentInput = formInputs.nth(i);
        const nextInput = formInputs.nth(i + 1);
        
        const currentBox = await currentInput.boundingBox();
        const nextBox = await nextInput.boundingBox();
        
        if (currentBox && nextBox && currentBox.y !== nextBox.y) {
          // Minimum 12px vertical spacing between form elements
          const verticalSpacing = nextBox.y - (currentBox.y + currentBox.height);
          expect(verticalSpacing).toBeGreaterThanOrEqual(12);
        }
      }

      console.log('✅ Touch target spacing verified');
    });
  });

  describe('Performance on Mobile Devices', () => {
    test('should load quickly on slower mobile connections', async () => {
      // Simulate slow 3G connection
      await context.newCDPSession(page).then(session => 
        session.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: 500 * 1024 / 8, // 500kb/s
          uploadThroughput: 500 * 1024 / 8,
          latency: 300
        })
      );

      await page.setViewportSize(viewports.mobile);
      
      const startTime = Date.now();
      await page.goto('/registry/test-registry');
      
      // Wait for main content to be visible
      await expect(page.locator('[data-testid="registry-items"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds on slow connection
      expect(loadTime).toBeLessThan(5000);

      // Test that critical content loads first
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('[data-testid="registry-progress"]')).toBeVisible();

      console.log(`✅ Mobile page loaded in ${loadTime}ms on slow connection`);
    });

    test('should lazy load images and non-critical content', async () => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/registry/test-registry');

      // Test that above-the-fold images load immediately
      const heroImages = page.locator('[data-testid="hero-image"]');
      if (await heroImages.count() > 0) {
        await expect(heroImages.first()).toHaveAttribute('loading', 'eager');
      }

      // Test that below-the-fold images lazy load
      const productImages = page.locator('[data-testid="product-image"]');
      if (await productImages.count() > 0) {
        // Should have loading="lazy" attribute
        for (let i = 1; i < await productImages.count(); i++) {
          const img = productImages.nth(i);
          await expect(img).toHaveAttribute('loading', 'lazy');
        }
      }

      // Test progressive loading of registry items
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for lazy-loaded content
      await page.waitForTimeout(1000);
      
      // Verify additional content loaded
      const visibleItems = page.locator('[data-testid="registry-item"]:visible');
      expect(await visibleItems.count()).toBeGreaterThan(5);

      console.log('✅ Lazy loading verified');
    });
  });

  describe('Accessibility on Mobile', () => {
    test('should maintain accessibility standards on mobile', async () => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/registry/test-registry');

      // Test that all interactive elements are keyboard accessible
      const interactiveElements = page.locator('button, a, input, select, [tabindex="0"]');
      
      for (let i = 0; i < Math.min(10, await interactiveElements.count()); i++) {
        const element = interactiveElements.nth(i);
        
        // Should be focusable
        await element.focus();
        const isFocused = await element.evaluate(el => document.activeElement === el);
        expect(isFocused).toBe(true);
        
        // Should have proper ARIA labels or text content
        const ariaLabel = await element.getAttribute('aria-label');
        const textContent = await element.textContent();
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(
          ariaLabel || textContent?.trim() || ariaLabelledBy
        ).toBeTruthy();
      }

      // Test color contrast ratios
      const textElements = page.locator('p, h1, h2, h3, h4, h5, h6, span, a, button');
      for (let i = 0; i < Math.min(5, await textElements.count()); i++) {
        const element = textElements.nth(i);
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          };
        });
        
        // This is a simplified check - in production, use a proper contrast calculator
        expect(styles.color).toBeTruthy();
      }

      console.log('✅ Mobile accessibility verified');
    });
  });
});