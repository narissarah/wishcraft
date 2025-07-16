/**
 * Interface Abstraction Layer
 * Defines contracts for all major services to reduce coupling
 * Implements adapter pattern for external dependencies
 */

import type { PrismaClient } from '@prisma/client';
import type { Request, Response } from '@remix-run/node';

// Core domain interfaces
export interface IEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRepository<T extends IEntity> {
  findById(id: string): Promise<T | null>;
  findMany(filters?: any): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(filters?: any): Promise<number>;
}

export interface IUnitOfWork {
  registries: IRegistryRepository;
  shops: IShopRepository;
  users: IUserRepository;
  sessions: ISessionRepository;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// Registry domain interfaces
export interface IRegistry extends IEntity {
  title: string;
  description?: string;
  slug: string;
  status: string;
  eventType: string;
  eventDate?: Date;
  visibility: string;
  shopId: string;
  customerId: string;
  customerEmail: string;
  items: IRegistryItem[];
}

export interface IRegistryItem extends IEntity {
  registryId: string;
  productId: string;
  variantId?: string;
  productTitle: string;
  quantity: number;
  price: number;
  status: string;
}

export interface IRegistryRepository extends IRepository<IRegistry> {
  findBySlug(slug: string): Promise<IRegistry | null>;
  findByCustomerId(customerId: string): Promise<IRegistry[]>;
  findByShopId(shopId: string): Promise<IRegistry[]>;
  search(query: string, filters?: any): Promise<IRegistry[]>;
}

// Shop domain interfaces
export interface IShop extends IEntity {
  domain: string;
  name: string;
  email?: string;
  currencyCode: string;
  settings?: IShopSettings;
}

export interface IShopSettings extends IEntity {
  shopId: string;
  enablePasswordProtection: boolean;
  enableGiftMessages: boolean;
  primaryColor: string;
  maxItemsPerRegistry: number;
}

export interface IShopRepository extends IRepository<IShop> {
  findByDomain(domain: string): Promise<IShop | null>;
  findWithSettings(id: string): Promise<IShop & { settings: IShopSettings } | null>;
}

// User and session interfaces
export interface IUser extends IEntity {
  email: string;
  firstName?: string;
  lastName?: string;
  shopId: string;
}

export interface ISession extends IEntity {
  shop: string;
  shopId: string;
  userId?: string;
  accessToken: string;
  expires?: Date;
  isOnline: boolean;
}

export interface IUserRepository extends IRepository<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findByShopId(shopId: string): Promise<IUser[]>;
}

export interface ISessionRepository extends IRepository<ISession> {
  findByShop(shop: string): Promise<ISession | null>;
  findByUserId(userId: string): Promise<ISession[]>;
  cleanup(): Promise<void>;
}

// Service interfaces
export interface IAuthService {
  authenticate(request: Request): Promise<{ user?: IUser; session?: ISession }>;
  createSession(shopId: string, accessToken: string): Promise<ISession>;
  validateSession(sessionId: string): Promise<boolean>;
  revokeSession(sessionId: string): Promise<void>;
}

export interface IShopifyService {
  getProduct(productId: string): Promise<IShopifyProduct>;
  getProducts(filters?: any): Promise<IShopifyProduct[]>;
  getCustomer(customerId: string): Promise<IShopifyCustomer>;
  createWebhook(topic: string, address: string): Promise<IWebhook>;
  verifyWebhook(data: string, signature: string): boolean;
}

export interface IShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description?: string;
  images: string[];
  variants: IShopifyVariant[];
  price: number;
  compareAtPrice?: number;
  available: boolean;
  tags: string[];
}

export interface IShopifyVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  available: boolean;
  inventoryQuantity?: number;
}

export interface IShopifyCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags: string[];
}

export interface IWebhook {
  id: string;
  topic: string;
  address: string;
  createdAt: Date;
}

export interface IEmailService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendTemplateEmail(to: string, template: string, data: any): Promise<void>;
  validateEmail(email: string): boolean;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface IValidationService {
  validate<T>(data: any, schema: any): Promise<{ valid: boolean; data?: T; errors?: any[] }>;
  sanitize(data: any, options?: any): any;
}

export interface ISecurityService {
  encrypt(data: string): string;
  decrypt(encryptedData: string): string;
  hash(data: string): string;
  verify(data: string, hash: string): boolean;
  generateToken(length?: number): string;
  validateCSRF(token: string, expected: string): boolean;
}

