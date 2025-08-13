import { log } from "~/lib/logger.server";

interface LighthouseResult {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

/**
 * Performance testing utility for Built for Shopify compliance
 * Ensures app doesn't reduce Lighthouse score by more than 10 points
 */
export class PerformanceTester {
  private baselineScores: Map<string, LighthouseResult> = new Map();

  /**
   * Capture baseline Lighthouse scores before app installation
   */
  async captureBaseline(storeUrl: string, pages: string[] = ['/', '/products/*', '/collections/*']) {
    const results: Record<string, LighthouseResult> = {};
    
    for (const page of pages) {
      try {
        // In production, this would call Lighthouse CI API or PageSpeed Insights API
        const score = await this.runLighthouse(storeUrl + page);
        results[page] = score;
        this.baselineScores.set(`${storeUrl}${page}`, score);
      } catch (error) {
        log.error('Failed to capture baseline score', { page, error });
      }
    }
    
    return results;
  }

  /**
   * Compare current scores with baseline
   */
  async compareWithBaseline(storeUrl: string, pages: string[] = ['/', '/products/*', '/collections/*']) {
    const results = [];
    
    for (const page of pages) {
      const baselineScore = this.baselineScores.get(`${storeUrl}${page}`);
      if (!baselineScore) {
        log.warn('No baseline score found', { page });
        continue;
      }
      
      try {
        const currentScore = await this.runLighthouse(storeUrl + page);
        const performanceDiff = baselineScore.performance - currentScore.performance;
        
        results.push({
          page,
          baseline: baselineScore,
          current: currentScore,
          performanceDiff,
          passed: performanceDiff <= 10, // Built for Shopify requirement
          details: {
            performance: `${baselineScore.performance} → ${currentScore.performance} (${performanceDiff > 0 ? '-' : '+'}${Math.abs(performanceDiff)})`,
            accessibility: `${baselineScore.accessibility} → ${currentScore.accessibility}`,
            bestPractices: `${baselineScore.bestPractices} → ${currentScore.bestPractices}`,
            seo: `${baselineScore.seo} → ${currentScore.seo}`,
          }
        });
        
        if (performanceDiff > 10) {
          log.error('Performance degradation exceeds Built for Shopify limit', {
            page,
            performanceDiff,
            limit: 10
          });
        }
      } catch (error) {
        log.error('Failed to run performance comparison', { page, error });
      }
    }
    
    return results;
  }

  /**
   * Mock Lighthouse runner - in production, integrate with Lighthouse CI or PageSpeed Insights
   */
  private async runLighthouse(url: string): Promise<LighthouseResult> {
    // This is a placeholder - in production, you would:
    // 1. Use Google PageSpeed Insights API
    // 2. Or run Lighthouse CI in your deployment pipeline
    // 3. Or use Shopify's Web Performance API when available
    
    log.info('Running Lighthouse test', { url });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock scores for development
    return {
      performance: 85 + Math.floor(Math.random() * 10),
      accessibility: 90 + Math.floor(Math.random() * 10),
      bestPractices: 85 + Math.floor(Math.random() * 10),
      seo: 90 + Math.floor(Math.random() * 10),
    };
  }
}

/**
 * Performance monitoring middleware
 */
export function trackPerformanceImpact(shopDomain: string) {
  return async (request: Request) => {
    const start = Date.now();
    
    // Track request timing
    request.headers.set('X-Request-Start', start.toString());
    
    // Log performance metrics after response
    const duration = Date.now() - start;
    if (duration > 1000) { // Log slow requests
      log.warn('Slow request detected', {
        shop: shopDomain,
        path: new URL(request.url).pathname,
        duration,
      });
    }
  };
}