import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

/**
 * Global test setup
 * Configures test environment and mocks
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/wishcraft_test';
process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-api-secret';
process.env.SHOPIFY_APP_URL = 'https://test.app';

// Global test hooks
beforeAll(() => {
  // Setup code that runs once before all tests
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  // Cleanup code that runs once after all tests
  console.log('✅ Test suite completed');
});

beforeEach(() => {
  // Reset all mocks before each test
  mockReset();
});

afterEach(() => {
  // Cleanup after each test
  // Clear any timers, intervals, etc.
});

// Mock console methods in test to reduce noise
global.console = {
  ...console,
  log: () => {},
  info: () => {},
  warn: () => {},
  debug: () => {},
  // Keep error for debugging
  error: console.error,
};

// Mock fetch for tests
global.fetch = vi.fn();

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});