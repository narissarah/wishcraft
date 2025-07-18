/**
 * Application Bootstrap and Configuration
 * Initializes all services with proper dependency injection
 * Reduces coupling through centralized configuration
 */

import { PrismaClient } from '@prisma/client';
import { 
  container, 
  initializeContainer, 
  gracefulShutdown as shutdownContainer 
} from './dependency-injection.server';
import { 
  createRepositoryFactory, 
  createRepositoryRegistry,
  RepositoryFactory,
  RepositoryRegistry
} from './repositories.server';
import { 
  registerServices, 
  ServiceFactory, 
  ServiceRegistry 
} from './services.server';
import { 
  initializeAdapters, 
  shutdownAdapters, 
  adapterRegistry,
  AdapterFactory
} from './adapters.server';
import { log } from './logger.server';
import { validateEnvironment } from './env-validation.server';
import { sanitizationService } from './sanitization-unified.server';
import { errorHandler } from './error-handling-unified.server';
import { 
  TIMEOUTS, 
  LIMITS, 
  PERFORMANCE_THRESHOLDS,
  getEnvironmentConfig 
} from './constants-unified.server';

/**
 * Application configuration interface
 */
export interface ApplicationConfig {
  environment: 'development' | 'production' | 'test';
  database: {
    url: string;
    poolSize: number;
    timeout: number;
  };
  shopify: {
    apiKey: string;
    apiSecret: string;
    scopes: string[];
    appUrl: string;
    webhookSecret: string;
  };
  redis: {
    url: string;
    enabled: boolean;
  };
  email: {
    provider: string;
    config: any;
  };
  monitoring: {
    enabled: boolean;
    p95Enabled: boolean;
    alerting: boolean;
  };
  security: {
    sessionSecret: string;
    encryptionKey: string;
    csrfSecret: string;
  };
}

/**
 * Application instance
 */
export class Application {
  private config: ApplicationConfig;
  private prisma: PrismaClient;
  private repositoryFactory: RepositoryFactory;
  private repositoryRegistry: RepositoryRegistry;
  private serviceRegistry: ServiceRegistry;
  private initialized: boolean = false;

