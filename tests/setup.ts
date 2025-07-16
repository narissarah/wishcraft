import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { createHash } from 'crypto';
import * as React from 'react';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-api-secret';
process.env.SHOPIFY_APP_URL = 'https://test-app.com';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters_long';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';

// Mock Shopify App Bridge
jest.mock('@shopify/app-bridge-react', () => ({
  Provider: ({ children }: any) => children,
  useAppBridge: () => ({
    dispatch: jest.fn(),
  }),
}));

// Mock Shopify API
jest.mock('@shopify/shopify-api', () => ({
  shopifyApi: jest.fn(() => ({
    auth: {
      begin: jest.fn(),
      callback: jest.fn(),
    },
    webhooks: {
      register: jest.fn(),
      process: jest.fn(),
    },
    rest: {
      Product: jest.fn(),
      Customer: jest.fn(),
      Order: jest.fn(),
    },
    graphql: {
      query: jest.fn(),
    },
  })),
  ApiVersion: {
    April24: '2024-04',
    July24: '2024-07',
  },
}));

// Mock Remix
jest.mock('@remix-run/react', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/test' }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  useFetcher: () => ({
    submit: jest.fn(),
    state: 'idle',
    data: null,
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => 
    React.createElement('a', { href: to, 'data-testid': 'link' }, children),
}));

// Mock Polaris components
jest.mock('@shopify/polaris', () => ({
  Card: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'card' }, children),
  Text: ({ children }: { children: React.ReactNode }) => 
    React.createElement('span', { 'data-testid': 'text' }, children),
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => 
    React.createElement('button', { 'data-testid': 'button', onClick }, children),
  TextField: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => 
    React.createElement('div', null, 
      React.createElement('label', null, label),
      React.createElement('input', { 
        'data-testid': 'textfield', 
        value, 
        onChange: (e: any) => onChange(e.target.value) 
      })
    ),
  Modal: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? React.createElement('div', { 'data-testid': 'modal' }, children) : null,
  Badge: ({ children }: { children: React.ReactNode }) => 
    React.createElement('span', { 'data-testid': 'badge' }, children),
  Banner: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'banner' }, children),
  DataTable: ({ rows }: { rows: any[][] }) => 
    React.createElement('table', { 'data-testid': 'datatable' },
      React.createElement('tbody', null,
        rows.map((row, i) => 
          React.createElement('tr', { key: i },
            row.map((cell, j) => 
              React.createElement('td', { key: j }, cell)
            )
          )
        )
      )
    ),
  EmptyState: ({ heading, children }: { heading: string; children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'emptystate' },
      React.createElement('h2', null, heading),
      children
    ),
  InlineStack: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'inline-stack' }, children),
  BlockStack: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'block-stack' }, children),
  Box: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'box' }, children),
  Spinner: () => 
    React.createElement('div', { 'data-testid': 'spinner' }, 'Loading...'),
  Select: ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: any[] }) => 
    React.createElement('select', { 
      'data-testid': 'select', 
      value, 
      onChange: (e: any) => onChange(e.target.value) 
    },
      options.map(option => 
        React.createElement('option', { key: option.value, value: option.value }, option.label)
      )
    ),
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn((password: string, hash: string) => 
    Promise.resolve(hash === `hashed_${password}`)
  ),
}));

// Mock crypto for deterministic tests
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn((size: number) => Buffer.from('a'.repeat(size))),
}));

// Mock Prisma Client with comprehensive methods
const mockPrismaClient = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  session: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  shop: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  registry: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  registryItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  registryPurchase: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  registryCollaborator: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  registryActivity: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  systemJob: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Test utilities
export const testUtils = {
  /**
   * Create mock registry data
   */
  createMockRegistry: (overrides: any = {}) => ({
    id: 'test-registry-id',
    title: 'Test Registry',
    description: 'A test registry',
    slug: 'test-registry',
    shopId: 'test-shop',
    customerId: 'test-customer',
    customerEmail: 'test@example.com',
    collaborationEnabled: false,
    collaborationSettings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create mock collaborator data
   */
  createMockCollaborator: (overrides: any = {}) => ({
    id: 'test-collaborator-id',
    registryId: 'test-registry-id',
    email: 'collaborator@example.com',
    name: 'Test Collaborator',
    role: 'collaborator',
    permissions: 'read_write',
    status: 'active',
    invitedBy: 'owner@example.com',
    invitedAt: new Date(),
    acceptedAt: new Date(),
    roleDisplayName: 'Collaborator',
    permissionDisplayName: 'Edit Registry',
    ...overrides,
  }),

  /**
   * Create mock purchase data
   */
  createMockPurchase: (overrides: any = {}) => ({
    id: 'test-purchase-id',
    registryId: 'test-registry-id',
    productId: 'test-product-id',
    quantity: 1,
    unitPrice: 29.99,
    totalAmount: 29.99,
    currencyCode: 'USD',
    orderId: 'test-order-id',
    orderName: '#1001',
    purchaserEmail: 'purchaser@example.com',
    purchaserName: 'Test Purchaser',
    giftMessage: 'Test gift message',
    status: 'confirmed',
    createdAt: new Date(),
    ...overrides,
  }),

  /**
   * Create mock activity data
   */
  createMockActivity: (overrides: any = {}) => ({
    id: 'test-activity-id',
    registryId: 'test-registry-id',
    actorEmail: 'actor@example.com',
    actorName: 'Test Actor',
    action: 'item_added',
    description: 'Added item to registry',
    metadata: {},
    isSystem: false,
    createdAt: new Date(),
    ...overrides,
  }),

  /**
   * Create mock webhook payload
   */
  createMockWebhookPayload: (topic: string, data: any) => {
    const payload = JSON.stringify(data);
    const hmac = createHash('sha256')
      .update(payload + process.env.WEBHOOK_SECRET)
      .digest('base64');
    
    return {
      payload,
      headers: {
        'X-Shopify-Topic': topic,
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
        'Content-Type': 'application/json',
      },
    };
  },

  /**
   * Reset all mocks
   */
  resetMocks: () => {
    Object.values(mockPrismaClient).forEach(method => {
      if (typeof method === 'object') {
        Object.values(method).forEach(subMethod => {
          if (jest.isMockFunction(subMethod)) {
            subMethod.mockReset();
          }
        });
      } else if (jest.isMockFunction(method)) {
        method.mockReset();
      }
    });
  },

  /**
   * Mock successful database responses
   */
  mockSuccessfulDbResponses: () => {
    mockPrismaClient.registry.findUnique.mockResolvedValue(testUtils.createMockRegistry());
    mockPrismaClient.registry.findMany.mockResolvedValue([testUtils.createMockRegistry()]);
    mockPrismaClient.registry.create.mockResolvedValue(testUtils.createMockRegistry());
    mockPrismaClient.registry.update.mockResolvedValue(testUtils.createMockRegistry());
    
    mockPrismaClient.registryCollaborator.findMany.mockResolvedValue([testUtils.createMockCollaborator()]);
    mockPrismaClient.registryCollaborator.create.mockResolvedValue(testUtils.createMockCollaborator());
    
    mockPrismaClient.registryPurchase.create.mockResolvedValue(testUtils.createMockPurchase());
    mockPrismaClient.registryActivity.create.mockResolvedValue(testUtils.createMockActivity());
  },

  /**
   * Get mocked Prisma client
   */
  getMockPrismaClient: () => mockPrismaClient,
};

// Mock console methods for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  testUtils.resetMocks();
});

// Export test utilities
export { testUtils as default };