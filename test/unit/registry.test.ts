import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createRegistry,
  getRegistry,
  updateRegistry,
  deleteRegistry,
  getRegistryWithItems,
  addItemToRegistry,
  removeItemFromRegistry,
  updateRegistryItem,
  validateRegistryData,
  generateUniqueSlug
} from '~/lib/registry.server';
import { db } from '~/lib/db.server';

// Mock Prisma
vi.mock('~/lib/db.server', () => ({
  db: {
    registry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn()
    },
    registryItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn()
    },
    registryActivity: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

describe('Registry CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRegistry', () => {
    it('should create a new registry with valid data', async () => {
      const mockRegistry = {
        id: 'reg_123',
        title: 'Wedding Registry',
        slug: 'wedding-registry',
        description: 'Our wedding registry',
        customerId: 'cust_123',
        shopId: 'shop_123',
        visibility: 'public',
        eventDate: new Date('2024-12-25'),
        eventType: 'wedding',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(db.registry.findFirst).mockResolvedValue(null);
      vi.mocked(db.registry.create).mockResolvedValue(mockRegistry);
      vi.mocked(db.registryActivity.create).mockResolvedValue({} as any);

      const registryData = {
        title: 'Wedding Registry',
        description: 'Our wedding registry',
        customerId: 'cust_123',
        customerEmail: 'test@example.com',
        customerFirstName: 'John',
        customerLastName: 'Doe',
        shopId: 'shop_123',
        visibility: 'public' as const,
        eventDate: new Date('2024-12-25'),
        eventType: 'wedding'
      };

      const result = await createRegistry(registryData);

      expect(result).toEqual(mockRegistry);
      expect(db.registry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Wedding Registry',
          description: 'Our wedding registry',
          customerId: 'cust_123',
          slug: expect.stringMatching(/^wedding-registry(-\d+)?$/),
          isActive: true
        })
      });
      expect(db.registryActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          registryId: 'reg_123',
          type: 'created',
          description: 'Registry created'
        })
      });
    });

    it('should generate unique slug if duplicate exists', async () => {
      const existingRegistry = {
        id: 'existing_123',
        slug: 'wedding-registry'
      };

      vi.mocked(db.registry.findFirst)
        .mockResolvedValueOnce(existingRegistry as any)
        .mockResolvedValueOnce(null);
      
      vi.mocked(db.registry.create).mockResolvedValue({
        id: 'new_123',
        slug: 'wedding-registry-1'
      } as any);

      const registryData = {
        title: 'Wedding Registry',
        customerId: 'cust_123',
        customerEmail: 'test@example.com',
        customerFirstName: 'John',
        customerLastName: 'Doe',
        shopId: 'shop_123'
      };

      const result = await createRegistry(registryData);

      expect(db.registry.findFirst).toHaveBeenCalledTimes(2);
      expect(result.slug).toMatch(/^wedding-registry-\d+$/);
    });

    it('should validate registry data before creation', async () => {
      const invalidData = {
        title: '', // Empty title
        customerId: 'cust_123',
        customerEmail: 'invalid-email', // Invalid email
        shopId: 'shop_123'
      };

      await expect(createRegistry(invalidData as any)).rejects.toThrow('Invalid registry data');
    });

    it('should handle creation errors gracefully', async () => {
      vi.mocked(db.registry.create).mockRejectedValue(new Error('Database error'));

      const registryData = {
        title: 'Test Registry',
        customerId: 'cust_123',
        customerEmail: 'test@example.com',
        customerFirstName: 'John',
        customerLastName: 'Doe',
        shopId: 'shop_123'
      };

      await expect(createRegistry(registryData)).rejects.toThrow('Failed to create registry');
    });
  });

  describe('getRegistry', () => {
    it('should retrieve registry by ID', async () => {
      const mockRegistry = {
        id: 'reg_123',
        title: 'Wedding Registry',
        slug: 'wedding-registry',
        items: [],
        _count: { items: 0 }
      };

      vi.mocked(db.registry.findUnique).mockResolvedValue(mockRegistry as any);

      const result = await getRegistry('reg_123');

      expect(result).toEqual(mockRegistry);
      expect(db.registry.findUnique).toHaveBeenCalledWith({
        where: { id: 'reg_123' },
        include: {
          items: {
            include: {
              purchases: true
            }
          },
          shippingAddress: true,
          collaborators: true,
          analytics: true,
          _count: {
            select: {
              items: true,
              collaborators: true
            }
          }
        }
      });
    });

    it('should retrieve registry by slug', async () => {
      const mockRegistry = {
        id: 'reg_123',
        title: 'Wedding Registry',
        slug: 'wedding-registry'
      };

      vi.mocked(db.registry.findFirst).mockResolvedValue(mockRegistry as any);

      const result = await getRegistry('wedding-registry');

      expect(result).toEqual(mockRegistry);
      expect(db.registry.findFirst).toHaveBeenCalledWith({
        where: { slug: 'wedding-registry' },
        include: expect.any(Object)
      });
    });

    it('should return null if registry not found', async () => {
      vi.mocked(db.registry.findUnique).mockResolvedValue(null);
      vi.mocked(db.registry.findFirst).mockResolvedValue(null);

      const result = await getRegistry('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateRegistry', () => {
    it('should update registry with valid data', async () => {
      const updatedRegistry = {
        id: 'reg_123',
        title: 'Updated Wedding Registry',
        description: 'Updated description'
      };

      vi.mocked(db.registry.update).mockResolvedValue(updatedRegistry as any);
      vi.mocked(db.registryActivity.create).mockResolvedValue({} as any);

      const updates = {
        title: 'Updated Wedding Registry',
        description: 'Updated description'
      };

      const result = await updateRegistry('reg_123', updates);

      expect(result).toEqual(updatedRegistry);
      expect(db.registry.update).toHaveBeenCalledWith({
        where: { id: 'reg_123' },
        data: expect.objectContaining({
          title: 'Updated Wedding Registry',
          description: 'Updated description',
          updatedAt: expect.any(Date)
        })
      });
    });

    it('should log activity when updating registry', async () => {
      vi.mocked(db.registry.update).mockResolvedValue({ id: 'reg_123' } as any);
      vi.mocked(db.registryActivity.create).mockResolvedValue({} as any);

      await updateRegistry('reg_123', { title: 'New Title' });

      expect(db.registryActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          registryId: 'reg_123',
          type: 'updated',
          description: 'Registry settings updated'
        })
      });
    });

    it('should handle update errors gracefully', async () => {
      vi.mocked(db.registry.update).mockRejectedValue(new Error('Database error'));

      await expect(updateRegistry('reg_123', { title: 'New' })).rejects.toThrow('Failed to update registry');
    });
  });

  describe('deleteRegistry', () => {
    it('should soft delete registry', async () => {
      vi.mocked(db.registry.update).mockResolvedValue({ id: 'reg_123' } as any);
      vi.mocked(db.registryActivity.create).mockResolvedValue({} as any);

      const result = await deleteRegistry('reg_123');

      expect(result).toBe(true);
      expect(db.registry.update).toHaveBeenCalledWith({
        where: { id: 'reg_123' },
        data: {
          isActive: false,
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should handle deletion errors gracefully', async () => {
      vi.mocked(db.registry.update).mockRejectedValue(new Error('Database error'));

      await expect(deleteRegistry('reg_123')).rejects.toThrow('Failed to delete registry');
    });
  });

  describe('addItemToRegistry', () => {
    it('should add item to registry with valid data', async () => {
      const mockItem = {
        id: 'item_123',
        registryId: 'reg_123',
        productId: 'prod_123',
        productTitle: 'Wedding Dress',
        quantity: 1,
        price: 299.99
      };

      vi.mocked(db.registryItem.create).mockResolvedValue(mockItem as any);
      vi.mocked(db.registryActivity.create).mockResolvedValue({} as any);

      const itemData = {
        productId: 'prod_123',
        productVariantId: 'var_123',
        productTitle: 'Wedding Dress',
        quantity: 1,
        price: 299.99
      };

      const result = await addItemToRegistry('reg_123', itemData);

      expect(result).toEqual(mockItem);
      expect(db.registryItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          registryId: 'reg_123',
          productId: 'prod_123',
          quantity: 1,
          status: 'available'
        })
      });
    });

    it('should validate item data before adding', async () => {
      const invalidItem = {
        productId: '',
        quantity: -1,
        price: -100
      };

      await expect(addItemToRegistry('reg_123', invalidItem as any)).rejects.toThrow('Invalid item data');
    });

    it('should handle duplicate items appropriately', async () => {
      vi.mocked(db.registryItem.create).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed'
      });

      const itemData = {
        productId: 'prod_123',
        productVariantId: 'var_123',
        productTitle: 'Existing Item',
        quantity: 1,
        price: 100
      };

      await expect(addItemToRegistry('reg_123', itemData)).rejects.toThrow('Item already exists in registry');
    });
  });

  describe('removeItemFromRegistry', () => {
    it('should remove item from registry', async () => {
      vi.mocked(db.registryItem.delete).mockResolvedValue({ id: 'item_123' } as any);
      vi.mocked(db.registryActivity.create).mockResolvedValue({} as any);

      const result = await removeItemFromRegistry('item_123');

      expect(result).toBe(true);
      expect(db.registryItem.delete).toHaveBeenCalledWith({
        where: { id: 'item_123' }
      });
    });

    it('should handle removal errors gracefully', async () => {
      vi.mocked(db.registryItem.delete).mockRejectedValue(new Error('Database error'));

      await expect(removeItemFromRegistry('item_123')).rejects.toThrow('Failed to remove item');
    });
  });

  describe('updateRegistryItem', () => {
    it('should update item quantity', async () => {
      const updatedItem = {
        id: 'item_123',
        quantity: 3,
        priority: 'high'
      };

      vi.mocked(db.registryItem.update).mockResolvedValue(updatedItem as any);

      const result = await updateRegistryItem('item_123', { quantity: 3, priority: 'high' });

      expect(result).toEqual(updatedItem);
      expect(db.registryItem.update).toHaveBeenCalledWith({
        where: { id: 'item_123' },
        data: expect.objectContaining({
          quantity: 3,
          priority: 'high'
        })
      });
    });

    it('should validate quantity is positive', async () => {
      await expect(updateRegistryItem('item_123', { quantity: -1 })).rejects.toThrow('Invalid quantity');
    });
  });

  describe('validateRegistryData', () => {
    it('should validate required fields', () => {
      const validData = {
        title: 'Valid Title',
        customerId: 'cust_123',
        customerEmail: 'valid@email.com',
        shopId: 'shop_123'
      };

      expect(() => validateRegistryData(validData)).not.toThrow();
    });

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        customerId: 'cust_123',
        customerEmail: 'valid@email.com',
        shopId: 'shop_123'
      };

      expect(() => validateRegistryData(invalidData)).toThrow('Title is required');
    });

    it('should reject invalid email', () => {
      const invalidData = {
        title: 'Title',
        customerId: 'cust_123',
        customerEmail: 'not-an-email',
        shopId: 'shop_123'
      };

      expect(() => validateRegistryData(invalidData)).toThrow('Invalid email address');
    });

    it('should validate visibility options', () => {
      const validVisibilities = ['public', 'private', 'password', 'friends_only'];
      
      validVisibilities.forEach(visibility => {
        const data = {
          title: 'Title',
          customerId: 'cust_123',
          customerEmail: 'test@example.com',
          shopId: 'shop_123',
          visibility
        };

        expect(() => validateRegistryData(data)).not.toThrow();
      });

      const invalidData = {
        title: 'Title',
        customerId: 'cust_123',
        customerEmail: 'test@example.com',
        shopId: 'shop_123',
        visibility: 'invalid_option'
      };

      expect(() => validateRegistryData(invalidData)).toThrow('Invalid visibility option');
    });

    it('should validate event date is in the future', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const invalidData = {
        title: 'Title',
        customerId: 'cust_123',
        customerEmail: 'test@example.com',
        shopId: 'shop_123',
        eventDate: pastDate
      };

      expect(() => validateRegistryData(invalidData)).toThrow('Event date must be in the future');
    });
  });

  describe('generateUniqueSlug', () => {
    it('should generate slug from title', () => {
      const slug = generateUniqueSlug('My Wedding Registry');
      expect(slug).toMatch(/^my-wedding-registry(-\d+)?$/);
    });

    it('should handle special characters', () => {
      const slug = generateUniqueSlug('John & Jane\'s Registry!');
      expect(slug).toMatch(/^john-jane-s-registry(-\d+)?$/);
    });

    it('should handle multiple spaces', () => {
      const slug = generateUniqueSlug('  Too   Many   Spaces  ');
      expect(slug).toMatch(/^too-many-spaces(-\d+)?$/);
    });

    it('should append timestamp for uniqueness', () => {
      const slug1 = generateUniqueSlug('Same Title');
      const slug2 = generateUniqueSlug('Same Title');
      expect(slug1).not.toEqual(slug2);
    });
  });
});