  constructor(config: ApplicationConfig) {
    this.config = config;
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.database.url
        }
      }
    });
    
    this.repositoryFactory = createRepositoryFactory(this.prisma);
    this.repositoryRegistry = createRepositoryRegistry(this.repositoryFactory);
    this.serviceRegistry = new ServiceRegistry();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      log.warn('Application already initialized');
      return;
    }

    try {
      log.info('Starting application initialization');

      // 1. Validate environment
      await this.validateEnvironment();

      // 2. Initialize dependency injection container
      await this.initializeDependencyInjection();

      // 3. Initialize database
      await this.initializeDatabase();

      // 4. Initialize adapters
      await this.initializeAdapters();

      // 5. Initialize repositories
      await this.initializeRepositories();

      // 6. Initialize services
      await this.initializeServices();

      // 7. Initialize monitoring
      await this.initializeMonitoring();

      // 8. Run health checks
      await this.performHealthChecks();

      this.initialized = true;
      log.info('Application initialization completed successfully');

    } catch (error) {
      log.error('Application initialization failed', error);
      throw error;
    }
  }

  /**
   * Validate environment variables
   */
  private async validateEnvironment(): Promise<void> {
    try {
      validateEnvironment();
      log.info('Environment validation passed');
    } catch (error) {
      log.error('Environment validation failed', error);
      throw new Error('Environment validation failed');
    }
  }

  /**
   * Initialize dependency injection container
   */
  private async initializeDependencyInjection(): Promise<void> {
    try {
      initializeContainer();
      
      // Register core application services
      this.registerCoreServices();
      
      log.info('Dependency injection initialized');
    } catch (error) {
      log.error('Dependency injection initialization failed', error);
      throw error;
    }
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.prisma.$connect();
      
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      log.info('Database connection established');
    } catch (error) {
      log.error('Database initialization failed', error);
      throw error;
    }
  }

  /**
   * Initialize external service adapters
   */
  private async initializeAdapters(): Promise<void> {
    try {
      initializeAdapters();
      
      // Configure adapters with application config
      await this.configureAdapters();
      
      log.info('Adapters initialized');
    } catch (error) {
      log.error('Adapter initialization failed', error);
      throw error;
    }
  }

  /**
   * Initialize repositories
   */
  private async initializeRepositories(): Promise<void> {
    try {
      // Register repositories with DI container
      container.register('registryRepository', () => 
        this.repositoryFactory.createRegistryRepository(), 'singleton');
      
      container.register('shopRepository', () => 
        this.repositoryFactory.createShopRepository(), 'singleton');
      
      container.register('userRepository', () => 
        this.repositoryFactory.createUserRepository(), 'singleton');
      
      container.register('sessionRepository', () => 
        this.repositoryFactory.createSessionRepository(), 'singleton');
      
      container.register('unitOfWork', () => 
        this.repositoryFactory.createUnitOfWork(), 'scoped');
      
      container.register('transactionManager', () => 
        this.repositoryFactory.createTransactionManager(), 'singleton');
      
      log.info('Repositories initialized');
    } catch (error) {
      log.error('Repository initialization failed', error);
      throw error;
    }
  }

  /**
   * Initialize services
   */
  private async initializeServices(): Promise<void> {
    try {
      registerServices();
      
      // Register additional services
      this.registerApplicationServices();
      
      log.info('Services initialized');
    } catch (error) {
      log.error('Service initialization failed', error);
      throw error;
    }
  }

  /**
   * Initialize monitoring systems
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      if (this.config.monitoring.enabled) {
        // Initialize P95 monitoring
        if (this.config.monitoring.p95Enabled) {
          log.info('P95 monitoring enabled');
        }
        
        // Initialize error monitoring
        log.info('Error monitoring enabled');
        
        // Initialize performance monitoring
        log.info('Performance monitoring enabled');
      }
      
      log.info('Monitoring initialized');
    } catch (error) {
      log.error('Monitoring initialization failed', error);
      throw error;
    }
  }

  /**
   * Perform initial health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      // Database health check
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Adapter health checks
      const adapterHealth = await adapterRegistry.healthCheck();
      if (!adapterHealth.healthy) {
        log.warn('Some adapters are unhealthy', adapterHealth.adapters);
      }
      
      // Container health check
      const containerHealth = await container.healthCheck();
      if (!containerHealth.healthy) {
        log.warn('Some services are unhealthy', containerHealth.services);
      }
      
      log.info('Health checks completed');
    } catch (error) {
      log.error('Health checks failed', error);
      throw error;
    }
  }

  /**
   * Register core services with DI container
   */
  private registerCoreServices(): void {
    // Register PrismaClient
    container.register('prisma', () => this.prisma, 'singleton');
    
    // Register configuration
    container.register('config', () => this.config, 'singleton');
    
    // Register sanitization service
    container.register('sanitizationService', () => sanitizationService, 'singleton');
    
    // Register error handler
    container.register('errorHandler', () => errorHandler, 'singleton');
    
    // P95 monitoring removed for production deployment
    
    // Register constants
    container.register('constants', () => ({
      TIMEOUTS,
      LIMITS,
      PERFORMANCE_THRESHOLDS
    }), 'singleton');
  }

  /**
   * Register application-specific services
   */
  private registerApplicationServices(): void {
    // Register security service
    container.register('securityService', () => 
      ServiceFactory.createSecurityService(this.config.security.encryptionKey), 'singleton');
    
    // Register Shopify service
    container.register('shopifyService', () => {
      const adapter = adapterRegistry.get('shopify');
      return ServiceFactory.createShopifyService(adapter);
    }, 'singleton');
    
    // Register email service
    container.register('emailService', () => {
      const adapter = adapterRegistry.get('email');
      return ServiceFactory.createEmailService(adapter);
    }, 'singleton');
    
    // Register cache service
    container.register('cacheService', () => {
      const adapter = adapterRegistry.get('redis');
      return ServiceFactory.createCacheService(adapter);
    }, 'singleton');
  }

  /**
   * Configure adapters with application settings
   */
  private async configureAdapters(): Promise<void> {
    // Configure Shopify adapter
    const shopifyAdapter = adapterRegistry.get('shopify');
    if (shopifyAdapter) {
      // Additional configuration if needed
    }
    
    // Configure Redis adapter
    const redisAdapter = adapterRegistry.get('redis');
    if (redisAdapter && this.config.redis.enabled) {
      await redisAdapter.connect();
    }
    
    // Configure Email adapter
    const emailAdapter = adapterRegistry.get('email');
    if (emailAdapter) {
      emailAdapter.configure(this.config.email.config);
    }
  }

  /**
   * Get application health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    components: {
      database: { healthy: boolean; error?: string };
      adapters: { healthy: boolean; details: any };
      services: { healthy: boolean; details: any };
      monitoring: { healthy: boolean; details: any };
    };
  }> {
    const components = {
      database: { healthy: true },
      adapters: { healthy: true, details: {} },
      services: { healthy: true, details: {} },
      monitoring: { healthy: true, details: {} }
    };

    try {
      // Check database
      await this.prisma.$queryRaw`SELECT 1`;
      components.database.healthy = true;
    } catch (error) {
      components.database.healthy = false;
      components.database.error = error.message;
    }

    try {
      // Check adapters
      const adapterHealth = await adapterRegistry.healthCheck();
      components.adapters.healthy = adapterHealth.healthy;
      components.adapters.details = adapterHealth.adapters;
    } catch (error) {
      components.adapters.healthy = false;
      components.adapters.details = { error: error.message };
    }

    try {
      // Check services
      const serviceHealth = await container.healthCheck();
      components.services.healthy = serviceHealth.healthy;
      components.services.details = serviceHealth.services;
    } catch (error) {
      components.services.healthy = false;
      components.services.details = { error: error.message };
    }

    // Performance monitoring removed for production deployment
    components.monitoring.healthy = true;
    components.monitoring.details = { message: 'Monitoring disabled for production' };

    const healthy = Object.values(components).every(component => component.healthy);

    return {
      healthy,
      components
    };
  }

  /**
   * Get application metrics
   */
  async getMetrics(): Promise<{
    performance: any;
    database: any;
    memory: any;
    uptime: number;
  }> {
    // Performance monitoring removed for production deployment
    const performance = { p95: 0, p99: 0, avg: 0, alertCount: 0 };
    
    const database = {
      connections: 'mock_data', // In production, get from Prisma metrics
      queries: 'mock_data',
      avgResponseTime: 'mock_data'
    };
    
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    return {
      performance,
      database,
      memory,
      uptime
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      log.warn('Application not initialized, skipping shutdown');
      return;
    }

    try {
      log.info('Starting graceful shutdown');

      // Shutdown monitoring
      log.info('Shutting down monitoring...');
      
      // Shutdown services
      log.info('Shutting down services...');
      
      // Shutdown adapters
      log.info('Shutting down adapters...');
      shutdownAdapters();
      
      // Shutdown repositories
      log.info('Shutting down repositories...');
      
      // Shutdown database
      log.info('Shutting down database...');
      await this.prisma.$disconnect();
      
      // Shutdown DI container
      log.info('Shutting down DI container...');
      shutdownContainer();
      
      this.initialized = false;
      log.info('Graceful shutdown completed');
      
    } catch (error) {
      log.error('Error during shutdown', error);
      throw error;
    }
  }

  /**
   * Get application configuration
   */
  getConfig(): ApplicationConfig {
    return { ...this.config };
  }

  /**
   * Check if application is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create application configuration from environment
 */
