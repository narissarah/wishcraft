/**
 * External Service Adapters
 * Implements adapter pattern for external dependencies
 * Provides abstraction layer to reduce coupling with third-party services
 */

import { 
  IShopifyAdapter, 
  IRedisAdapter, 
  IEmailAdapter, 
  IError 
} from './interfaces.server';
import { log } from './logger.server';
import { errorHandler } from './error-handling-unified.server';
import { RETRY_CONFIGS, TIMEOUTS } from './constants-unified.server';
import { retryShopifyOperation, retryAPIOperation } from './error-handling-unified.server';
import crypto from 'crypto';

/**
 * Shopify API Adapter
 * Provides abstraction layer for Shopify API calls
 */
export class ShopifyAdapter implements IShopifyAdapter {
  public client: any;
  private apiKey: string;
  private apiSecret: string;
  private accessToken?: string;
  private shopDomain?: string;
  private apiVersion: string;

  constructor(config: {
    apiKey: string;
    apiSecret: string;
    apiVersion?: string;
    shopDomain?: string;
    accessToken?: string;
  }) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.apiVersion = config.apiVersion || '2025-07';
    this.shopDomain = config.shopDomain;
    this.accessToken = config.accessToken;
    this.client = this.createClient();
  }

  private createClient(): any {
    return {
      baseURL: this.shopDomain ? `https://${this.shopDomain}/admin/api/${this.apiVersion}` : null,
      timeout: TIMEOUTS.HTTP_SHOPIFY_API,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken || '',
        'User-Agent': 'WishCraft/1.0'
      }
    };
  }

  async authenticate(credentials: { shopDomain: string; accessToken: string }): Promise<void> {
    this.shopDomain = credentials.shopDomain;
    this.accessToken = credentials.accessToken;
    this.client = this.createClient();
    
    // Verify authentication by making a test request
    try {
      await this.makeRequest('GET', '/shop.json');
      log.info('Shopify authentication successful', { shopDomain: this.shopDomain });
    } catch (error) {
      log.error('Shopify authentication failed', error);
      throw new Error('Shopify authentication failed');
    }
  }

  async makeRequest(method: string, path: string, data?: any): Promise<any> {
    return retryShopifyOperation(async () => {
      const url = `${this.client.baseURL}${path}`;
      const options: RequestInit = {
        method,
        headers: this.client.headers,
        signal: AbortSignal.timeout(this.client.timeout)
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
      } else if (data && method === 'GET') {
        const params = new URLSearchParams(data.params || {});
        const separator = url.includes('?') ? '&' : '?';
        const fullUrl = `${url}${separator}${params.toString()}`;
        return this.executeRequest(fullUrl, options);
      }

      return this.executeRequest(url, options);
    }, {
      operation: 'shopify_api',
      shopId: this.shopDomain,
      metadata: { method, path }
    });
  }

  private async executeRequest(url: string, options: RequestInit): Promise<any> {
    const response = await fetch(url, options);
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_CONFIGS.SHOPIFY.RATE_LIMIT_DELAY;
      
      throw {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: `Rate limited. Retry after ${delay}ms`,
        retryAfter: delay
      };
    }

    // Handle API errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        code: 'SHOPIFY_API_ERROR',
        message: errorData.message || `Shopify API error: ${response.status}`,
        response: errorData
      };
    }

    return await response.json();
  }

  handleError(error: any): IError {
    return {
      code: error.code || 'SHOPIFY_ERROR',
      message: error.message || 'Shopify API error',
      statusCode: error.statusCode || 500,
      details: error.response || error,
      timestamp: new Date(),
      context: {
        shopDomain: this.shopDomain,
        service: 'shopify'
      }
    };
  }

  /**
   * GraphQL API support
   */
  async makeGraphQLRequest(query: string, variables?: any): Promise<any> {
    return this.makeRequest('POST', '/graphql.json', {
      query,
      variables
    });
  }

  /**
   * Webhook signature verification
   */
  verifyWebhook(data: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.apiSecret);
    hmac.update(data, 'utf8');
    const calculatedSignature = hmac.digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(calculatedSignature, 'base64')
    );
  }

  /**
   * OAuth URL generation
   */
  getOAuthURL(redirectUri: string, state: string, scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: this.apiKey,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state,
      grant_options: 'per-user'
    });

    return `https://${this.shopDomain}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{ access_token: string; scope: string }> {
    const url = `https://${this.shopDomain}/admin/oauth/access_token`;
    const data = {
      client_id: this.apiKey,
      client_secret: this.apiSecret,
      code
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return await response.json();
  }
}

/**
 * Redis Cache Adapter
 * Provides abstraction layer for Redis operations
 */