export interface IEventService {
  emit(event: string, data: any): Promise<void>;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export interface INotificationService {
  send(type: string, recipient: string, message: string, data?: any): Promise<void>;
  sendToSlack(message: string, channel?: string): Promise<void>;
  sendToDiscord(message: string, channel?: string): Promise<void>;
  sendWebhook(url: string, data: any): Promise<void>;
}

export interface IJobService {
  schedule(job: string, data: any, options?: any): Promise<void>;
  process(job: string, handler: (data: any) => Promise<void>): void;
  cancel(jobId: string): Promise<void>;
  getStatus(jobId: string): Promise<any>;
}

export interface IFileService {
  upload(file: File, path: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getUrl(path: string): string;
}

export interface IAnalyticsService {
  track(event: string, properties?: any): Promise<void>;
  identify(userId: string, traits?: any): Promise<void>;
  page(name: string, properties?: any): Promise<void>;
  alias(userId: string, previousId: string): Promise<void>;
}

export interface ISearchService {
  index(document: any): Promise<void>;
  search(query: string, filters?: any): Promise<any[]>;
  delete(id: string): Promise<void>;
  update(id: string, document: any): Promise<void>;
}

// Configuration interfaces
export interface IConfig {
  database: IDatabaseConfig;
  shopify: IShopifyConfig;
  security: ISecurityConfig;
  cache: ICacheConfig;
  monitoring: IMonitoringConfig;
}

export interface IDatabaseConfig {
  url: string;
  poolSize: number;
  timeout: number;
  ssl: boolean;
}

export interface IShopifyConfig {
  apiKey: string;
  apiSecret: string;
  scopes: string[];
  appUrl: string;
  webhookSecret: string;
  apiVersion: string;
}

export interface ISecurityConfig {
  sessionSecret: string;
  encryptionKey: string;
  jwtSecret: string;
  csrfSecret: string;
}

export interface ICacheConfig {
  type: 'memory' | 'redis';
  url?: string;
  ttl: number;
  maxSize: number;
}

export interface IMonitoringConfig {
  enabled: boolean;
  logLevel: string;
  metricsEnabled: boolean;
  alertingEnabled: boolean;
}

// Request/Response interfaces
export interface IApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
  user?: IUser;
  session?: ISession;
}

export interface IApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

export interface IController {
  handle(request: IApiRequest): Promise<IApiResponse>;
}

// Middleware interfaces
export interface IMiddleware {
  execute(request: IApiRequest, response: IApiResponse, next: () => void): Promise<void>;
}

export interface IAuthMiddleware extends IMiddleware {
  authenticate(request: IApiRequest): Promise<{ user?: IUser; session?: ISession }>;
}

export interface IValidationMiddleware extends IMiddleware {
  validate(data: any, schema: any): Promise<{ valid: boolean; errors?: any[] }>;
}

export interface IRateLimitMiddleware extends IMiddleware {
  checkLimit(key: string): Promise<{ allowed: boolean; remainingRequests: number }>;
}

// Error interfaces
export interface IError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
  timestamp: Date;
  context?: any;
}

export interface IErrorHandler {
  handle(error: any, context?: any): IError;
  format(error: IError): IApiResponse;
  log(error: IError): void;
}

// Health check interfaces
export interface IHealthCheck {
  name: string;
  check(): Promise<IHealthResult>;
}

export interface IHealthResult {
  healthy: boolean;
  message?: string;
  duration?: number;
  timestamp: Date;
}

export interface IHealthService {
  register(check: IHealthCheck): void;
  checkAll(): Promise<IHealthResult[]>;
  checkOne(name: string): Promise<IHealthResult>;
}

