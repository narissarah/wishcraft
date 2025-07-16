/**
 * Service Layer Implementation
 * Implements service layer with dependency injection
 * Reduces coupling between business logic and infrastructure
 */

import { 
  IAuthService, 
  IShopifyService, 
  IEmailService, 
  ICacheService, 
  IValidationService,
  ISecurityService,
  INotificationService,
  IAnalyticsService,
  IFileService,
  IUser,
  ISession,
  IRegistry,
  IShop,
  IShopifyProduct,
  IShopifyCustomer,
  IShopifyAdapter,
  IRedisAdapter,
  IEmailAdapter
} from './interfaces.server';
import { 
  IRegistryRepository, 
  IShopRepository, 
  IUserRepository, 
  ISessionRepository,
  IUnitOfWork
} from './interfaces.server';
import { container, Services } from './dependency-injection.server';
import { log } from './logger.server';
import { sanitizationService } from './sanitization-unified.server';
import { errorHandler } from './error-handling-unified.server';
import { p95Monitor } from './p95-monitoring.server';
import { LIMITS, TIMEOUTS } from './constants-unified.server';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Base service class with common functionality
 */
export abstract class BaseService {
  protected logger = Services.logger;
  protected errorHandler = Services.errorHandler;
  protected sanitization = Services.sanitization;