export class RedisAdapter implements IRedisAdapter {
  public client: any;
  private connectionString: string;
  private isConnected: boolean = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.client = this.createClient();
  }

  private createClient(): any {
    // Mock Redis client for demonstration
    // In production, use actual Redis client like ioredis
    return {
      data: new Map<string, { value: any; expiry?: number }>(),
      
      async get(key: string): Promise<any> {
        const item = this.data.get(key);
        if (!item) return null;
        
        if (item.expiry && Date.now() > item.expiry) {
          this.data.delete(key);
          return null;
        }
        
        return item.value;
      },
      
      async set(key: string, value: any, ttl?: number): Promise<void> {
        const expiry = ttl ? Date.now() + (ttl * 1000) : undefined;
        this.data.set(key, { value, expiry });
      },
      
      async del(key: string): Promise<void> {
        this.data.delete(key);
      },
      
      async exists(key: string): Promise<boolean> {
        return this.data.has(key);
      },
      
      async flushall(): Promise<void> {
        this.data.clear();
      }
    };
  }

  async connect(): Promise<void> {
    return retryAPIOperation(async () => {
      // In production, implement actual Redis connection
      this.isConnected = true;
      log.info('Redis connection established', { connectionString: this.connectionString.substring(0, 20) + '...' });
    }, {
      operation: 'redis_connect',
      metadata: { connectionString: this.connectionString }
    });
  }

  async disconnect(): Promise<void> {
    // In production, implement actual Redis disconnection
    this.isConnected = false;
    log.info('Redis connection closed');
  }

  async get(key: string): Promise<any> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      log.error('Redis get error', { key, error });
      throw error;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, ttl);
    } catch (error) {
      log.error('Redis set error', { key, error });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.del(key);
    } catch (error) {
      log.error('Redis delete error', { key, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      return await this.client.exists(key);
    } catch (error) {
      log.error('Redis exists error', { key, error });
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.flushall();
    } catch (error) {
      log.error('Redis clear error', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.set('health_check', 'ok', 10);
      const result = await this.get('health_check');
      await this.delete('health_check');
      
      return { healthy: result === 'ok' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

/**
 * Email Service Adapter
 * Provides abstraction layer for email sending
 */
export class EmailAdapter implements IEmailAdapter {
  public client: any;
  private provider: string;
  private config: any;

  constructor(provider: string, config: any) {
    this.provider = provider;
    this.config = config;
    this.client = this.createClient();
  }

  private createClient(): any {
    switch (this.provider) {
      case 'smtp':
        return this.createSMTPClient();
      case 'sendgrid':
        return this.createSendGridClient();
      case 'mailgun':
        return this.createMailgunClient();
      case 'ses':
        return this.createSESClient();
      default:
        return this.createMockClient();
    }
  }

  private createSMTPClient(): any {
    // Mock SMTP client
    return {
      send: async (to: string, subject: string, body: string) => {
        log.info('Mock SMTP email sent', { to, subject });
      }
    };
  }

  private createSendGridClient(): any {
    // Mock SendGrid client
    return {
      send: async (to: string, subject: string, body: string) => {
        log.info('Mock SendGrid email sent', { to, subject });
      }
    };
  }

  private createMailgunClient(): any {
    // Mock Mailgun client
    return {
      send: async (to: string, subject: string, body: string) => {
        log.info('Mock Mailgun email sent', { to, subject });
      }
    };
  }

  private createSESClient(): any {
    // Mock AWS SES client
    return {
      send: async (to: string, subject: string, body: string) => {
        log.info('Mock AWS SES email sent', { to, subject });
      }
    };
  }

  private createMockClient(): any {
    return {
      send: async (to: string, subject: string, body: string) => {
        log.info('Mock email sent', { to, subject, provider: this.provider });
      }
    };
  }

  configure(config: any): void {
    this.config = { ...this.config, ...config };
    this.client = this.createClient();
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    return retryAPIOperation(async () => {
      await this.client.send(to, subject, body);
    }, {
      operation: 'email_send',
      metadata: { provider: this.provider, to, subject }
    });
  }

  async sendTemplate(to: string, template: string, data: any): Promise<void> {
    return retryAPIOperation(async () => {
      if (this.client.sendTemplate) {
        await this.client.sendTemplate(to, template, data);
      } else {
        // Fallback to regular send
        await this.client.send(to, template, JSON.stringify(data));
      }
    }, {
      operation: 'email_send_template',
      metadata: { provider: this.provider, to, template }
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // In production, implement actual health check
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

/**
 * File Storage Adapter
 * Provides abstraction layer for file storage operations
 */
export class FileStorageAdapter {
  private provider: string;
  private config: any;
  private client: any;

  constructor(provider: string, config: any) {
    this.provider = provider;
    this.config = config;
    this.client = this.createClient();
  }

  private createClient(): any {
    switch (this.provider) {
      case 's3':
        return this.createS3Client();
      case 'gcs':
        return this.createGCSClient();
      case 'azure':
        return this.createAzureClient();
      case 'local':
        return this.createLocalClient();
      default:
        return this.createMockClient();
    }
  }

  private createS3Client(): any {
    // Mock AWS S3 client
    return {
      upload: async (file: any, path: string) => {
        log.info('Mock S3 upload', { path, size: file.size });
        return `https://s3.amazonaws.com/bucket/${path}`;
      },
      download: async (path: string) => {
        log.info('Mock S3 download', { path });
        return Buffer.from('mock file content');
      },
      delete: async (path: string) => {
        log.info('Mock S3 delete', { path });
      }
    };
  }

  private createGCSClient(): any {
    // Mock Google Cloud Storage client
    return {
      upload: async (file: any, path: string) => {
        log.info('Mock GCS upload', { path, size: file.size });
        return `https://storage.googleapis.com/bucket/${path}`;
      },
      download: async (path: string) => {
        log.info('Mock GCS download', { path });
        return Buffer.from('mock file content');
      },
      delete: async (path: string) => {
        log.info('Mock GCS delete', { path });
      }
    };
  }

  private createAzureClient(): any {
    // Mock Azure Blob Storage client
    return {
      upload: async (file: any, path: string) => {
        log.info('Mock Azure upload', { path, size: file.size });
        return `https://account.blob.core.windows.net/container/${path}`;
      },
      download: async (path: string) => {
        log.info('Mock Azure download', { path });
        return Buffer.from('mock file content');
      },
      delete: async (path: string) => {
        log.info('Mock Azure delete', { path });
      }
    };
  }

  private createLocalClient(): any {
    // Mock local file system client
    return {
      upload: async (file: any, path: string) => {
        log.info('Mock local upload', { path, size: file.size });
        return `/uploads/${path}`;
      },
      download: async (path: string) => {
        log.info('Mock local download', { path });
        return Buffer.from('mock file content');
      },
      delete: async (path: string) => {
        log.info('Mock local delete', { path });
      }
    };
  }

  private createMockClient(): any {
    return {
      upload: async (file: any, path: string) => {
        log.info('Mock file upload', { path, size: file.size, provider: this.provider });
        return `https://mock-storage.com/${path}`;
      },
      download: async (path: string) => {
        log.info('Mock file download', { path, provider: this.provider });
        return Buffer.from('mock file content');
      },
      delete: async (path: string) => {
        log.info('Mock file delete', { path, provider: this.provider });
      }
    };
  }

  async upload(file: any, path: string): Promise<string> {
    return retryAPIOperation(async () => {
      return await this.client.upload(file, path);
    }, {
      operation: 'file_upload',
      metadata: { provider: this.provider, path }
    });
  }

  async download(path: string): Promise<Buffer> {
    return retryAPIOperation(async () => {
      return await this.client.download(path);
    }, {
      operation: 'file_download',
      metadata: { provider: this.provider, path }
    });
  }

  async delete(path: string): Promise<void> {
    return retryAPIOperation(async () => {
      await this.client.delete(path);
    }, {
      operation: 'file_delete',
      metadata: { provider: this.provider, path }
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // In production, implement actual health check
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

/**
 * Analytics Adapter
 * Provides abstraction layer for analytics services
 */
export class AnalyticsAdapter {
  private provider: string;
  private config: any;
  private client: any;

  constructor(provider: string, config: any) {
    this.provider = provider;
    this.config = config;
    this.client = this.createClient();
  }

  private createClient(): any {
    switch (this.provider) {
      case 'google':
        return this.createGoogleAnalyticsClient();
      case 'mixpanel':
        return this.createMixpanelClient();
      case 'segment':
        return this.createSegmentClient();
      default:
        return this.createMockClient();
    }
  }

  private createGoogleAnalyticsClient(): any {
    return {
      track: async (event: string, properties: any) => {
        log.info('Mock Google Analytics track', { event, properties });
      },
      identify: async (userId: string, traits: any) => {
        log.info('Mock Google Analytics identify', { userId, traits });
      }
    };
  }

  private createMixpanelClient(): any {
    return {
      track: async (event: string, properties: any) => {
        log.info('Mock Mixpanel track', { event, properties });
      },
      identify: async (userId: string, traits: any) => {
        log.info('Mock Mixpanel identify', { userId, traits });
      }
    };
  }

  private createSegmentClient(): any {
    return {
      track: async (event: string, properties: any) => {
        log.info('Mock Segment track', { event, properties });
      },
      identify: async (userId: string, traits: any) => {
        log.info('Mock Segment identify', { userId, traits });
      }
    };
  }

  private createMockClient(): any {
    return {
      track: async (event: string, properties: any) => {
        log.info('Mock analytics track', { event, properties, provider: this.provider });
      },
      identify: async (userId: string, traits: any) => {
        log.info('Mock analytics identify', { userId, traits, provider: this.provider });
      }
    };
  }

  async track(event: string, properties: any): Promise<void> {
    return retryAPIOperation(async () => {
      await this.client.track(event, properties);
    }, {
      operation: 'analytics_track',
      metadata: { provider: this.provider, event }
    });
  }

  async identify(userId: string, traits: any): Promise<void> {
    return retryAPIOperation(async () => {
      await this.client.identify(userId, traits);
    }, {
      operation: 'analytics_identify',
      metadata: { provider: this.provider, userId }
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

/**
 * Adapter Factory
 * Creates appropriate adapters based on configuration
 */
export class AdapterFactory {
  static createShopifyAdapter(config: any): IShopifyAdapter {
    return new ShopifyAdapter(config);
  }

  static createRedisAdapter(connectionString: string): IRedisAdapter {
    return new RedisAdapter(connectionString);
  }

  static createEmailAdapter(provider: string, config: any): IEmailAdapter {
    return new EmailAdapter(provider, config);
  }

  static createFileStorageAdapter(provider: string, config: any): FileStorageAdapter {
    return new FileStorageAdapter(provider, config);
  }

  static createAnalyticsAdapter(provider: string, config: any): AnalyticsAdapter {
    return new AnalyticsAdapter(provider, config);
  }

  static createAdapterFromConfig(type: string, config: any): any {
    switch (type) {
      case 'shopify':
        return this.createShopifyAdapter(config);
      case 'redis':
        return this.createRedisAdapter(config.connectionString);
      case 'email':
        return this.createEmailAdapter(config.provider, config);
      case 'file':
        return this.createFileStorageAdapter(config.provider, config);
      case 'analytics':
        return this.createAnalyticsAdapter(config.provider, config);
      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }
  }
}

/**
 * Adapter Registry
 * Manages all adapters in the application
 */
export class AdapterRegistry {
  private adapters = new Map<string, any>();

  register(name: string, adapter: any): void {
    this.adapters.set(name, adapter);
    log.info(`Adapter registered: ${name}`);
  }

  get<T>(name: string): T {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter ${name} not found`);
    }
    return adapter as T;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  getAll(): Map<string, any> {
    return new Map(this.adapters);
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    adapters: Array<{
      name: string;
      healthy: boolean;
      error?: string;
    }>;
  }> {
    const results = [];
    let allHealthy = true;

    for (const [name, adapter] of this.adapters) {
      try {
        const result = adapter.healthCheck ? await adapter.healthCheck() : { healthy: true };
        results.push({
          name,
          healthy: result.healthy,
          error: result.error
        });
        
        if (!result.healthy) {
          allHealthy = false;
        }
      } catch (error) {
        results.push({
          name,
          healthy: false,
          error: error.message
        });
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      adapters: results
    };
  }

  dispose(): void {
    for (const [name, adapter] of this.adapters) {
      if (adapter && typeof adapter.disconnect === 'function') {
        try {
          adapter.disconnect();
        } catch (error) {
          log.error(`Failed to disconnect adapter ${name}`, error);
        }
      }
    }
    this.adapters.clear();
  }
}

/**
 * Global adapter registry instance
 */
export const adapterRegistry = new AdapterRegistry();

/**
 * Initialize all adapters
 */
export function initializeAdapters(): void {
  // Register Shopify adapter
  const shopifyAdapter = AdapterFactory.createShopifyAdapter({
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    apiVersion: '2025-07'
  });
  adapterRegistry.register('shopify', shopifyAdapter);

  // Register Redis adapter
  const redisAdapter = AdapterFactory.createRedisAdapter(
    process.env.REDIS_URL || 'redis://localhost:6379'
  );
  adapterRegistry.register('redis', redisAdapter);

  // Register Email adapter
  const emailAdapter = AdapterFactory.createEmailAdapter('smtp', {
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  });
  adapterRegistry.register('email', emailAdapter);

  // Register File storage adapter
  const fileAdapter = AdapterFactory.createFileStorageAdapter('local', {
    basePath: process.env.UPLOAD_PATH || './uploads'
  });
  adapterRegistry.register('file', fileAdapter);

  // Register Analytics adapter
  const analyticsAdapter = AdapterFactory.createAnalyticsAdapter('mixpanel', {
    token: process.env.MIXPANEL_TOKEN || ''
  });
  adapterRegistry.register('analytics', analyticsAdapter);

  log.info('All adapters initialized');
}

/**
 * Graceful shutdown for all adapters
 */
export function shutdownAdapters(): void {
  adapterRegistry.dispose();
  log.info('All adapters shut down');
}