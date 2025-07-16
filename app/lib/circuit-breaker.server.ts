/**
 * Circuit Breaker Implementation for Built for Shopify 2025 Compliance
 * 
 * Implements the circuit breaker pattern with:
 * - Failure threshold detection
 * - Automatic recovery
 * - Half-open state testing
 * - Configurable timeouts
 * - Metrics collection
 */

import { log } from "~/lib/logger.server";
import { performance } from "perf_hooks";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN"
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  requestTimeout: number;
  volumeThreshold: number;
  errorThresholdPercentage: number;
  enableMetrics?: boolean;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  state: CircuitState;
  stateChanges: Array<{
    from: CircuitState;
    to: CircuitState;
    timestamp: Date;
    reason: string;
  }>;
}

export class CircuitBreaker<T = any> {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttempt?: Date;
  private metrics: CircuitBreakerMetrics;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;
  private halfOpenRequests = 0;
  private readonly maxHalfOpenRequests = 3;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || "5"),
      resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || "60000"),
      requestTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || "30000"),
      volumeThreshold: 10,
      errorThresholdPercentage: 50,
      enableMetrics: process.env.ENABLE_PERFORMANCE_MONITORING === "true",
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      averageResponseTime: 0,
      state: this.state,
      stateChanges: []
    };
  }

  async execute<R = T>(
    request: () => Promise<R>,
    fallback?: () => Promise<R> | R
  ): Promise<R> {
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        return this.handleOpenState(fallback);
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenRequests >= this.maxHalfOpenRequests) {
      return this.handleOpenState(fallback);
    }

    const startTime = performance.now();
    
    try {
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests++;
      }

      const result = await this.executeWithTimeout(request);
      this.onSuccess(performance.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error as Error, performance.now() - startTime);
      
      if (fallback) {
        log.info(`Circuit breaker ${this.name} using fallback`, {
          state: this.state,
          error: (error as Error).message
        });
        return typeof fallback === "function" ? await fallback() : fallback;
      }
      
      throw error;
    } finally {
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests--;
      }
    }
  }

  private async executeWithTimeout<R>(request: () => Promise<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Circuit breaker ${this.name} timeout after ${this.config.requestTimeout}ms`));
      }, this.config.requestTimeout);

      request()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private onSuccess(responseTime: number): void {
    this.successCount++;
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessTime = new Date();
    this.updateAverageResponseTime(responseTime);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.volumeThreshold / 2) {
        this.transitionToClosed();
      }
    }
  }

  private onFailure(error: Error, responseTime: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = this.lastFailureTime;
    this.updateAverageResponseTime(responseTime);

    log.error(`Circuit breaker ${this.name} failure`, {
      error: error.message,
      failureCount: this.failureCount,
      state: this.state
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen("Failed in half-open state");
    } else if (this.shouldTrip()) {
      this.transitionToOpen("Failure threshold exceeded");
    }
  }

  private shouldTrip(): boolean {
    const totalRequests = this.successCount + this.failureCount;
    
    if (totalRequests < this.config.volumeThreshold) {
      return false;
    }

    const errorPercentage = (this.failureCount / totalRequests) * 100;
    return errorPercentage >= this.config.errorThresholdPercentage ||
           this.failureCount >= this.config.failureThreshold;
  }

  private canAttemptReset(): boolean {
    return this.nextAttempt && new Date() >= this.nextAttempt;
  }

  private transitionToOpen(reason: string): void {
    const previousState = this.state;
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
    
    this.recordStateChange(previousState, CircuitState.OPEN, reason);
    
    log.warn(`Circuit breaker ${this.name} opened`, {
      reason,
      nextAttempt: this.nextAttempt,
      failureCount: this.failureCount
    });
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenRequests = 0;
    this.successCount = 0;
    this.failureCount = 0;
    
    this.recordStateChange(previousState, CircuitState.HALF_OPEN, "Testing recovery");
    
    log.info(`Circuit breaker ${this.name} half-open`, {
      previousFailures: this.metrics.failedRequests
    });
  }

  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = undefined;
    
    this.recordStateChange(previousState, CircuitState.CLOSED, "Recovered successfully");
    
    log.info(`Circuit breaker ${this.name} closed`, {
      totalRequests: this.metrics.totalRequests
    });
  }

  private handleOpenState<R>(fallback?: () => Promise<R> | R): Promise<R> {
    this.metrics.rejectedRequests++;
    
    if (fallback) {
      log.info(`Circuit breaker ${this.name} open, using fallback`);
      return Promise.resolve(typeof fallback === "function" ? fallback() : fallback);
    }
    
    return Promise.reject(
      new Error(`Circuit breaker ${this.name} is OPEN. Service unavailable.`)
    );
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
  }

  private recordStateChange(from: CircuitState, to: CircuitState, reason: string): void {
    this.metrics.state = to;
    this.metrics.stateChanges.push({
      from,
      to,
      timestamp: new Date(),
      reason
    });

    // Keep only last 100 state changes
    if (this.metrics.stateChanges.length > 100) {
      this.metrics.stateChanges = this.metrics.stateChanges.slice(-100);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttempt = undefined;
    this.halfOpenRequests = 0;
    
    log.info(`Circuit breaker ${this.name} manually reset`);
  }

  forceOpen(): void {
    this.transitionToOpen("Manually forced open");
  }

  forceClosed(): void {
    this.transitionToClosed();
  }
}

// Circuit breaker registry for global access
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, config));
  }
  return circuitBreakers.get(name)!;
}

export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return new Map(circuitBreakers);
}

export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach(cb => cb.reset());
  log.info("All circuit breakers reset");
}

// Retry mechanism with exponential backoff and jitter
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  jitter: boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const defaults: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    jitter: true
  };

  const options = { ...defaults, ...config };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === options.maxAttempts) {
        throw lastError;
      }

      let delay = Math.min(
        options.initialDelay * Math.pow(options.factor, attempt - 1),
        options.maxDelay
      );

      if (options.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      log.debug(`Retry attempt ${attempt}/${options.maxAttempts} after ${delay}ms`, {
        error: lastError.message
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Health check for circuit breakers
export interface CircuitBreakerHealth {
  healthy: boolean;
  breakers: Array<{
    name: string;
    state: CircuitState;
    metrics: CircuitBreakerMetrics;
    healthy: boolean;
  }>;
}

export function getCircuitBreakerHealth(): CircuitBreakerHealth {
  const breakers = Array.from(circuitBreakers.entries()).map(([name, breaker]) => {
    const metrics = breaker.getMetrics();
    const healthy = breaker.getState() !== CircuitState.OPEN;
    
    return {
      name,
      state: breaker.getState(),
      metrics,
      healthy
    };
  });

  const allHealthy = breakers.every(b => b.healthy);

  return {
    healthy: allHealthy,
    breakers
  };
}