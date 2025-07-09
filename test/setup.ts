import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, beforeAll, afterAll, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock global fetch for all tests
global.fetch = vi.fn();

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
})) as any;

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  vi.clearAllMocks();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Shopify App Bridge
vi.mock("@shopify/app-bridge-react", () => ({
  NavMenu: ({ children }: { children: React.ReactNode }) => children,
  useAppBridge: () => ({
    dispatch: vi.fn(),
  }),
}));

// Mock Shopify Polaris
vi.mock("@shopify/polaris", () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  Layout: ({ children }: { children: React.ReactNode }) => children,
  Card: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  Button: ({ children }: { children: React.ReactNode }) => children,
  BlockStack: ({ children }: { children: React.ReactNode }) => children,
  InlineStack: ({ children }: { children: React.ReactNode }) => children,
  Badge: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn(),
    registry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    registryItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  })),
}));

// Mock Shopify Remix server
vi.mock('@shopify/shopify-app-remix/server', () => ({
  shopifyApp: vi.fn(() => ({
    authenticate: {
      admin: vi.fn().mockResolvedValue({
        session: { shop: 'test-shop.myshopify.com', accessToken: 'test-token' },
        admin: {
          graphql: vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({
              data: {},
              errors: undefined,
            }),
          }),
        },
      }),
      public: vi.fn(),
      webhook: vi.fn(),
    },
    sessionStorage: {
      findSessionsByShop: vi.fn().mockResolvedValue([]),
    },
    config: {
      auth: {
        callbackPath: '/auth/callback',
        sessionCookieName: 'shopify_app_session',
      },
      webhooks: {
        APP_UNINSTALLED: {
          deliveryMethod: 'http',
          callbackUrl: '/webhooks',
        },
      },
    },
  })),
  unauthenticated: {
    admin: vi.fn().mockResolvedValue({
      graphql: vi.fn(),
    }),
  },
  AppDistribution: {
    AppStore: 'AppStore',
  },
  DeliveryMethod: {
    Http: 'http',
  },
  BillingInterval: {
    Monthly: 'MONTHLY',
  },
  ApiVersion: {
    October25: '2025-10',
  },
  LATEST_API_VERSION: '2025-07',
}));

// Mock environment variables
beforeEach(() => {
  vi.stubEnv("SHOPIFY_API_KEY", "test_api_key");
  vi.stubEnv("SHOPIFY_API_SECRET", "test_api_secret");
  vi.stubEnv("SHOPIFY_APP_URL", "https://test-app.example.com");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db");
  vi.stubEnv("SHOPIFY_TESTING", "true");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SESSION_SECRET", "test_session_secret");
});