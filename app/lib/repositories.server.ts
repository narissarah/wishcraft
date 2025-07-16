/**
 * Repository Implementations
 * Implements repository pattern with interface segregation
 * Reduces coupling between domain logic and data access
 */

import { PrismaClient } from '@prisma/client';
import { 
  IRepository, 
  IRegistryRepository, 
  IShopRepository, 
  IUserRepository, 
  ISessionRepository,
  IRegistry, 
  IShop, 
  IUser, 
  ISession,
  IEntity,
  IUnitOfWork,
  ITransactionManager,
  ITransaction
} from './interfaces.server';
import { log } from './logger.server';
import { sanitizationService } from './sanitization-unified.server';
import { errorHandler } from './error-handling-unified.server';

/**
 * Base repository implementation
 */
export abstract class BaseRepository<T extends IEntity> implements IRepository<T> {
  protected prisma: PrismaClient;
  protected tableName: string;

  constructor(prisma: PrismaClient, tableName: string) {
    this.prisma = prisma;
    this.tableName = tableName;
  }

  async findById(id: string): Promise<T | null> {
    try {
      const result = await (this.prisma as any)[this.tableName].findUnique({
        where: { id }
      });
      return result as T;
    } catch (error) {
      log.error(`Failed to find ${this.tableName} by id: ${id}`, error);
      throw error;
    }
  }

  async findMany(filters: any = {}): Promise<T[]> {
    try {
      const result = await (this.prisma as any)[this.tableName].findMany({
        where: filters,
        orderBy: { createdAt: 'desc' }
      });
      return result as T[];
    } catch (error) {
      log.error(`Failed to find many ${this.tableName}`, error);
      throw error;
    }
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      const result = await (this.prisma as any)[this.tableName].create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      return result as T;
    } catch (error) {
      log.error(`Failed to create ${this.tableName}`, error);
      throw error;
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      const result = await (this.prisma as any)[this.tableName].update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
      return result as T;
    } catch (error) {
      log.error(`Failed to update ${this.tableName} with id: ${id}`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await (this.prisma as any)[this.tableName].delete({
        where: { id }
      });
    } catch (error) {
      log.error(`Failed to delete ${this.tableName} with id: ${id}`, error);
      throw error;
    }
  }

  async count(filters: any = {}): Promise<number> {
    try {
      const result = await (this.prisma as any)[this.tableName].count({
        where: filters
      });
      return result;
    } catch (error) {
      log.error(`Failed to count ${this.tableName}`, error);
      throw error;
    }
  }

  protected buildSearchQuery(query: string, searchFields: string[]): any {
    const sanitizedQuery = sanitizationService.sanitizeSearchQuery(query);
    
    if (!sanitizedQuery) {
      return {};
    }

    return {
      OR: searchFields.map(field => ({
        [field]: {
          contains: sanitizedQuery,
          mode: 'insensitive'
        }
      }))
    };
  }

  protected buildPaginationQuery(page: number = 1, limit: number = 20): any {
    const skip = (page - 1) * limit;
    return {
      skip,
      take: limit
    };
  }

  protected buildSortQuery(sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc'): any {
    return {
      orderBy: {
        [sortBy]: sortOrder
      }
    };
  }
}

/**
 * Registry repository implementation
 */
