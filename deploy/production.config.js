// Production deployment configuration for WishCraft
// Follows Shopify hosting recommendations

export const productionConfig = {
  // Environment configuration
  environment: 'production',
  
  // Platform configuration (Railway/Render compatible)
  platform: {
    railway: {
      serviceName: 'wishcraft-prod',
      region: 'us-west1',
      scaling: {
        minInstances: 2,
        maxInstances: 10,
        cpuThreshold: 80,
        memoryThreshold: 85
      },
      resources: {
        memory: '2GB',
        cpu: '2vCPU',
        disk: '20GB'
      }
    },
    render: {
      serviceName: 'wishcraft-prod',
      region: 'oregon',
      plan: 'standard',
      scaling: {
        autoscaling: true,
        minInstances: 2,
        maxInstances: 8
      },
      healthCheck: {
        path: '/health',
        interval: 30,
        timeout: 10,
        retries: 3
      }
    }
  },

  // Database configuration
  database: {
    provider: 'postgresql',
    connectionPool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000
    },
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    backup: {
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: '30d',
      destinations: ['s3', 'gcs']
    }
  },

  // Security configuration
  security: {
    ssl: {
      enforceHttps: true,
      hstsMaxAge: 31536000,
      includeSubdomains: true,
      preload: true
    },
    cors: {
      origin: [
        'https://admin.shopify.com',
        'https://*.myshopify.com',
        'https://wishcraft-app.com'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Shopify-*']
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // requests per window
      skipSuccessfulRequests: false
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.shopify.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", 'https://*.shopify.com', 'https://api.shopify.com']
        }
      }
    }
  },

  // Performance configuration
  performance: {
    compression: {
      threshold: 1024,
      level: 6,
      algorithms: ['gzip', 'br']
    },
    caching: {
      static: {
        maxAge: 31536000, // 1 year
        immutable: true
      },
      api: {
        maxAge: 300, // 5 minutes
        staleWhileRevalidate: 86400 // 1 day
      }
    },
    monitoring: {
      apm: true,
      metrics: true,
      traces: true,
      logs: {
        level: 'info',
        format: 'json',
        retention: '30d'
      }
    }
  },

  // CDN configuration
  cdn: {
    provider: 'cloudflare', // or 'cloudfront'
    zones: {
      static: 'static.wishcraft-app.com',
      api: 'api.wishcraft-app.com'
    },
    caching: {
      browser: 86400, // 1 day
      edge: 2592000  // 30 days
    },
    optimization: {
      minify: {
        html: true,
        css: true,
        js: true
      },
      compression: true,
      webp: true,
      avif: true
    }
  },

  // Monitoring and alerting
  monitoring: {
    healthChecks: {
      endpoints: [
        '/health',
        '/health/db',
        '/health/shopify',
        '/health/performance'
      ],
      interval: 30, // seconds
      timeout: 10   // seconds
    },
    metrics: {
      provider: 'datadog', // or 'newrelic', 'prometheus'
      dashboards: [
        'application-performance',
        'infrastructure',
        'business-metrics',
        'error-tracking'
      ]
    },
    alerts: {
      channels: ['slack', 'email', 'pagerduty'],
      thresholds: {
        errorRate: 5,        // 5%
        responseTime: 2000,  // 2s
        availability: 99.9,  // 99.9%
        cpuUsage: 80,       // 80%
        memoryUsage: 85     // 85%
      }
    },
    logging: {
      provider: 'datadog', // or 'papertrail', 'loggly'
      structured: true,
      sampling: {
        info: 0.1,    // 10% sampling
        warn: 1.0,    // 100% sampling
        error: 1.0    // 100% sampling
      }
    }
  },

  // Backup and disaster recovery
  backup: {
    database: {
      schedule: '0 */6 * * *', // Every 6 hours
      retention: '90d',
      encryption: true,
      compression: true
    },
    files: {
      schedule: '0 1 * * *', // Daily at 1 AM
      retention: '30d',
      encryption: true
    },
    disaster_recovery: {
      rpo: 4,   // hours
      rto: 1,   // hours
      regions: ['us-west-1', 'us-east-1'],
      testing: 'monthly'
    }
  },

  // Required environment variables
  requiredEnvVars: [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SCOPES',
    'HOST',
    'DATABASE_URL',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'WEBHOOK_SECRET',
    'CDN_URL',
    'REDIS_URL',
    'SENTRY_DSN',
    'DATADOG_API_KEY'
  ],

  // Build configuration
  build: {
    nodeVersion: '18.x',
    buildCommand: 'npm run build',
    outputDirectory: 'build',
    environment: {
      NODE_ENV: 'production',
      CI: 'true',
      GENERATE_SOURCEMAP: 'false'
    },
    optimization: {
      minify: true,
      treeshake: true,
      splitChunks: true,
      compression: true
    }
  },

  // Deployment strategy
  deployment: {
    strategy: 'blue-green', // or 'rolling'
    healthCheckGracePeriod: 60, // seconds
    maxUnavailablePercent: 0,   // zero-downtime
    rollback: {
      automatic: true,
      healthCheckFailures: 3,
      timeout: 300 // seconds
    }
  }
};

export default productionConfig;