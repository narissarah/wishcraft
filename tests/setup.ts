import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock environment variables
process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-api-secret';
process.env.SHOPIFY_APP_URL = 'https://test-app.com';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = 'test-session-secret';

// Mock Shopify App Bridge
jest.mock('@shopify/app-bridge-react', () => ({
  Provider: ({ children }: any) => children,
  useAppBridge: () => ({
    dispatch: jest.fn(),
  }),
}));

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
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
  })),
}));

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
});