import winston from 'winston';

// ============================================================================
// WINSTON LOGGER CONFIGURATION FOR PRODUCTION
// ============================================================================

const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format for production (JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  levels,
  format: isDevelopment ? devFormat : prodFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      silent: isTest,
    }),
  ],
});

// In production environments like Railway, we only use console logging
// File logging is handled by the platform (Railway, Docker, etc.)
// Railway automatically captures console output for logging
if (!isDevelopment && !isTest) {
  // Railway/Docker environments: console logging only
  // Platform handles log collection and storage
  logger.info('Production logging: Console output captured by platform');
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

export interface LogContext {
  shopId?: string;
  customerId?: string;
  registryId?: string;
  orderId?: string;
  userId?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private formatMessage(message: string, meta?: any) {
    const metadata = {
      ...this.context,
      ...meta,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      appVersion: process.env.npm_package_version,
    };

    if (isDevelopment) {
      return `${message} ${Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : ''}`;
    }

    return message;
  }

  private log(level: string, message: string, meta?: any) {
    const formattedMessage = this.formatMessage(message, meta);
    const logMeta = isDevelopment ? {} : { ...this.context, ...meta };
    
    (logger as any)[level](formattedMessage, logMeta);

    // Error logging simplified for production
  }

  error(message: string, error?: Error | any, meta?: any) {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    
    this.log('error', message, errorMeta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  http(message: string, meta?: any) {
    this.log('http', message, meta);
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }

  // Performance logging
  performance(operation: string, duration: number, meta?: any) {
    this.info(`Performance: ${operation}`, {
      ...meta,
      duration,
      operation,
      type: 'performance',
    });
  }

  // Security logging
  security(event: string, meta?: any) {
    this.warn(`Security: ${event}`, {
      ...meta,
      event,
      type: 'security',
    });
  }

  // Audit logging
  audit(action: string, resource: string, meta?: any) {
    this.info(`Audit: ${action} ${resource}`, {
      ...meta,
      action,
      resource,
      type: 'audit',
    });
  }

  // Webhook logging
  webhook(event: string, shop: string, meta?: any) {
    this.info(`Webhook: ${event}`, {
      ...meta,
      event,
      shop,
      type: 'webhook',
    });
  }

  // Create child logger with additional context
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }
}

// Export singleton instance
export const log = new Logger();

// HTTP request logging middleware
export function httpLogger(request: Request, response: Response, duration: number) {
  const url = new URL(request.url);
  
  log.http(`${request.method} ${url.pathname}`, {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    status: response.status,
    duration,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent'),
  });
}

// Error boundary logger
export function logErrorBoundary(error: Error, errorInfo: any) {
  log.error('React Error Boundary', error, {
    componentStack: errorInfo.componentStack,
    errorBoundary: true,
  });
}

// Replace console methods in production
if (!isDevelopment) {
  console.log = (...args) => log.info(args.join(' '));
  console.warn = (...args) => log.warn(args.join(' '));
  console.error = (...args) => log.error(args.join(' '));
  console.debug = (...args) => log.debug(args.join(' '));
}