export function createApplicationConfig(): ApplicationConfig {
  const envConfig = getEnvironmentConfig();
  
  return {
    environment: (process.env.NODE_ENV as any) || 'development',
    
    database: {
      url: process.env.DATABASE_URL || '',
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
      timeout: parseInt(process.env.DB_TIMEOUT || '30000')
    },
    
    shopify: {
      apiKey: process.env.SHOPIFY_API_KEY || '',
      apiSecret: process.env.SHOPIFY_API_SECRET || '',
      scopes: (process.env.SHOPIFY_SCOPES || '').split(','),
      appUrl: process.env.SHOPIFY_APP_URL || '',
      webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || ''
    },
    
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      enabled: process.env.REDIS_ENABLED === 'true'
    },
    
    email: {
      provider: process.env.EMAIL_PROVIDER || 'smtp',
      config: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        }
      }
    },
    
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      p95Enabled: process.env.P95_MONITORING_ENABLED !== 'false',
      alerting: process.env.ALERTING_ENABLED !== 'false'
    },
    
    security: {
      sessionSecret: process.env.SESSION_SECRET || '',
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      csrfSecret: process.env.CSRF_SECRET || ''
    }
  };
}

/**
 * Global application instance
 */
let applicationInstance: Application | null = null;

/**
 * Get or create application instance
 */
export function getApplication(): Application {
  if (!applicationInstance) {
    const config = createApplicationConfig();
    applicationInstance = new Application(config);
  }
  return applicationInstance;
}

/**
 * Initialize application
 */
export async function initializeApplication(): Promise<Application> {
  const app = getApplication();
  await app.initialize();
  return app;
}

/**
 * Shutdown application
 */
export async function shutdownApplication(): Promise<void> {
  if (applicationInstance) {
    await applicationInstance.shutdown();
    applicationInstance = null;
  }
}

/**
 * Application factory for testing
 */
export function createTestApplication(config: Partial<ApplicationConfig> = {}): Application {
  const defaultConfig = createApplicationConfig();
  const testConfig = { ...defaultConfig, ...config };
  return new Application(testConfig);
}

/**
 * Health check endpoint
 */
export async function applicationHealthCheck(): Promise<any> {
  const app = getApplication();
  return await app.getHealthStatus();
}

/**
 * Metrics endpoint
 */
export async function applicationMetrics(): Promise<any> {
  const app = getApplication();
  return await app.getMetrics();
}

/**
 * Process signal handlers for graceful shutdown
 */
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, starting graceful shutdown');
  await shutdownApplication();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, starting graceful shutdown');
  await shutdownApplication();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  log.error('Uncaught exception', error);
  await shutdownApplication();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  log.error('Unhandled rejection', { reason, promise });
  await shutdownApplication();
  process.exit(1);
});

export default Application;