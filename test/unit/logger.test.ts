import { describe, it, expect, beforeEach, vi } from 'vitest';
import { log } from '~/lib/logger.server';

/**
 * Unit tests for Logger
 * Tests the Winston logging implementation
 */

describe('Logger', () => {
  beforeEach(() => {
    // Clear any previous console mocks
    vi.clearAllMocks();
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      log.info('Test info message', { extra: 'data' });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages with stack trace', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      
      log.error('Error occurred', error);
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      log.warn('Warning message');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log debug messages in development', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      log.debug('Debug info', { debugData: true });
      
      // Debug logs only show in development
      if (process.env.NODE_ENV === 'development') {
        expect(consoleSpy).toHaveBeenCalled();
      }
    });
  });

  describe('structured logging', () => {
    it('should include metadata in logs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      log.info('User action', {
        userId: '123',
        action: 'login',
        timestamp: new Date().toISOString()
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle webhook logs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      log.webhook('APP_UNINSTALLED', 'test-shop.myshopify.com', {
        reason: 'User uninstalled'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle security logs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      log.security('Unauthorized access attempt', {
        ip: '192.168.1.1',
        endpoint: '/api/admin',
        method: 'POST'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle circular references in metadata', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const circular: any = { a: 1 };
      circular.self = circular;
      
      expect(() => {
        log.info('Circular reference test', circular);
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle null and undefined values', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      log.info('Null test', null as any);
      log.info('Undefined test', undefined as any);
      
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance logging', () => {
    it('should measure performance', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      log.performance('Database query', {
        duration: 150,
        query: 'SELECT * FROM registries',
        rows: 10
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});