export class RegistryRepository extends BaseRepository<IRegistry> implements IRegistryRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'registry');
  }

  async findBySlug(slug: string): Promise<IRegistry | null> {
    try {
      const result = await this.prisma.registry.findUnique({
        where: { slug },
        include: {
          items: true
        }
      });
      return result as IRegistry;
    } catch (error) {
      log.error(`Failed to find registry by slug: ${slug}`, error);
      throw error;
    }
  }

  async findByCustomerId(customerId: string): Promise<IRegistry[]> {
    try {
      const result = await this.prisma.registry.findMany({
        where: { customerId },
        include: {
          items: true
        },
        orderBy: { createdAt: 'desc' }
      });
      return result as IRegistry[];
    } catch (error) {
      log.error(`Failed to find registries by customer id: ${customerId}`, error);
      throw error;
    }
  }

  async findByShopId(shopId: string): Promise<IRegistry[]> {
    try {
      const result = await this.prisma.registry.findMany({
        where: { shopId },
        include: {
          items: true
        },
        orderBy: { createdAt: 'desc' }
      });
      return result as IRegistry[];
    } catch (error) {
      log.error(`Failed to find registries by shop id: ${shopId}`, error);
      throw error;
    }
  }

  async search(query: string, filters: any = {}): Promise<IRegistry[]> {
    try {
      const searchQuery = this.buildSearchQuery(query, ['title', 'description']);
      
      const result = await this.prisma.registry.findMany({
        where: {
          AND: [
            searchQuery,
            filters
          ]
        },
        include: {
          items: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return result as IRegistry[];
    } catch (error) {
      log.error(`Failed to search registries with query: ${query}`, error);
      throw error;
    }
  }

  async findActiveByShopId(shopId: string): Promise<IRegistry[]> {
    return this.findMany({
      shopId,
      status: 'active'
    });
  }

  async findByEventType(eventType: string, shopId?: string): Promise<IRegistry[]> {
    const filters: any = { eventType };
    if (shopId) {
      filters.shopId = shopId;
    }
    
    return this.findMany(filters);
  }

  async findPublicRegistries(shopId?: string): Promise<IRegistry[]> {
    const filters: any = { 
      visibility: 'public',
      status: 'active'
    };
    if (shopId) {
      filters.shopId = shopId;
    }
    
    return this.findMany(filters);
  }
}

/**
 * Shop repository implementation
 */
export class ShopRepository extends BaseRepository<IShop> implements IShopRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'shop');
  }

  async findByDomain(domain: string): Promise<IShop | null> {
    try {
      const result = await this.prisma.shop.findUnique({
        where: { domain }
      });
      return result as IShop;
    } catch (error) {
      log.error(`Failed to find shop by domain: ${domain}`, error);
      throw error;
    }
  }

  async findWithSettings(id: string): Promise<IShop & { settings: any } | null> {
    try {
      const result = await this.prisma.shop.findUnique({
        where: { id },
        include: {
          settings: true
        }
      });
      return result as IShop & { settings: any };
    } catch (error) {
      log.error(`Failed to find shop with settings by id: ${id}`, error);
      throw error;
    }
  }

  async findActiveShops(): Promise<IShop[]> {
    return this.findMany({
      settings: {
        appActive: true
      }
    });
  }

  async updateSettings(shopId: string, settings: any): Promise<void> {
    try {
      await this.prisma.shopSettings.upsert({
        where: { shopId },
        update: {
          ...settings,
          updatedAt: new Date()
        },
        create: {
          shopId,
          ...settings
        }
      });
    } catch (error) {
      log.error(`Failed to update shop settings for shop: ${shopId}`, error);
      throw error;
    }
  }
}

/**
 * User repository implementation
 */
export class UserRepository extends BaseRepository<IUser> implements IUserRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'user');
  }

  async findByEmail(email: string): Promise<IUser | null> {
    try {
      const sanitizedEmail = sanitizationService.sanitizeEmailForSearch(email);
      const result = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail }
      });
      return result as IUser;
    } catch (error) {
      log.error(`Failed to find user by email`, error);
      throw error;
    }
  }

  async findByShopId(shopId: string): Promise<IUser[]> {
    try {
      const result = await this.prisma.user.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' }
      });
      return result as IUser[];
    } catch (error) {
      log.error(`Failed to find users by shop id: ${shopId}`, error);
      throw error;
    }
  }

  async findActiveUsers(shopId?: string): Promise<IUser[]> {
    const filters: any = { active: true };
    if (shopId) {
      filters.shopId = shopId;
    }
    
    return this.findMany(filters);
  }
}

/**
 * Session repository implementation
 */
export class SessionRepository extends BaseRepository<ISession> implements ISessionRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'session');
  }

  async findByShop(shop: string): Promise<ISession | null> {
    try {
      const result = await this.prisma.session.findFirst({
        where: { shop },
        orderBy: { createdAt: 'desc' }
      });
      return result as ISession;
    } catch (error) {
      log.error(`Failed to find session by shop: ${shop}`, error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<ISession[]> {
    try {
      const result = await this.prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      return result as ISession[];
    } catch (error) {
      log.error(`Failed to find sessions by user id: ${userId}`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 24); // 24 hours ago
      
      await this.prisma.session.deleteMany({
        where: {
          OR: [
            { expires: { lt: new Date() } },
            { createdAt: { lt: expiredDate } }
          ]
        }
      });
      
      log.info('Session cleanup completed');
    } catch (error) {
      log.error('Failed to cleanup sessions', error);
      throw error;
    }
  }

  async findActiveSessions(shopId?: string): Promise<ISession[]> {
    const filters: any = {
      OR: [
        { expires: { gt: new Date() } },
        { expires: null }
      ]
    };
    
    if (shopId) {
      filters.shopId = shopId;
    }
    
    return this.findMany(filters);
  }
}

/**
 * Transaction manager implementation
 */
export class TransactionManager implements ITransactionManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async begin(): Promise<ITransaction> {
    // Prisma handles transactions differently
    // This is a simplified implementation
    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      commit: async () => {
        // Prisma transactions are handled by the $transaction method
      },
      rollback: async () => {
        // Prisma transactions are handled by the $transaction method
      },
      isActive: () => true
    };
  }

  async commit(transaction: ITransaction): Promise<void> {
    await transaction.commit();
  }

  async rollback(transaction: ITransaction): Promise<void> {
    await transaction.rollback();
  }

  async executeInTransaction<T>(
    operation: (repositories: IUnitOfWork) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      const unitOfWork = new UnitOfWork(tx as PrismaClient);
      return await operation(unitOfWork);
    });
  }
}

