import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Setup files
    setupFiles: ['./test/setup.ts'],
    
    // Global timeout
    testTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'build/**',
        '.cache/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    
    // Path aliases
    alias: {
      '~': resolve(__dirname, './app'),
    },
    
    // Globals
    globals: true,
    
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'build',
      '.cache',
      'test/e2e/**', // E2E tests run separately with Playwright
    ],
    
    // Reporter
    reporters: ['default', 'html'],
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
    },
  },
});