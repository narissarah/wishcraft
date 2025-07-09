import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { PrismaInstrumentation } from '@prisma/instrumentation';

/**
 * Advanced OpenTelemetry Integration for WishCraft
 * Provides distributed tracing, metrics, and logging for perfect APM
 */

class OpenTelemetryManager {
  private sdk: NodeSDK | null = null;
  private isInitialized = false;

  /**
   * Initialize OpenTelemetry with advanced configuration
   */
  initialize() {
    if (this.isInitialized) {
      console.log('OpenTelemetry already initialized');
      return;
    }

    const serviceName = 'wishcraft-shopify-app';
    const serviceVersion = process.env.npm_package_version || '1.0.0';
    const environment = process.env.NODE_ENV || 'development';

    // Create resource with comprehensive metadata
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'shopify-apps',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.RAILWAY_REPLICA_ID || 'local',
      [SemanticResourceAttributes.CLOUD_PROVIDER]: process.env.CLOUD_PROVIDER || 'railway',
      [SemanticResourceAttributes.CLOUD_REGION]: process.env.RAILWAY_REGION || 'us-west-1',
      'app.framework': 'remix',
      'app.type': 'shopify-embedded',
      'shopify.api_version': '2025-07',
    });

    // Configure trace exporter
    const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? new OTLPTraceExporter({
          url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
          headers: {
            'api-key': process.env.OTEL_API_KEY || '',
          },
        })
      : undefined;

    // Configure metric exporter
    const metricExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? new OTLPMetricExporter({
          url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
          headers: {
            'api-key': process.env.OTEL_API_KEY || '',
          },
        })
      : new ConsoleMetricExporter();

    // Advanced instrumentation configuration
    const instrumentations = [
      // Auto-instrumentations for Node.js
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable to reduce noise
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          requestHook: (span, request) => {
            // Add custom attributes for HTTP requests
            span.setAttributes({
              'http.user_agent': request.headers['user-agent'] || '',
              'shopify.shop': request.headers['x-shopify-shop-domain'] || '',
              'request.id': request.headers['x-request-id'] || '',
            });
          },
          responseHook: (span, response) => {
            // Add response attributes
            span.setAttributes({
              'http.response.content_length': response.headers['content-length'] || 0,
              'http.response.content_type': response.headers['content-type'] || '',
            });
          },
        },
      }),

      // GraphQL instrumentation for API tracing
      new GraphQLInstrumentation({
        allowValues: environment === 'development',
        depth: 2,
        mergeItems: true,
        requestHook: (span, requestInfo) => {
          span.setAttributes({
            'graphql.operation.type': requestInfo.operationType || 'unknown',
            'graphql.operation.name': requestInfo.operationName || 'anonymous',
            'shopify.api': 'admin-graphql',
          });
        },
      }),

      // Prisma instrumentation for database tracing
      new PrismaInstrumentation({
        middleware: true,
      }),

      // Winston logging instrumentation
      new WinstonInstrumentation(),

      // Custom HTTP instrumentation for enhanced Shopify tracking
      new HttpInstrumentation({
        requestHook: (span, request) => {
          // Enhanced Shopify-specific tracking
          const url = typeof request.url === 'string' ? request.url : request.url?.href || '';
          
          if (url.includes('myshopify.com')) {
            span.setAttributes({
              'shopify.api.type': 'admin',
              'shopify.api.version': '2025-07',
              'shopify.request.type': 'graphql',
            });
          }

          if (url.includes('webhook')) {
            span.setAttributes({
              'shopify.webhook.topic': request.headers['x-shopify-topic'] || '',
              'shopify.webhook.shop': request.headers['x-shopify-shop-domain'] || '',
            });
          }
        },
      }),
    ];

    // Initialize SDK
    this.sdk = new NodeSDK({
      resource,
      instrumentations,
      traceProcessor: traceExporter ? new BatchSpanProcessor(traceExporter) : undefined,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 30000, // Export every 30 seconds
      }),
    });

    // Start the SDK
    try {
      this.sdk.start();
      this.isInitialized = true;
      console.log('🔍 OpenTelemetry initialized successfully');
      
      // Register process exit handlers
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
    }
  }

  /**
   * Create custom span for business logic tracing
   */
  createSpan(name: string, operation: string, attributes?: Record<string, any>) {
    const tracer = this.getTracer();
    const span = tracer.startSpan(name, {
      attributes: {
        'operation.type': operation,
        ...attributes,
      },
    });

    return {
      span,
      end: (success: boolean = true, error?: Error) => {
        if (error) {
          span.recordException(error);
          span.setStatus({ code: 2, message: error.message });
        } else {
          span.setStatus({ code: success ? 1 : 2 });
        }
        span.end();
      },
    };
  }

  /**
   * Trace Shopify API calls
   */
  traceShopifyAPICall<T>(
    operation: string,
    shopDomain: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    const { span, end } = this.createSpan(`shopify.api.${operation}`, 'shopify.api', {
      'shopify.shop.domain': shopDomain,
      'shopify.api.version': '2025-07',
    });

    return apiCall()
      .then((result) => {
        end(true);
        return result;
      })
      .catch((error) => {
        end(false, error);
        throw error;
      });
  }

  /**
   * Trace database operations
   */
  traceDatabaseOperation<T>(
    operation: string,
    table: string,
    dbCall: () => Promise<T>
  ): Promise<T> {
    const { span, end } = this.createSpan(`db.${table}.${operation}`, 'db', {
      'db.table.name': table,
      'db.operation': operation,
      'db.system': 'postgresql',
    });

    return dbCall()
      .then((result) => {
        end(true);
        return result;
      })
      .catch((error) => {
        end(false, error);
        throw error;
      });
  }

  /**
   * Trace webhook processing
   */
  traceWebhookProcessing<T>(
    topic: string,
    shopDomain: string,
    processor: () => Promise<T>
  ): Promise<T> {
    const { span, end } = this.createSpan(`webhook.${topic}`, 'webhook', {
      'webhook.topic': topic,
      'shopify.shop.domain': shopDomain,
      'webhook.source': 'shopify',
    });

    return processor()
      .then((result) => {
        end(true);
        return result;
      })
      .catch((error) => {
        end(false, error);
        throw error;
      });
  }

  /**
   * Add custom metrics
   */
  recordMetric(name: string, value: number, attributes?: Record<string, any>) {
    const meter = this.getMeter();
    const counter = meter.createCounter(name, {
      description: `Custom metric: ${name}`,
    });
    
    counter.add(value, attributes);
  }

  /**
   * Record business metrics
   */
  recordBusinessMetric(metric: {
    name: string;
    value: number;
    shop?: string;
    customer?: string;
    registry?: string;
    tags?: Record<string, string>;
  }) {
    this.recordMetric(`wishcraft.${metric.name}`, metric.value, {
      'shop.domain': metric.shop,
      'customer.id': metric.customer,
      'registry.id': metric.registry,
      ...metric.tags,
    });
  }

  /**
   * Get OpenTelemetry tracer
   */
  private getTracer() {
    const { trace } = require('@opentelemetry/api');
    return trace.getTracer('wishcraft-shopify-app', process.env.npm_package_version || '1.0.0');
  }

  /**
   * Get OpenTelemetry meter
   */
  private getMeter() {
    const { metrics } = require('@opentelemetry/api');
    return metrics.getMeter('wishcraft-shopify-app', process.env.npm_package_version || '1.0.0');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.sdk && this.isInitialized) {
      console.log('🔍 Shutting down OpenTelemetry...');
      try {
        await this.sdk.shutdown();
        console.log('🔍 OpenTelemetry shutdown complete');
      } catch (error) {
        console.error('Error during OpenTelemetry shutdown:', error);
      }
    }
  }
}