// Audit interfaces
export interface IAuditEvent {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuditService {
  log(event: Omit<IAuditEvent, 'id' | 'timestamp'>): Promise<void>;
  query(filters: any): Promise<IAuditEvent[]>;
  export(format: string, filters?: any): Promise<Buffer>;
}

// Plugin interfaces
export interface IPlugin {
  name: string;
  version: string;
  dependencies?: string[];
  install(container: any): Promise<void>;
  uninstall(container: any): Promise<void>;
  configure(config: any): void;
}

export interface IPluginManager {
  install(plugin: IPlugin): Promise<void>;
  uninstall(name: string): Promise<void>;
  list(): IPlugin[];
  get(name: string): IPlugin | null;
  configure(name: string, config: any): void;
}

// Adapter interfaces for external services
export interface IShopifyAdapter {
  client: any;
  authenticate(credentials: any): Promise<void>;
  makeRequest(method: string, path: string, data?: any): Promise<any>;
  handleError(error: any): IError;
}

export interface IRedisAdapter {
  client: any;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IEmailAdapter {
  client: any;
  configure(config: any): void;
  send(to: string, subject: string, body: string): Promise<void>;
  sendTemplate(to: string, template: string, data: any): Promise<void>;
}

// Type guards and utilities
export function isEntity(obj: any): obj is IEntity {
  return obj && typeof obj.id === 'string' && obj.createdAt instanceof Date;
}

export function isError(obj: any): obj is IError {
  return obj && typeof obj.code === 'string' && typeof obj.message === 'string';
}

export function isHealthy(result: IHealthResult): boolean {
  return result.healthy;
}

// Factory interfaces
export interface IRepositoryFactory {
  create<T extends IEntity>(entityType: string): IRepository<T>;
}

export interface IServiceFactory {
  create<T>(serviceType: string, config?: any): T;
}

// Transaction interfaces
export interface ITransaction {
  id: string;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

export interface ITransactionManager {
  begin(): Promise<ITransaction>;
  commit(transaction: ITransaction): Promise<void>;
  rollback(transaction: ITransaction): Promise<void>;
}

// Event sourcing interfaces
export interface IEvent {
  id: string;
  type: string;
  aggregateId: string;
  data: any;
  timestamp: Date;
  version: number;
}

export interface IEventStore {
  append(events: IEvent[]): Promise<void>;
  getEvents(aggregateId: string): Promise<IEvent[]>;
  getEventsSince(aggregateId: string, version: number): Promise<IEvent[]>;
}

export interface IEventHandler {
  handle(event: IEvent): Promise<void>;
  canHandle(event: IEvent): boolean;
}

// Query interfaces
export interface IQuery {
  execute(): Promise<any>;
  validate(): boolean;
}

export interface IQueryHandler<T extends IQuery> {
  handle(query: T): Promise<any>;
  canHandle(query: IQuery): boolean;
}

export interface ICommand {
  execute(): Promise<any>;
  validate(): boolean;
}

export interface ICommandHandler<T extends ICommand> {
  handle(command: T): Promise<any>;
  canHandle(command: ICommand): boolean;
}

// Specification pattern interfaces
export interface ISpecification<T> {
  isSatisfiedBy(item: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

// Observer pattern interfaces
export interface IObserver<T> {
  update(data: T): void;
}

export interface IObservable<T> {
  subscribe(observer: IObserver<T>): void;
  unsubscribe(observer: IObserver<T>): void;
  notify(data: T): void;
}

// Strategy pattern interfaces
export interface IStrategy<T, R> {
  execute(data: T): R;
}

export interface IStrategyContext<T, R> {
  setStrategy(strategy: IStrategy<T, R>): void;
  execute(data: T): R;
}

// State machine interfaces
export interface IState<T> {
  name: string;
  canTransitionTo(state: string): boolean;
  enter(context: T): void;
  exit(context: T): void;
  handle(event: string, context: T): string | null;
}

export interface IStateMachine<T> {
  currentState: string;
  setState(state: string): void;
  canTransition(state: string): boolean;
  transition(state: string): void;
  handle(event: string): void;
}

// Decorator interfaces
export interface IDecorator<T> {
  decorate(target: T): T;
}

export interface IValidationDecorator extends IDecorator<any> {
  validate(data: any): boolean;
}

export interface ILoggingDecorator extends IDecorator<any> {
  log(method: string, args: any[]): void;
}

// Builder pattern interfaces
export interface IBuilder<T> {
  build(): T;
  reset(): void;
}

export interface IRegistryBuilder extends IBuilder<IRegistry> {
  setTitle(title: string): IRegistryBuilder;
  setDescription(description: string): IRegistryBuilder;
  setEventType(eventType: string): IRegistryBuilder;
  setVisibility(visibility: string): IRegistryBuilder;
  addItem(item: IRegistryItem): IRegistryBuilder;
}

// Proxy pattern interfaces
export interface IProxy<T> {
  target: T;
  intercept(method: string, args: any[]): any;
}