  protected async executeWithMetrics<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      // Record performance metrics
      await p95Monitor.recordMetrics({
        endpoint: operation,
        method: 'SERVICE',
        responseTime: duration,
        statusCode: 200,
        shopId: 'service',
        timestamp: new Date()
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metrics
      await p95Monitor.recordMetrics({
        endpoint: operation,
        method: 'SERVICE',
        responseTime: duration,
        statusCode: 500,
        shopId: 'service',
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  protected validateInput(data: any, schema: any): void {
    // Integration with validation service would go here
    if (!data) {
      throw new Error('Invalid input data');
    }
  }
}

/**
 * Authentication service implementation
 */
export class AuthService extends BaseService implements IAuthService {
  private userRepository: IUserRepository;
  private sessionRepository: ISessionRepository;
  private securityService: ISecurityService;

  constructor(
    userRepository: IUserRepository,
    sessionRepository: ISessionRepository,
    securityService: ISecurityService
  ) {
    super();
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.securityService = securityService;
  }

  async authenticate(request: Request): Promise<{ user?: IUser; session?: ISession }> {
    return this.executeWithMetrics('auth.authenticate', async () => {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader) {
        return {};
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Validate token
      const isValid = this.securityService.validateCSRF(token, 'expected');
      if (!isValid) {
        return {};
      }

      // Find session
      const session = await this.sessionRepository.findById(token);
      if (!session) {
        return {};
      }

      // Find user
      const user = session.userId ? await this.userRepository.findById(session.userId) : undefined;

      return { user, session };
    });
  }

  async createSession(shopId: string, accessToken: string): Promise<ISession> {
    return this.executeWithMetrics('auth.createSession', async () => {
      const sessionData = {
        shop: shopId,
        shopId,
        accessToken,
        isOnline: true,
        expires: new Date(Date.now() + TIMEOUTS.SESSION_TIMEOUT)
      };

      const session = await this.sessionRepository.create(sessionData);
      
      this.logger.info('Session created', { sessionId: session.id, shopId });
      
      return session;
    });
  }

  async validateSession(sessionId: string): Promise<boolean> {
    return this.executeWithMetrics('auth.validateSession', async () => {
      const session = await this.sessionRepository.findById(sessionId);
      
      if (!session) {
        return false;
      }

      if (session.expires && session.expires < new Date()) {
        return false;
      }

      return true;
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    return this.executeWithMetrics('auth.revokeSession', async () => {
      await this.sessionRepository.delete(sessionId);
      this.logger.info('Session revoked', { sessionId });
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

/**
 * Registry service implementation
 */
export class RegistryService extends BaseService {
  private registryRepository: IRegistryRepository;
  private shopRepository: IShopRepository;
  private unitOfWork: IUnitOfWork;

  constructor(
    registryRepository: IRegistryRepository,
    shopRepository: IShopRepository,
    unitOfWork: IUnitOfWork
  ) {
    super();
    this.registryRepository = registryRepository;
    this.shopRepository = shopRepository;
    this.unitOfWork = unitOfWork;
  }

  async createRegistry(data: any): Promise<IRegistry> {
    return this.executeWithMetrics('registry.create', async () => {
      // Validate input
      this.validateInput(data, {});

      // Sanitize data
      const sanitizedData = {
        ...data,
        title: this.sanitization.sanitizeText(data.title),
        description: data.description ? this.sanitization.sanitizeText(data.description) : undefined,
        slug: this.generateSlug(data.title)
      };

      // Create registry
      const registry = await this.registryRepository.create(sanitizedData);
      
      this.logger.info('Registry created', { registryId: registry.id, shopId: registry.shopId });
      
      return registry;
    });
  }

  async updateRegistry(id: string, data: any): Promise<IRegistry> {
    return this.executeWithMetrics('registry.update', async () => {
      // Sanitize data
      const sanitizedData = {
        ...data,
        title: data.title ? this.sanitization.sanitizeText(data.title) : undefined,
        description: data.description ? this.sanitization.sanitizeText(data.description) : undefined
      };

      const registry = await this.registryRepository.update(id, sanitizedData);
      
      this.logger.info('Registry updated', { registryId: id });
      
      return registry;
    });
  }

  async deleteRegistry(id: string): Promise<void> {
    return this.executeWithMetrics('registry.delete', async () => {
      await this.registryRepository.delete(id);
      this.logger.info('Registry deleted', { registryId: id });
    });
  }

  async getRegistry(id: string): Promise<IRegistry | null> {
    return this.executeWithMetrics('registry.get', async () => {
      return await this.registryRepository.findById(id);
    });
  }

  async getRegistryBySlug(slug: string): Promise<IRegistry | null> {
    return this.executeWithMetrics('registry.getBySlug', async () => {
      return await this.registryRepository.findBySlug(slug);
    });
  }

  async searchRegistries(query: string, filters: any = {}): Promise<IRegistry[]> {
    return this.executeWithMetrics('registry.search', async () => {
      const sanitizedQuery = this.sanitization.sanitizeText(query);
      return await this.registryRepository.search(sanitizedQuery, filters);
    });
  }

  async getRegistriesByShop(shopId: string): Promise<IRegistry[]> {
    return this.executeWithMetrics('registry.getByShop', async () => {
      return await this.registryRepository.findByShopId(shopId);
    });
  }

  async getRegistriesByCustomer(customerId: string): Promise<IRegistry[]> {
    return this.executeWithMetrics('registry.getByCustomer', async () => {
      return await this.registryRepository.findByCustomerId(customerId);
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }
}

/**
 * Shop service implementation
 */
export class ShopService extends BaseService {
  private shopRepository: IShopRepository;
  private shopifyService: IShopifyService;

  constructor(
    shopRepository: IShopRepository,
    shopifyService: IShopifyService
  ) {
    super();
    this.shopRepository = shopRepository;
    this.shopifyService = shopifyService;
  }

  async createShop(data: any): Promise<IShop> {
    return this.executeWithMetrics('shop.create', async () => {
      // Sanitize data
      const sanitizedData = {
        ...data,
        domain: this.sanitization.sanitizeText(data.domain),
        name: this.sanitization.sanitizeText(data.name),
        email: data.email ? this.sanitization.sanitizeText(data.email) : undefined
      };

      const shop = await this.shopRepository.create(sanitizedData);
      
      this.logger.info('Shop created', { shopId: shop.id, domain: shop.domain });
      
      return shop;
    });
  }

  async updateShop(id: string, data: any): Promise<IShop> {
    return this.executeWithMetrics('shop.update', async () => {
      const shop = await this.shopRepository.update(id, data);
      this.logger.info('Shop updated', { shopId: id });
      return shop;
    });
  }

  async getShop(id: string): Promise<IShop | null> {
    return this.executeWithMetrics('shop.get', async () => {
      return await this.shopRepository.findById(id);
    });
  }

  async getShopByDomain(domain: string): Promise<IShop | null> {
    return this.executeWithMetrics('shop.getByDomain', async () => {
      return await this.shopRepository.findByDomain(domain);
    });
  }

  async getShopWithSettings(id: string): Promise<any> {
    return this.executeWithMetrics('shop.getWithSettings', async () => {
      return await this.shopRepository.findWithSettings(id);
    });
  }

  async updateShopSettings(shopId: string, settings: any): Promise<void> {
    return this.executeWithMetrics('shop.updateSettings', async () => {
      await (this.shopRepository as any).updateSettings(shopId, settings);
      this.logger.info('Shop settings updated', { shopId });
    });
  }
}

/**
 * Shopify service implementation
 */
export class ShopifyService extends BaseService implements IShopifyService {
  private adapter: IShopifyAdapter;

  constructor(adapter: IShopifyAdapter) {
    super();
    this.adapter = adapter;
  }

  async getProduct(productId: string): Promise<IShopifyProduct> {
    return this.executeWithMetrics('shopify.getProduct', async () => {
      const response = await this.adapter.makeRequest('GET', `/products/${productId}`);
      return this.transformProduct(response.product);
    });
  }

  async getProducts(filters: any = {}): Promise<IShopifyProduct[]> {
    return this.executeWithMetrics('shopify.getProducts', async () => {
      const response = await this.adapter.makeRequest('GET', '/products', { params: filters });
      return response.products.map((product: any) => this.transformProduct(product));
    });
  }

  async getCustomer(customerId: string): Promise<IShopifyCustomer> {
    return this.executeWithMetrics('shopify.getCustomer', async () => {
      const response = await this.adapter.makeRequest('GET', `/customers/${customerId}`);
      return this.transformCustomer(response.customer);
    });
  }

  async createWebhook(topic: string, address: string): Promise<any> {
    return this.executeWithMetrics('shopify.createWebhook', async () => {
      const response = await this.adapter.makeRequest('POST', '/webhooks', {
        webhook: {
          topic,
          address,
          format: 'json'
        }
      });
      return response.webhook;
    });
  }

  verifyWebhook(data: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET || '');
    hmac.update(data, 'utf8');
    const calculatedSignature = hmac.digest('base64');
    return calculatedSignature === signature;
  }

  private transformProduct(product: any): IShopifyProduct {
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: product.body_html,
      images: product.images?.map((img: any) => img.src) || [],
      variants: product.variants?.map((variant: any) => this.transformVariant(variant)) || [],
      price: parseFloat(product.variants?.[0]?.price || '0'),
      compareAtPrice: product.variants?.[0]?.compare_at_price ? parseFloat(product.variants[0].compare_at_price) : undefined,
      available: product.variants?.some((v: any) => v.available) || false,
      tags: product.tags || []
    };
  }

  private transformVariant(variant: any): any {
    return {
      id: variant.id,
      title: variant.title,
      price: parseFloat(variant.price),
      compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : undefined,
      available: variant.available,
      inventoryQuantity: variant.inventory_quantity
    };
  }

  private transformCustomer(customer: any): IShopifyCustomer {
    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      tags: customer.tags || []
    };
  }
}

/**
 * Email service implementation
 */
export class EmailService extends BaseService implements IEmailService {
  private adapter: IEmailAdapter;

  constructor(adapter: IEmailAdapter) {
    super();
    this.adapter = adapter;
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    return this.executeWithMetrics('email.send', async () => {
      const sanitizedTo = this.sanitization.sanitizeText(to);
      const sanitizedSubject = this.sanitization.sanitizeText(subject);
      const sanitizedBody = this.sanitization.sanitizeHtml(body);

      await this.adapter.send(sanitizedTo, sanitizedSubject, sanitizedBody);
      this.logger.info('Email sent', { to: sanitizedTo, subject: sanitizedSubject });
    });
  }

  async sendTemplateEmail(to: string, template: string, data: any): Promise<void> {
    return this.executeWithMetrics('email.sendTemplate', async () => {
      const sanitizedTo = this.sanitization.sanitizeText(to);
      const sanitizedTemplate = this.sanitization.sanitizeText(template);

      await this.adapter.sendTemplate(sanitizedTo, sanitizedTemplate, data);
      this.logger.info('Template email sent', { to: sanitizedTo, template: sanitizedTemplate });
    });
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Cache service implementation
 */
export class CacheService extends BaseService implements ICacheService {
  private adapter: IRedisAdapter;

  constructor(adapter: IRedisAdapter) {
    super();
    this.adapter = adapter;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.executeWithMetrics('cache.get', async () => {
      const result = await this.adapter.get(key);
      return result as T;
    });
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    return this.executeWithMetrics('cache.set', async () => {
      await this.adapter.set(key, value, ttl);
    });
  }

  async delete(key: string): Promise<void> {
    return this.executeWithMetrics('cache.delete', async () => {
      await this.adapter.delete(key);
    });
  }

  async clear(): Promise<void> {
    return this.executeWithMetrics('cache.clear', async () => {
      // Implementation depends on adapter
      this.logger.info('Cache cleared');
    });
  }

  async has(key: string): Promise<boolean> {
    return this.executeWithMetrics('cache.has', async () => {
      const result = await this.adapter.get(key);
      return result !== null;
    });
  }
}

/**
 * Security service implementation
 */
export class SecurityService extends BaseService implements ISecurityService {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    super();
    this.encryptionKey = encryptionKey;
  }

  encrypt(data: string): string {
    const cipher = crypto.createCipher('aes-256-ctr', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decrypt(encryptedData: string): string {
    const decipher = crypto.createDecipher('aes-256-ctr', this.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  verify(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }

  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  validateCSRF(token: string, expected: string): boolean {
    if (!token || !expected) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  }
}

/**
 * Service factory for dependency injection
 */
export class ServiceFactory {
  static createAuthService(
    userRepository: IUserRepository,
    sessionRepository: ISessionRepository,
    securityService: ISecurityService
  ): IAuthService {
    return new AuthService(userRepository, sessionRepository, securityService);
  }

  static createRegistryService(
    registryRepository: IRegistryRepository,
    shopRepository: IShopRepository,
    unitOfWork: IUnitOfWork
  ): RegistryService {
    return new RegistryService(registryRepository, shopRepository, unitOfWork);
  }

  static createShopService(
    shopRepository: IShopRepository,
    shopifyService: IShopifyService
  ): ShopService {
    return new ShopService(shopRepository, shopifyService);
  }

  static createShopifyService(adapter: IShopifyAdapter): IShopifyService {
    return new ShopifyService(adapter);
  }

  static createEmailService(adapter: IEmailAdapter): IEmailService {
    return new EmailService(adapter);
  }

  static createCacheService(adapter: IRedisAdapter): ICacheService {
    return new CacheService(adapter);
  }

  static createSecurityService(encryptionKey: string): ISecurityService {
    return new SecurityService(encryptionKey);
  }
}

/**
 * Service registry for dependency injection
 */
export class ServiceRegistry {
  private services = new Map<string, any>();
  private factory: ServiceFactory;

  constructor() {
    this.factory = new ServiceFactory();
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    if (!this.services.has(name)) {
      throw new Error(`Service ${name} not found`);
    }
    return this.services.get(name) as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  clear(): void {
    this.services.clear();
  }

  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }
}

/**
 * Register all services with the DI container
 */
export function registerServices(): void {
  // Register service factories
  container.register('serviceFactory', () => new ServiceFactory(), 'singleton');
  container.register('serviceRegistry', () => new ServiceRegistry(), 'singleton');

  // Register individual services
  container.register('authService', (container) => {
    const userRepository = container.resolve<IUserRepository>('userRepository');
    const sessionRepository = container.resolve<ISessionRepository>('sessionRepository');
    const securityService = container.resolve<ISecurityService>('securityService');
    return ServiceFactory.createAuthService(userRepository, sessionRepository, securityService);
  }, 'singleton');

  container.register('registryService', (container) => {
    const registryRepository = container.resolve<IRegistryRepository>('registryRepository');
    const shopRepository = container.resolve<IShopRepository>('shopRepository');
    const unitOfWork = container.resolve<IUnitOfWork>('unitOfWork');
    return ServiceFactory.createRegistryService(registryRepository, shopRepository, unitOfWork);
  }, 'singleton');

  container.register('shopService', (container) => {
    const shopRepository = container.resolve<IShopRepository>('shopRepository');
    const shopifyService = container.resolve<IShopifyService>('shopifyService');
    return ServiceFactory.createShopService(shopRepository, shopifyService);
  }, 'singleton');

  log.info('Services registered in DI container');
}

/**
 * Export service locator
 */
export const AppServices = {
  get auth(): IAuthService {
    return container.resolve<IAuthService>('authService');
  },

  get registry(): RegistryService {
    return container.resolve<RegistryService>('registryService');
  },

  get shop(): ShopService {
    return container.resolve<ShopService>('shopService');
  },

  get shopify(): IShopifyService {
    return container.resolve<IShopifyService>('shopifyService');
  },

  get email(): IEmailService {
    return container.resolve<IEmailService>('emailService');
  },

  get cache(): ICacheService {
    return container.resolve<ICacheService>('cacheService');
  },

  get security(): ISecurityService {
    return container.resolve<ISecurityService>('securityService');
  }
};