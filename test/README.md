# WishCraft Test Suite

## Overview

This directory contains the complete test suite for WishCraft, organized by test type:

- **Unit Tests** (`/unit`) - Test individual components and functions in isolation
- **Integration Tests** (`/integration`) - Test interactions between components
- **E2E Tests** (`/e2e`) - Test complete user workflows

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:coverage
```

### Watch Mode (Development)
```bash
npm run test -- --watch
```

## Test Structure

### Unit Tests
- Located in `/test/unit`
- Test individual functions and modules
- Use mocked dependencies
- Fast execution
- Example: `logger.test.ts`, `redis.test.ts`

### Integration Tests
- Located in `/test/integration`
- Test API endpoints and database interactions
- Use partial mocks
- Medium execution time
- Example: `api.registries.test.ts`

### E2E Tests
- Located in `/test/e2e`
- Test complete user flows
- Run against real application
- Slower execution
- Example: `health-check.spec.ts`

## Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '~/lib/myModule';

describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Integration Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { loader } from '~/routes/api.endpoint';

describe('API Endpoint', () => {
  it('should handle request', async () => {
    const request = new Request('https://app.test/api/endpoint');
    const response = await loader({ request, params: {}, context: {} });
    
    expect(response.status).toBe(200);
  });
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('user can view health status', async ({ page }) => {
  await page.goto('/health');
  await expect(page.locator('text=healthy')).toBeVisible();
});
```

## Test Utilities

### Setup File
The `setup.ts` file configures:
- Test environment variables
- Global mocks
- Custom matchers
- Test hooks

### Mock Helpers
- Database mocks: Use `vitest-mock-extended`
- API mocks: Use `vi.mock()`
- Network mocks: Use `msw` for complex scenarios

## Coverage Requirements

- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

Coverage reports are generated in `/coverage` directory.

## Best Practices

1. **Test Names**: Use descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Follow AAA pattern for test structure
3. **One Assertion**: Prefer one logical assertion per test
4. **Mock External Dependencies**: Mock databases, APIs, and file systems
5. **Test Edge Cases**: Include error scenarios and boundary conditions
6. **Keep Tests Fast**: Unit tests should run in milliseconds
7. **Avoid Test Interdependence**: Each test should be independent

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-deployment

Failed tests block deployment to production.

## Debugging Tests

### VSCode
1. Install "Vitest" extension
2. Use test explorer to run/debug individual tests
3. Set breakpoints in test files

### Command Line
```bash
# Run specific test file
npm test logger.test.ts

# Run tests matching pattern
npm test -- -t "should handle errors"

# Run with verbose output
npm test -- --reporter=verbose
```

## Performance Testing

For performance-critical code:
1. Use `performance.now()` to measure execution time
2. Assert that operations complete within acceptable time
3. Consider using `vitest-benchmark` for detailed benchmarks

## Accessibility Testing

E2E tests include basic accessibility checks:
- ARIA labels
- Keyboard navigation
- Screen reader compatibility

Use `axe-playwright` for comprehensive a11y testing.