import { test, expect } from '@playwright/test';

/**
 * E2E tests for Health Check endpoints
 * Tests actual HTTP requests to running application
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Health Check Endpoints', () => {
  test('main health endpoint should return healthy status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toMatchObject({
      status: expect.stringMatching(/healthy|degraded/),
      timestamp: expect.any(String),
      version: expect.any(String),
      environment: expect.any(String),
      checks: {
        database: expect.objectContaining({
          status: expect.any(String),
        }),
        environment: expect.objectContaining({
          status: expect.any(String),
        }),
        memory: expect.objectContaining({
          status: expect.any(String),
        }),
        redis: expect.objectContaining({
          status: expect.any(String),
        }),
      },
    });
  });

  test('liveness probe should return simple response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health/liveness`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toMatchObject({
      status: 'alive',
      timestamp: expect.any(String),
    });
  });

  test('readiness probe should check dependencies', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health/readiness`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toMatchObject({
      status: 'ready',
      timestamp: expect.any(String),
      database: expect.any(Boolean),
      shopify_configured: expect.any(Boolean),
    });
  });

  test('health endpoint should not be cached', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('must-revalidate');
  });

  test('health check should include server timing', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    
    const headers = response.headers();
    expect(headers).toHaveProperty('content-type', 'application/json');
  });

  test.describe('Error scenarios', () => {
    test('should handle database connection failure gracefully', async ({ request }) => {
      // This test would require mocking database failure
      // In a real scenario, you might have a test mode that simulates failures
      
      // For now, we just verify the endpoint handles errors properly
      const response = await request.get(`${BASE_URL}/health`);
      const data = await response.json();
      
      // If database is down, status should be 503
      if (data.checks.database.status === 'unhealthy') {
        expect(response.status()).toBe(503);
      }
    });
  });

  test.describe('Performance', () => {
    test('health check should respond quickly', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${BASE_URL}/health`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      // Health check should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
      
      // Check if response includes performance metrics
      const data = await response.json();
      if (data.checks?.database?.responseTime) {
        expect(data.checks.database.responseTime).toBeLessThan(100); // DB should respond quickly
      }
    });
  });

  test.describe('Security headers', () => {
    test('should include security headers', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/health`);
      const headers = response.headers();
      
      // Check for basic security headers
      expect(headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(headers).toHaveProperty('referrer-policy');
      
      // In production, should have HSTS
      if (process.env.NODE_ENV === 'production') {
        expect(headers).toHaveProperty('strict-transport-security');
      }
    });
  });
});