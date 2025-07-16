import { test, expect } from '@playwright/test';

test.describe('Staging Environment Smoke Tests', () => {
  test('should have healthy status endpoint', async ({ page }) => {
    const response = await page.goto('/health');
    expect(response?.status()).toBe(200);
    
    const healthData = await response?.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.environment).toBe('staging');
    expect(healthData.database).toBe('connected');
  });

  test('should load main application page', async ({ page }) => {
    await page.goto('/app');
    
    // Check that the page loads without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Check for any console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // Allow for some expected dev warnings but no actual errors
    const criticalErrors = errors.filter(error => 
      !error.includes('Warning:') && 
      !error.includes('Deprecated') &&
      !error.includes('source map')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle 404 gracefully', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    expect(response?.status()).toBe(404);
    
    // Should show a proper error page, not a blank page
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have proper security headers', async ({ page }) => {
    const response = await page.goto('/app');
    
    // Check for important security headers
    const headers = response?.headers();
    expect(headers?.['x-frame-options']).toBeTruthy();
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-xss-protection']).toBeTruthy();
  });

  test('should have working static assets', async ({ page }) => {
    await page.goto('/app');
    
    // Check that CSS and JS assets load successfully
    const resourceRequests = new Set<string>();
    
    page.on('response', (response) => {
      if (response.url().includes('/assets/') || response.url().includes('/build/')) {
        resourceRequests.add(response.status().toString());
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // Should have successful asset loads
    expect(resourceRequests.has('200')).toBe(true);
    expect(resourceRequests.has('404')).toBe(false);
  });

  test('should handle database connectivity', async ({ page }) => {
    // Test an endpoint that requires database access
    const response = await page.goto('/api/registries');
    
    // Should not return 500 errors due to database issues
    expect(response?.status()).not.toBe(500);
  });

  test('should have proper CORS configuration', async ({ page }) => {
    // Test CORS for API endpoints
    const response = await page.goto('/api/webhooks/test');
    
    const headers = response?.headers();
    expect(headers?.['access-control-allow-origin']).toBeDefined();
  });

  test('should handle Shopify webhook validation', async ({ page }) => {
    // Test webhook endpoint exists and handles validation
    const response = await page.goto('/webhooks/orders/create');
    
    // Should exist but require proper authentication
    expect(response?.status()).toBe(401);
  });
});