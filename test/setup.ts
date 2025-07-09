import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, beforeAll, afterAll, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock global fetch for all tests
global.fetch = vi.fn();

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

// Mock environment variables
beforeEach(() => {
  vi.stubEnv("SHOPIFY_API_KEY", "test_api_key");
  vi.stubEnv("SHOPIFY_API_SECRET", "test_api_secret");
  vi.stubEnv("SHOPIFY_APP_URL", "https://test-app.example.com");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db");
  vi.stubEnv("SHOPIFY_TESTING", "true");
});