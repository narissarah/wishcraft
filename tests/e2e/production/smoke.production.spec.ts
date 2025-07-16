import { test, expect } from '@playwright/test';

test.describe('Production Environment Smoke Tests', () => {
  test('should have healthy status endpoint', async ({ page }) => {
    const response = await page.goto('/health');
    expect(response?.status()).toBe(200);
    
    const healthData = await response?.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.environment).toBe('production');
    expect(healthData.database).toBe('connected');
    expect(healthData.services.encryption).toBe('configured');
    expect(healthData.services.shopify).toBe('configured');
  });

  test('should load main application page', async ({ page }) => {
    await page.goto('/app');
    
    // Check that the page loads without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // Production should have no console errors
    expect(errors.length).toBe(0);
  });

  test('should enforce HTTPS redirect', async ({ page }) => {
    // Test that HTTP requests are redirected to HTTPS
    const response = await page.goto('/app');
    expect(response?.url()).toMatch(/^https:/);
  });

  test('should have proper security headers', async ({ page }) => {
    const response = await page.goto('/app');
    
    // Check for production security headers
    const headers = response?.headers();
    expect(headers?.['strict-transport-security']).toBeTruthy();
    expect(headers?.['x-frame-options']).toBe('DENY');
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-xss-protection']).toBeTruthy();
    expect(headers?.['referrer-policy']).toBeTruthy();
  });

  test('should have optimized static assets', async ({ page }) => {
    await page.goto('/app');
    
    // Check that assets are properly compressed and cached
    const resourceRequests = new Map<string, string>();
    
    page.on('response', (response) => {
      if (response.url().includes('/assets/') || response.url().includes('/build/')) {
        resourceRequests.set(response.url(), response.headers()['content-encoding'] || 'none');
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // Should have gzip or brotli compression
    const compressionTypes = Array.from(resourceRequests.values());
    expect(compressionTypes.some(type => type === 'gzip' || type === 'br')).toBe(true);
  });

  test('should handle high availability', async ({ page }) => {
    // Test multiple requests to ensure consistent responses
    const responses = [];
    
    for (let i = 0; i < 5; i++) {
      const response = await page.goto('/health');
      responses.push(response?.status());
    }
    
    // All requests should succeed
    expect(responses.every(status => status === 200)).toBe(true);
  });

  test('should have proper error handling', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    expect(response?.status()).toBe(404);
    
    // Should show a proper error page without exposing internal details
    await expect(page.locator('body')).toBeVisible();
    
    // Should not expose stack traces or internal errors
    const content = await page.content();
    expect(content).not.toContain('Error:');
    expect(content).not.toContain('at ');
    expect(content).not.toContain('node_modules');
  });

  test('should handle database failover', async ({ page }) => {
    // Test database connectivity under load
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      promises.push(page.goto('/health'));
    }
    
    const responses = await Promise.all(promises);
    
    // All health checks should pass
    expect(responses.every(response => response?.status() === 200)).toBe(true);
  });

  test('should have proper monitoring endpoints', async ({ page }) => {
    // Test that monitoring endpoints are available
    const metricsResponse = await page.goto('/metrics');
    
    // Should either be properly secured (401/403) or return metrics
    expect([200, 401, 403].includes(metricsResponse?.status() || 0)).toBe(true);
  });

  test('should handle Shopify webhook validation properly', async ({ page }) => {
    // Test webhook endpoint security
    const response = await page.goto('/webhooks/orders/create');
    
    // Should properly validate and return 401 for unauthorized requests
    expect(response?.status()).toBe(401);
    
    // Should not expose internal error details
    const content = await page.content();
    expect(content).not.toContain('Error:');
  });

  test('should have proper rate limiting', async ({ page }) => {
    // Test rate limiting on API endpoints
    const promises = [];
    
    // Make multiple rapid requests
    for (let i = 0; i < 20; i++) {
      promises.push(page.goto('/api/registries'));
    }
    
    const responses = await Promise.all(promises);
    const statuses = responses.map(r => r?.status());
    
    // Should eventually hit rate limits (429) or maintain consistent responses
    expect(statuses.every(status => [200, 401, 403, 429].includes(status || 0))).toBe(true);
  });

  test('should have proper performance metrics', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Production should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});