/**
 * Comprehensive Screen Reader Testing
 * Automated accessibility testing for screen reader compatibility
 */

import { test, expect, Page } from '@playwright/test';
import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';
import { announceToScreenReader } from '~/lib/accessibility';

// Screen reader simulation utilities
interface ScreenReaderEvent {
  type: 'announcement' | 'focus' | 'navigation' | 'interaction';
  element: string;
  text: string;
  role?: string;
  properties?: Record<string, any>;
  timestamp: number;
}

interface ScreenReaderTest {
  name: string;
  url: string;
  actions: Array<{
    type: 'click' | 'focus' | 'keyboard' | 'wait';
    selector?: string;
    key?: string;
    delay?: number;
  }>;
  expectedAnnouncements: string[];
  expectedFocusOrder: string[];
}

// Mock screen reader class
class MockScreenReader {
  private events: ScreenReaderEvent[] = [];
  private currentFocus: string | null = null;
  private announcements: string[] = [];

  /**
   * Simulate screen reader announcement
   */
  announce(text: string, element: string = 'system'): void {
    this.events.push({
      type: 'announcement',
      element,
      text,
      timestamp: Date.now(),
    });
    this.announcements.push(text);
  }

  /**
   * Simulate focus change
   */
  focus(element: string, role?: string, properties?: Record<string, any>): void {
    this.currentFocus = element;
    this.events.push({
      type: 'focus',
      element,
      text: `Focus moved to ${element}`,
      role,
      properties,
      timestamp: Date.now(),
    });
  }

  /**
   * Simulate navigation
   */
  navigate(direction: 'next' | 'previous' | 'up' | 'down', element: string): void {
    this.events.push({
      type: 'navigation',
      element,
      text: `Navigated ${direction} to ${element}`,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all events
   */
  getEvents(): ScreenReaderEvent[] {
    return this.events;
  }

  /**
   * Get announcements
   */
  getAnnouncements(): string[] {
    return this.announcements;
  }

  /**
   * Get current focus
   */
  getCurrentFocus(): string | null {
    return this.currentFocus;
  }

  /**
   * Clear events
   */
  clear(): void {
    this.events = [];
    this.announcements = [];
    this.currentFocus = null;
  }
}

// Utility functions for screen reader testing
async function setupScreenReaderTesting(page: Page): Promise<MockScreenReader> {
  const screenReader = new MockScreenReader();

  // Inject screen reader simulation
  await page.addInitScript(() => {
    // Mock screen reader APIs
    window.mockScreenReader = {
      announce: (text: string, element?: string) => {
        window.screenReaderEvents = window.screenReaderEvents || [];
        window.screenReaderEvents.push({
          type: 'announcement',
          element: element || 'system',
          text,
          timestamp: Date.now(),
        });
      },
      focus: (element: string, role?: string, properties?: Record<string, any>) => {
        window.screenReaderEvents = window.screenReaderEvents || [];
        window.screenReaderEvents.push({
          type: 'focus',
          element,
          text: `Focus moved to ${element}`,
          role,
          properties,
          timestamp: Date.now(),
        });
      },
    };

    // Override native focus events
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      const result = originalFocus.call(this, options);
      
      // Announce focus change
      const role = this.getAttribute('role') || this.tagName.toLowerCase();
      const label = this.getAttribute('aria-label') || 
                   this.getAttribute('aria-labelledby') ||
                   this.textContent?.trim() ||
                   this.getAttribute('alt') ||
                   this.getAttribute('title') ||
                   'unlabeled element';
      
      window.mockScreenReader?.focus(
        `${role}: ${label}`,
        role,
        {
          tagName: this.tagName,
          id: this.id,
          className: this.className,
          ariaLabel: this.getAttribute('aria-label'),
          ariaLabelledBy: this.getAttribute('aria-labelledby'),
          ariaDescribedBy: this.getAttribute('aria-describedby'),
          role: this.getAttribute('role'),
        }
      );
      
      return result;
    };

    // Monitor aria-live regions
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const target = mutation.target as Element;
          const ariaLive = target.getAttribute('aria-live');
          
          if (ariaLive === 'polite' || ariaLive === 'assertive') {
            const text = target.textContent?.trim();
            if (text) {
              window.mockScreenReader?.announce(text, `aria-live-${ariaLive}`);
            }
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Monitor role changes
    const roleObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'role') {
          const target = mutation.target as Element;
          const newRole = target.getAttribute('role');
          const label = target.getAttribute('aria-label') || target.textContent?.trim() || 'element';
          
          window.mockScreenReader?.announce(`Role changed to ${newRole} for ${label}`, 'role-change');
        }
      });
    });

    roleObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['role'],
      subtree: true,
    });
  });

  return screenReader;
}