// Export singleton instance
export const telemetry = new OpenTelemetryManager();

// Initialize immediately if in production
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TELEMETRY === 'true') {
  telemetry.initialize();
}

// Export utility functions for easy usage
export const {
  createSpan,
  traceShopifyAPICall,
  traceDatabaseOperation,
  traceWebhookProcessing,
  recordMetric,
  recordBusinessMetric,
} = telemetry;

/**
 * Middleware for automatic request tracing
 */
export function withTelemetry<T extends any[], R>(
  name: string,
  operation: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const { span, end } = telemetry.createSpan(name, operation);
    
    try {
      const result = await fn(...args);
      end(true);
      return result;
    } catch (error) {
      end(false, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };
}

/**
 * Performance monitoring for Core Web Vitals
 */
export function trackCoreWebVitals() {
  if (typeof window === 'undefined') return;

  // Track LCP
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEventTiming;
    
    telemetry.recordMetric('core_web_vitals.lcp', lastEntry.startTime, {
      'metric.type': 'lcp',
      'page.url': window.location.pathname,
    });
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // Track FID
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      const fidEntry = entry as PerformanceEventTiming;
      const fidValue = fidEntry.processingStart - fidEntry.startTime;
      
      telemetry.recordMetric('core_web_vitals.fid', fidValue, {
        'metric.type': 'fid',
        'page.url': window.location.pathname,
      });
    });
  }).observe({ entryTypes: ['first-input'] });

  // Track CLS
  let clsValue = 0;
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      const layoutShiftEntry = entry as any;
      if (!layoutShiftEntry.hadRecentInput) {
        clsValue += layoutShiftEntry.value;
      }
    });
    
    telemetry.recordMetric('core_web_vitals.cls', clsValue, {
      'metric.type': 'cls',
      'page.url': window.location.pathname,
    });
  }).observe({ entryTypes: ['layout-shift'] });
}