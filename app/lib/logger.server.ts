/**
 * Simplified Logger for WishCraft
 * Basic logging without complex Winston configuration
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

interface LogMeta {
  [key: string]: any;
}

class SimpleLogger {
  private formatMessage(level: string, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  error(message: string, error?: Error | any, meta?: LogMeta) {
    const errorMeta = {
      ...meta,
      ...(error instanceof Error ? {
        error: error.message,
        stack: error.stack,
        name: error.name,
      } : { error }),
    };
    
    console.error(this.formatMessage('error', message, errorMeta));
  }

  warn(message: string, meta?: LogMeta) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  info(message: string, meta?: LogMeta) {
    console.info(this.formatMessage('info', message, meta));
  }

  debug(message: string, meta?: LogMeta) {
    if (isDevelopment) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  // Webhook logging utility
  webhook(topic: string, shop: string, meta?: LogMeta) {
    const webhookMeta = {
      ...meta,
      shop,
      topic,
      type: 'webhook'
    };
    console.info(this.formatMessage('webhook', `${topic} webhook received`, webhookMeta));
  }

  // Performance timing utility
  time(label: string) {
    console.time(label);
  }

  timeEnd(label: string) {
    console.timeEnd(label);
  }
}

export const log = new SimpleLogger();