async function getScreenReaderEvents(page: Page): Promise<ScreenReaderEvent[]> {
  return await page.evaluate(() => {
    return window.screenReaderEvents || [];
  });
}

async function simulateScreenReaderNavigation(page: Page, direction: 'next' | 'previous' | 'up' | 'down'): Promise<void> {
  const keyMap = {
    next: 'Tab',
    previous: 'Shift+Tab',
    up: 'ArrowUp',
    down: 'ArrowDown',
  };

  await page.keyboard.press(keyMap[direction]);
}

// Screen reader test suites
const screenReaderTests: ScreenReaderTest[] = [
  {
    name: 'Admin Dashboard Navigation',
    url: '/admin',
    actions: [
      { type: 'wait', delay: 1000 },
      { type: 'keyboard', key: 'Tab' },
      { type: 'keyboard', key: 'Tab' },
      { type: 'keyboard', key: 'Tab' },
      { type: 'keyboard', key: 'Enter' },
    ],
    expectedAnnouncements: [
      'WishCraft Dashboard',
      'Key Statistics',
      'Quick Actions',
      'Recent Registries',
    ],
    expectedFocusOrder: [
      'Create Registry button',
      'View Analytics button',
      'Settings button',
      'View Analytics link',
    ],
  },
  {
    name: 'Registry Form Accessibility',
    url: '/admin/registries/new',
    actions: [
      { type: 'wait', delay: 1000 },
      { type: 'focus', selector: 'input[name="title"]' },
      { type: 'keyboard', key: 'Tab' },
      { type: 'keyboard', key: 'Tab' },
      { type: 'keyboard', key: 'Space' },
    ],
    expectedAnnouncements: [
      'Create Registry',
      'Registry title required',
      'Registry description',
      'Privacy setting changed',
    ],
    expectedFocusOrder: [
      'textbox: Registry title',
      'textbox: Registry description',
      'radio: Public',
      'radio: Private',
    ],
  },
  {
    name: 'Settings Page Accessibility',
    url: '/admin/settings',
    actions: [
      { type: 'wait', delay: 1000 },
      { type: 'keyboard', key: 'Tab' },
      { type: 'keyboard', key: 'Tab' },
      { type: 'keyboard', key: 'ArrowDown' },
      { type: 'keyboard', key: 'Enter' },
    ],
    expectedAnnouncements: [
      'WishCraft Settings',
      'General tab',
      'Appearance tab',
      'Theme Settings',
      'Admin Theme',
    ],
    expectedFocusOrder: [
      'tab: General',
      'tab: Appearance',
      'tab: Features',
      'tab: Advanced',
    ],
  },
];

