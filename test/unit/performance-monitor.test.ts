import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  trackCoreWebVital,
  checkPerformanceBudget,
  getPerformanceReport
} from '~/lib/built-for-shopify-monitor.server';

describe('Performance Monitoring Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackCoreWebVital', () => {
    it('should track LCP within threshold', async () => {
      const metric = {
        name: 'LCP',
        value: 1500, // 1.5s
        rating: 'good' as const,
        delta: 100,
        id: 'lcp-123',
        navigationType: 'navigate' as const,
        entries: []
      };

      const result = await trackCoreWebVital(metric);
      
      expect(result.pass).toBe(true);
      expect(result.value).toBe(1500);
      expect(result.threshold).toBe(2500);
    });

    it('should fail when CLS exceeds threshold', async () => {
      const metric = {
        name: 'CLS',
        value: 0.15, // Above 0.1 threshold
        rating: 'poor' as const,
        delta: 0.05,
        id: 'cls-456',
        navigationType: 'navigate' as const,
        entries: []
      };

      const result = await trackCoreWebVital(metric);
      
      expect(result.pass).toBe(false);
      expect(result.value).toBe(0.15);
      expect(result.threshold).toBe(0.1);
    });

    it('should track INP (replacing FID)', async () => {
      const metric = {
        name: 'INP',
        value: 150, // 150ms
        rating: 'good' as const,
        delta: 10,
        id: 'inp-789',
        navigationType: 'navigate' as const,
        entries: []
      };

      const result = await trackCoreWebVital(metric);
      
      expect(result.pass).toBe(true);
      expect(result.value).toBe(150);
      expect(result.threshold).toBe(200);
    });
  });

  describe('checkPerformanceBudget', () => {
    it('should pass when all metrics are within budget', async () => {
      const metrics = {
        lcp: 2000,
        cls: 0.05,
        inp: 180,
        ttfb: 500
      };

      const result = await checkPerformanceBudget(metrics);
      
      expect(result.pass).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when metrics exceed budget', async () => {
      const metrics = {
        lcp: 3000, // Over 2500ms
        cls: 0.2, // Over 0.1
        inp: 250, // Over 200ms
        ttfb: 1000 // Over 800ms
      };

      const result = await checkPerformanceBudget(metrics);
      
      expect(result.pass).toBe(false);
      expect(result.failures).toHaveLength(4);
      expect(result.failures).toContain('LCP');
      expect(result.failures).toContain('CLS');
      expect(result.failures).toContain('INP');
      expect(result.failures).toContain('TTFB');
    });
  });

  describe('getPerformanceReport', () => {
    it('should generate comprehensive performance report', async () => {
      const report = await getPerformanceReport('2025-01-01', '2025-01-07');
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('recommendations');
      expect(report.metrics).toHaveProperty('lcp');
      expect(report.metrics).toHaveProperty('cls');
      expect(report.metrics).toHaveProperty('inp');
    });
  });
});