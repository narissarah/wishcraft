/**
 * Dependency Injection Container
 * Reduces architectural coupling by providing centralized service management
 * Implements IoC (Inversion of Control) pattern for better testability and modularity
 */

import { PrismaClient } from '@prisma/client';
import { log } from './logger.server';
import { errorHandler } from './error-handling-unified.server';
import { sanitizationService } from './sanitization-unified.server';

export type ServiceType = 'singleton' | 'transient' | 'scoped';

export interface ServiceDefinition<T = any> {
  factory: (container: DIContainer) => T;
  type: ServiceType;
  dependencies?: string[];
}

export interface ServiceMetadata {
  name: string;
  type: ServiceType;
  created: Date;
  dependencies: string[];
  isHealthy: boolean;
}

/**
 * Dependency Injection Container
 * Manages service lifecycle and dependencies
 */
export class DIContainer {
  private services = new Map<string, ServiceDefinition>();
  private instances = new Map<string, any>();
  private scopedInstances = new Map<string, any>();
  private initializing = new Set<string>();
  private metadata = new Map<string, ServiceMetadata>();

  /**
   * Register a service with the container
   */
  register<T>(
    name: string,
    factory: (container: DIContainer) => T,
    type: ServiceType = 'singleton',
    dependencies: string[] = []
  ): void {
    if (this.services.has(name)) {
      log.warn(`Service ${name} is already registered, overwriting`);
    }

    this.services.set(name, {
      factory,
      type,
      dependencies
    });

    this.metadata.set(name, {
      name,
      type,
      created: new Date(),
      dependencies,
      isHealthy: true
    });

    log.debug(`Registered service: ${name} (${type})`);
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(name: string): T {
    const serviceDefinition = this.services.get(name);
    if (!serviceDefinition) {
      throw new Error(`Service ${name} not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }

    // Check for circular dependencies
    if (this.initializing.has(name)) {
      throw new Error(`Circular dependency detected for service: ${name}`);
    }

    try {
      switch (serviceDefinition.type) {
        case 'singleton':
          return this.resolveSingleton(name, serviceDefinition);
        case 'transient':
          return this.resolveTransient(name, serviceDefinition);
        case 'scoped':
          return this.resolveScoped(name, serviceDefinition);
        default:
          throw new Error(`Unknown service type: ${serviceDefinition.type}`);
      }
    } catch (error) {
      this.updateServiceHealth(name, false);
      log.error(`Failed to resolve service ${name}`, error);
      throw error;
    }
  }

  /**
   * Resolve singleton service
   */
  private resolveSingleton<T>(name: string, definition: ServiceDefinition<T>): T {
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    this.initializing.add(name);
    try {
      const instance = definition.factory(this);
      this.instances.set(name, instance);
      this.updateServiceHealth(name, true);
      log.debug(`Created singleton instance: ${name}`);
      return instance;
    } finally {
      this.initializing.delete(name);
    }
  }

  /**
   * Resolve transient service
   */
  private resolveTransient<T>(name: string, definition: ServiceDefinition<T>): T {
    this.initializing.add(name);
    try {
      const instance = definition.factory(this);
      this.updateServiceHealth(name, true);
      log.debug(`Created transient instance: ${name}`);
      return instance;
    } finally {
      this.initializing.delete(name);
    }
  }

  /**
   * Resolve scoped service
   */
  private resolveScoped<T>(name: string, definition: ServiceDefinition<T>): T {
    if (this.scopedInstances.has(name)) {
      return this.scopedInstances.get(name);
    }

    this.initializing.add(name);
    try {
      const instance = definition.factory(this);
      this.scopedInstances.set(name, instance);
      this.updateServiceHealth(name, true);
      log.debug(`Created scoped instance: ${name}`);
      return instance;
    } finally {
      this.initializing.delete(name);
    }
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service metadata
   */
  getServiceMetadata(name: string): ServiceMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * Get all services metadata
   */
  getAllServicesMetadata(): ServiceMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Clear scoped instances
   */
  clearScope(): void {
    this.scopedInstances.clear();
    log.debug('Cleared scoped instances');
  }

  /**
   * Dispose of all services
   */
  dispose(): void {
    // Call dispose method on services that have it
    for (const [name, instance] of this.instances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
          log.debug(`Disposed service: ${name}`);
        } catch (error) {
          log.error(`Failed to dispose service ${name}`, error);
        }
      }
    }

    this.instances.clear();
    this.scopedInstances.clear();
    this.initializing.clear();
    log.info('Container disposed');
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Array<{
      name: string;
      healthy: boolean;
      error?: string;
    }>;
  }> {
    const serviceResults = [];
    let allHealthy = true;

    for (const [name, definition] of this.services) {
      try {
        const instance = this.resolve(name);
        
        // Check if service has health check method
        if (instance && typeof instance.healthCheck === 'function') {
          const result = await instance.healthCheck();
          serviceResults.push({
            name,
            healthy: result.healthy || true,
            error: result.error
          });
          
          if (!result.healthy) {
            allHealthy = false;
          }
        } else {
          serviceResults.push({
            name,
            healthy: true
          });
        }
      } catch (error) {
        serviceResults.push({
          name,
          healthy: false,
          error: error.message
        });
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      services: serviceResults
    };
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(name: string, isHealthy: boolean): void {
    const metadata = this.metadata.get(name);
    if (metadata) {
      metadata.isHealthy = isHealthy;
    }
  }

  /**
   * Validate service dependencies
   */
  validateDependencies(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const [name, definition] of this.services) {
      for (const dependency of definition.dependencies || []) {
        if (!this.services.has(dependency)) {
          errors.push(`Service ${name} depends on ${dependency} which is not registered`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    
    for (const [name, definition] of this.services) {
      graph[name] = definition.dependencies || [];
    }
    
    return graph;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const cycles: string[] = [];

    const visit = (name: string, path: string[] = []) => {
      if (visiting.has(name)) {
        cycles.push(`Circular dependency: ${path.join(' -> ')} -> ${name}`);
        return;
      }
      
      if (visited.has(name)) {
        return;
      }

      visiting.add(name);
      
      const definition = this.services.get(name);
      if (definition) {
        for (const dependency of definition.dependencies || []) {
          visit(dependency, [...path, name]);
        }
      }

      visiting.delete(name);
      visited.add(name);
    };

    for (const name of this.services.keys()) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    return cycles;
  }
}

/**
 * Service interfaces for type safety
 */
export interface IDatabaseService {
  client: PrismaClient;
  healthCheck(): Promise<{ healthy: boolean; error?: string }>;
  dispose(): void;
}

export interface ILoggerService {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface IErrorHandlerService {
  handleError(error: any, context?: any): any;
  createErrorResponse(error: any, context?: any): Response;
}

export interface ISanitizationService {
  sanitizeText(text: string, options?: any): string;
  sanitizeHtml(html: string, options?: any): string;
  sanitizeInput(input: string, options?: any): string;
}

export interface IPerformanceMonitoringService {
  recordMetrics(metrics: any): Promise<void>;
  generateP95Report(shopId?: string): Promise<any[]>;
  healthCheck(): Promise<{ healthy: boolean; error?: string }>;
}

/**
 * Database service implementation
 */
class DatabaseService implements IDatabaseService {
  public client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.client.$connect();
      await this.client.$queryRaw`SELECT 1`;
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message 
      };
    }
  }

  dispose(): void {
    this.client.$disconnect();
  }
}

/**
 * Logger service wrapper
 */
class LoggerService implements ILoggerService {
  info(message: string, meta?: any): void {
    log.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    log.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    log.error(message, meta);
  }

  debug(message: string, meta?: any): void {
    log.debug(message, meta);
  }
}

/**
 * Error handler service wrapper
 */
class ErrorHandlerService implements IErrorHandlerService {
  handleError(error: any, context?: any): any {
    return errorHandler.handleError(error, context);
  }

  createErrorResponse(error: any, context?: any): Response {
    return errorHandler.createErrorResponse(error, context);
  }
}

/**
 * Sanitization service wrapper
 */
class SanitizationServiceWrapper implements ISanitizationService {
  sanitizeText(text: string, options?: any): string {
    return sanitizationService.sanitizeText(text, options);
  }

  sanitizeHtml(html: string, options?: any): string {
    return sanitizationService.sanitizeHtml(html, options);
  }

  sanitizeInput(input: string, options?: any): string {
    return sanitizationService.sanitizeInput(input, options);
  }
}

/**
 * Performance monitoring service wrapper
 * Stub implementation - performance monitoring removed for production deployment
 */
class PerformanceMonitoringService implements IPerformanceMonitoringService {
  async recordMetrics(metrics: any): Promise<void> {
    // Performance monitoring removed - no-op
  }

  async generateP95Report(shopId?: string): Promise<any[]> {
    // Performance monitoring removed - return empty report
    return [];
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    // Performance monitoring removed - always healthy
    return { 
      healthy: true
    };
  }
}

/**
 * Global container instance
 */
export const container = new DIContainer();

/**
 * Register core services
 */
export function registerCoreServices(): void {
  // Register database service
  container.register<IDatabaseService>(
    'database',
    () => new DatabaseService(),
    'singleton'
  );

  // Register logger service
  container.register<ILoggerService>(
    'logger',
    () => new LoggerService(),
    'singleton'
  );

  // Register error handler service
  container.register<IErrorHandlerService>(
    'errorHandler',
    () => new ErrorHandlerService(),
    'singleton'
  );

  // Register sanitization service
  container.register<ISanitizationService>(
    'sanitization',
    () => new SanitizationServiceWrapper(),
    'singleton'
  );

  // Register performance monitoring service
  container.register<IPerformanceMonitoringService>(
    'performanceMonitoring',
    () => new PerformanceMonitoringService(),
    'singleton'
  );

  log.info('Core services registered in DI container');
}

/**
 * Initialize the container with core services
 */
export function initializeContainer(): void {
  registerCoreServices();
  
  // Validate dependencies
  const validation = container.validateDependencies();
  if (!validation.valid) {
    log.error('Container validation failed', { errors: validation.errors });
    throw new Error(`Container validation failed: ${validation.errors.join(', ')}`);
  }

  // Check for circular dependencies
  const cycles = container.detectCircularDependencies();
  if (cycles.length > 0) {
    log.error('Circular dependencies detected', { cycles });
    throw new Error(`Circular dependencies detected: ${cycles.join(', ')}`);
  }

  log.info('DI container initialized successfully');
}

/**
 * Service locator pattern for easy access
 */
export const Services = {
  get database(): IDatabaseService {
    return container.resolve<IDatabaseService>('database');
  },

  get logger(): ILoggerService {
    return container.resolve<ILoggerService>('logger');
  },

  get errorHandler(): IErrorHandlerService {
    return container.resolve<IErrorHandlerService>('errorHandler');
  },

  get sanitization(): ISanitizationService {
    return container.resolve<ISanitizationService>('sanitization');
  },

  get performanceMonitoring(): IPerformanceMonitoringService {
    return container.resolve<IPerformanceMonitoringService>('performanceMonitoring');
  }
};

/**
 * Decorator for automatic dependency injection
 */
export function Injectable(serviceName: string) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        
        // Auto-inject dependencies based on service name
        if (container.has(serviceName)) {
          const service = container.resolve(serviceName);
          Object.assign(this, service);
        }
      }
    };
  };
}

/**
 * Middleware for request-scoped services
 */
export function createScopedMiddleware() {
  return (req: any, res: any, next: any) => {
    // Create new scope for each request
    container.clearScope();
    
    // Add cleanup on response finish
    res.on('finish', () => {
      container.clearScope();
    });
    
    next();
  };
}

/**
 * Health check endpoint for container
 */
export async function containerHealthCheck(): Promise<{
  healthy: boolean;
  services: Array<{
    name: string;
    healthy: boolean;
    error?: string;
  }>;
  metadata: {
    totalServices: number;
    healthyServices: number;
    validationErrors: string[];
    circularDependencies: string[];
  };
}> {
  const healthCheck = await container.healthCheck();
  const validation = container.validateDependencies();
  const cycles = container.detectCircularDependencies();
  
  return {
    ...healthCheck,
    metadata: {
      totalServices: container.getServiceNames().length,
      healthyServices: healthCheck.services.filter(s => s.healthy).length,
      validationErrors: validation.errors,
      circularDependencies: cycles
    }
  };
}

/**
 * Graceful shutdown handler
 */
export function gracefulShutdown(): void {
  log.info('Shutting down DI container...');
  container.dispose();
  log.info('DI container shutdown complete');
}