/**
 * Unit of work implementation
 */
export class UnitOfWork implements IUnitOfWork {
  public registries: IRegistryRepository;
  public shops: IShopRepository;
  public users: IUserRepository;
  public sessions: ISessionRepository;
  
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.registries = new RegistryRepository(prisma);
    this.shops = new ShopRepository(prisma);
    this.users = new UserRepository(prisma);
    this.sessions = new SessionRepository(prisma);
  }

  async commit(): Promise<void> {
    // Prisma handles this automatically in transactions
    log.debug('Unit of work committed');
  }

  async rollback(): Promise<void> {
    // Prisma handles this automatically in transactions
    log.debug('Unit of work rolled back');
  }
}

/**
 * Repository factory implementation
 */
export class RepositoryFactory {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  createRegistryRepository(): IRegistryRepository {
    return new RegistryRepository(this.prisma);
  }

  createShopRepository(): IShopRepository {
    return new ShopRepository(this.prisma);
  }

  createUserRepository(): IUserRepository {
    return new UserRepository(this.prisma);
  }

  createSessionRepository(): ISessionRepository {
    return new SessionRepository(this.prisma);
  }

  createUnitOfWork(): IUnitOfWork {
    return new UnitOfWork(this.prisma);
  }

  createTransactionManager(): ITransactionManager {
    return new TransactionManager(this.prisma);
  }
}

/**
 * Repository registry for dependency injection
 */
export class RepositoryRegistry {
  private repositories = new Map<string, any>();
  private factory: RepositoryFactory;

  constructor(factory: RepositoryFactory) {
    this.factory = factory;
  }

  register<T>(name: string, repository: T): void {
    this.repositories.set(name, repository);
  }

  get<T>(name: string): T {
    if (!this.repositories.has(name)) {
      // Auto-create common repositories
      switch (name) {
        case 'registry':
          this.repositories.set(name, this.factory.createRegistryRepository());
          break;
        case 'shop':
          this.repositories.set(name, this.factory.createShopRepository());
          break;
        case 'user':
          this.repositories.set(name, this.factory.createUserRepository());
          break;
        case 'session':
          this.repositories.set(name, this.factory.createSessionRepository());
          break;
        default:
          throw new Error(`Repository ${name} not found`);
      }
    }
    
    return this.repositories.get(name) as T;
  }

  has(name: string): boolean {
    return this.repositories.has(name);
  }

  clear(): void {
    this.repositories.clear();
  }
}

/**
 * Specification implementations for complex queries
 */
export class RegistrySpecification {
  static activeRegistries() {
    return { status: 'active' };
  }

  static publicRegistries() {
    return { visibility: 'public' };
  }

  static byEventType(eventType: string) {
    return { eventType };
  }

  static byShop(shopId: string) {
    return { shopId };
  }

  static byCustomer(customerId: string) {
    return { customerId };
  }

  static recentlyCreated(days: number = 7) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return {
      createdAt: {
        gte: date
      }
    };
  }

  static withItems() {
    return {
      items: {
        some: {}
      }
    };
  }
}

/**
 * Query builder for complex database queries
 */
export class QueryBuilder {
  private query: any = {};
  private includes: any = {};
  private sorts: any = {};
  private pagination: any = {};

  where(conditions: any): QueryBuilder {
    this.query = { ...this.query, ...conditions };
    return this;
  }

  include(relations: any): QueryBuilder {
    this.includes = { ...this.includes, ...relations };
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'desc'): QueryBuilder {
    this.sorts = { ...this.sorts, [field]: direction };
    return this;
  }

  paginate(page: number = 1, limit: number = 20): QueryBuilder {
    this.pagination = {
      skip: (page - 1) * limit,
      take: limit
    };
    return this;
  }

  build(): any {
    return {
      where: this.query,
      include: this.includes,
      orderBy: this.sorts,
      ...this.pagination
    };
  }

  reset(): QueryBuilder {
    this.query = {};
    this.includes = {};
    this.sorts = {};
    this.pagination = {};
    return this;
  }
}

/**
 * Export factory function for easy integration
 */
export function createRepositoryFactory(prisma: PrismaClient): RepositoryFactory {
  return new RepositoryFactory(prisma);
}

export function createRepositoryRegistry(factory: RepositoryFactory): RepositoryRegistry {
  return new RepositoryRegistry(factory);
}

export function createQueryBuilder(): QueryBuilder {
  return new QueryBuilder();
}