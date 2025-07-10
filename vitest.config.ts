import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/test/e2e/**',
      '**/test/accessibility/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        'build/',
        'public/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.setup.*',
        'app/entry.*.ts',
        'app/root.tsx',
        'app/tailwind.css'
      ],
      include: [
        'app/**/*.{ts,tsx}',
        '!app/**/*.test.{ts,tsx}',
        '!app/**/*.spec.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Critical business logic should have higher coverage
        'app/lib/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },
    // Performance settings
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app')
    }
  }
});