// Main test suite
test.describe('Screen Reader Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Configure axe-core for screen reader testing
    await injectAxe(page);
    await configureAxe(page, {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-order': { enabled: true },
        'aria-labels': { enabled: true },
        'landmarks': { enabled: true },
        'headings': { enabled: true },
        'lists': { enabled: true },
        'tables': { enabled: true },
        'forms': { enabled: true },
        'images': { enabled: true },
        'links': { enabled: true },
        'buttons': { enabled: true },
      },
    });
  });

  // Test each screen reader scenario
  screenReaderTests.forEach((testCase) => {
    test(`${testCase.name}`, async ({ page }) => {
      const screenReader = await setupScreenReaderTesting(page);
      
      // Navigate to the page
      await page.goto(testCase.url);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Execute test actions
      for (const action of testCase.actions) {
        switch (action.type) {
          case 'wait':
            await page.waitForTimeout(action.delay || 1000);
            break;
          case 'focus':
            if (action.selector) {
              await page.focus(action.selector);
            }
            break;
          case 'keyboard':
            if (action.key) {
              await page.keyboard.press(action.key);
            }
            break;
          case 'click':
            if (action.selector) {
              await page.click(action.selector);
            }
            break;
        }
        
        // Small delay between actions
        await page.waitForTimeout(100);
      }
      
      // Get screen reader events
      const events = await getScreenReaderEvents(page);
      
      // Verify announcements
      const announcements = events
        .filter(event => event.type === 'announcement')
        .map(event => event.text);
      
      testCase.expectedAnnouncements.forEach((expected) => {
        expect(announcements.some(announcement => 
          announcement.toLowerCase().includes(expected.toLowerCase())
        )).toBe(true);
      });
      
      // Verify focus order
      const focusEvents = events
        .filter(event => event.type === 'focus')
        .map(event => event.text);
      
      if (testCase.expectedFocusOrder.length > 0) {
        testCase.expectedFocusOrder.forEach((expected, index) => {
          if (focusEvents[index]) {
            expect(focusEvents[index].toLowerCase()).toContain(expected.toLowerCase());
          }
        });
      }
      
      // Run axe-core accessibility checks
      await checkA11y(page, undefined, {
        detailedReport: true,
        detailedReportOptions: {
          html: true,
        },
      });
    });
  });

  // Test keyboard navigation
  test('Keyboard Navigation Flow', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin');
    
    // Test tab navigation
    const focusableElements = await page.evaluate(() => {
      const focusable = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(focusable).map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        textContent: el.textContent?.trim()?.substring(0, 50),
      }));
    });
    
    expect(focusableElements.length).toBeGreaterThan(0);
    
    // Test sequential focus
    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          tagName: active?.tagName,
          id: active?.id,
          className: active?.className,
          ariaLabel: active?.getAttribute('aria-label'),
        };
      });
      
      expect(focusedElement.tagName).toBeDefined();
    }
  });

  // Test ARIA landmarks
  test('ARIA Landmarks and Headings', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin');
    
    // Check for landmarks
    const landmarks = await page.evaluate(() => {
      const landmarkSelectors = [
        '[role="main"]',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]',
        '[role="complementary"]',
        '[role="search"]',
        'main',
        'nav',
        'header',
        'footer',
        'aside',
      ];
      
      return landmarkSelectors.map(selector => ({
        selector,
        count: document.querySelectorAll(selector).length,
      })).filter(item => item.count > 0);
    });
    
    expect(landmarks.length).toBeGreaterThan(0);
    
    // Check heading hierarchy
    const headings = await page.evaluate(() => {
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(headingElements).map(heading => ({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent?.trim(),
        id: heading.id,
        ariaLabel: heading.getAttribute('aria-label'),
      }));
    });
    
    expect(headings.length).toBeGreaterThan(0);
    
    // Verify heading hierarchy (should start with h1 and not skip levels)
    if (headings.length > 0) {
      expect(headings[0].level).toBe(1);
      
      for (let i = 1; i < headings.length; i++) {
        const currentLevel = headings[i].level;
        const previousLevel = headings[i - 1].level;
        
        // Should not skip more than one level
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      }
    }
  });

  // Test form accessibility
  test('Form Accessibility', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin/registries/new');
    
    // Check form labels
    const formElements = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      return Array.from(inputs).map(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const ariaDescribedBy = input.getAttribute('aria-describedby');
        
        return {
          id: input.id,
          type: input.type || input.tagName.toLowerCase(),
          hasLabel: !!label,
          hasAriaLabel: !!ariaLabel,
          hasAriaLabelledBy: !!ariaLabelledBy,
          hasAriaDescribedBy: !!ariaDescribedBy,
          required: input.hasAttribute('required'),
          ariaRequired: input.getAttribute('aria-required') === 'true',
          ariaInvalid: input.getAttribute('aria-invalid') === 'true',
        };
      });
    });
    
    // Every form element should have a label
    formElements.forEach((element, index) => {
      expect(
        element.hasLabel || element.hasAriaLabel || element.hasAriaLabelledBy,
        `Form element ${index} (${element.type}) should have a label`
      ).toBe(true);
    });
    
    // Test form validation announcements
    const titleInput = page.locator('input[name="title"]');
    await titleInput.focus();
    await titleInput.fill('');
    await titleInput.blur();
    
    // Check for error announcement
    const events = await getScreenReaderEvents(page);
    const errorAnnouncements = events.filter(event => 
      event.type === 'announcement' && 
      event.text.toLowerCase().includes('error')
    );
    
    expect(errorAnnouncements.length).toBeGreaterThan(0);
  });

  // Test live regions
  test('Live Region Announcements', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin/settings');
    
    // Interact with a form element that triggers live updates
    const colorPicker = page.locator('input[type="color"]').first();
    if (await colorPicker.isVisible()) {
      await colorPicker.focus();
      await colorPicker.fill('#ff0000');
      await colorPicker.blur();
      
      // Wait for live region update
      await page.waitForTimeout(1000);
      
      const events = await getScreenReaderEvents(page);
      const liveAnnouncements = events.filter(event => 
        event.element.includes('aria-live')
      );
      
      // Should have at least one live region announcement
      expect(liveAnnouncements.length).toBeGreaterThan(0);
    }
  });

  // Test table accessibility
  test('Table Accessibility', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin/registries');
    
    // Check for tables
    const tables = await page.evaluate(() => {
      const tableElements = document.querySelectorAll('table');
      return Array.from(tableElements).map(table => {
        const caption = table.querySelector('caption');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const headers = table.querySelectorAll('th');
        
        return {
          hasCaption: !!caption,
          hasHeader: !!thead,
          hasBody: !!tbody,
          headerCount: headers.length,
          headersHaveScope: Array.from(headers).every(th => 
            th.getAttribute('scope') || th.getAttribute('id')
          ),
          ariaLabel: table.getAttribute('aria-label'),
          ariaLabelledBy: table.getAttribute('aria-labelledby'),
        };
      });
    });
    
    tables.forEach((table, index) => {
      // Tables should have captions or aria-label
      expect(
        table.hasCaption || table.ariaLabel || table.ariaLabelledBy,
        `Table ${index} should have a caption or aria-label`
      ).toBe(true);
      
      // Tables should have proper headers
      if (table.headerCount > 0) {
        expect(
          table.headersHaveScope,
          `Table ${index} headers should have scope attributes`
        ).toBe(true);
      }
    });
  });

  // Test button accessibility
  test('Button Accessibility', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin');
    
    const buttons = await page.evaluate(() => {
      const buttonElements = document.querySelectorAll('button, [role="button"]');
      return Array.from(buttonElements).map(button => {
        const ariaLabel = button.getAttribute('aria-label');
        const ariaLabelledBy = button.getAttribute('aria-labelledby');
        const ariaDescribedBy = button.getAttribute('aria-describedby');
        const textContent = button.textContent?.trim();
        
        return {
          hasText: !!textContent,
          hasAriaLabel: !!ariaLabel,
          hasAriaLabelledBy: !!ariaLabelledBy,
          hasAriaDescribedBy: !!ariaDescribedBy,
          ariaDisabled: button.getAttribute('aria-disabled') === 'true',
          disabled: button.hasAttribute('disabled'),
          tabIndex: button.getAttribute('tabindex'),
          role: button.getAttribute('role'),
        };
      });
    });
    
    buttons.forEach((button, index) => {
      // Buttons should have accessible names
      expect(
        button.hasText || button.hasAriaLabel || button.hasAriaLabelledBy,
        `Button ${index} should have accessible name`
      ).toBe(true);
      
      // Disabled buttons should not be focusable
      if (button.disabled || button.ariaDisabled) {
        expect(
          button.tabIndex === '-1' || button.tabIndex === null,
          `Disabled button ${index} should not be focusable`
        ).toBe(true);
      }
    });
  });

  // Test skip links
  test('Skip Links', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin');
    
    // Tab to first element (should be skip link)
    await page.keyboard.press('Tab');
    
    const focusedElement = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tagName: active?.tagName,
        textContent: active?.textContent?.trim(),
        href: active?.getAttribute('href'),
        className: active?.className,
      };
    });
    
    // Should have skip link as first focusable element
    expect(focusedElement.textContent?.toLowerCase()).toContain('skip');
    
    // Test skip link functionality
    if (focusedElement.tagName === 'A' && focusedElement.href) {
      await page.keyboard.press('Enter');
      
      const targetElement = await page.evaluate(() => {
        const target = document.querySelector(location.hash);
        return target ? {
          tagName: target.tagName,
          id: target.id,
          focused: target === document.activeElement,
        } : null;
      });
      
      expect(targetElement).toBeDefined();
      expect(targetElement?.focused).toBe(true);
    }
  });

  // Test error handling
  test('Error Announcements', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin/registries/new');
    
    // Submit form with errors
    await page.click('button[type="submit"]');
    
    // Wait for error announcements
    await page.waitForTimeout(1000);
    
    const events = await getScreenReaderEvents(page);
    const errorAnnouncements = events.filter(event => 
      event.type === 'announcement' && 
      (event.text.toLowerCase().includes('error') || 
       event.text.toLowerCase().includes('required') ||
       event.text.toLowerCase().includes('invalid'))
    );
    
    expect(errorAnnouncements.length).toBeGreaterThan(0);
  });

  // Test dynamic content updates
  test('Dynamic Content Updates', async ({ page }) => {
    await setupScreenReaderTesting(page);
    await page.goto('/admin');
    
    // Wait for initial load
    await page.waitForTimeout(1000);
    
    // Clear previous events
    await page.evaluate(() => {
      window.screenReaderEvents = [];
    });
    
    // Trigger dynamic content update (e.g., data refresh)
    await page.click('button[aria-label*="refresh"], button[aria-label*="reload"]');
    
    // Wait for update
    await page.waitForTimeout(2000);
    
    const events = await getScreenReaderEvents(page);
    const updateAnnouncements = events.filter(event => 
      event.type === 'announcement' && 
      (event.text.toLowerCase().includes('updated') || 
       event.text.toLowerCase().includes('loaded') ||
       event.text.toLowerCase().includes('refreshed'))
    );
    
    // Should announce content updates
    expect(updateAnnouncements.length).toBeGreaterThan(0);
  });
});

// Export utilities for use in other tests
export {
  setupScreenReaderTesting,
  getScreenReaderEvents,
  simulateScreenReaderNavigation,
  MockScreenReader,
  type ScreenReaderEvent,
  type ScreenReaderTest,
};