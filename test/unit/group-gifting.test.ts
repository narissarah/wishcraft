import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createGroupGift,
  addContribution,
  completeGroupGift,
  handleIncompleteGroupGift,
  getGroupGiftProgress
} from '~/lib/group-gifting.server';
import { db } from '~/lib/db.server';
import { shopifyApi } from '~/lib/shopify-api.server';
import { sendEmail } from '~/lib/email.server';

// Mock dependencies
vi.mock('~/lib/db.server', () => ({
  db: {
    registryItem: {
      findUnique: vi.fn()
    },
    groupGift: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    groupGiftContribution: {
      create: vi.fn(),
      update: vi.fn()
    },
    registryActivity: {
      create: vi.fn()
    }
  }
}));

vi.mock('~/lib/shopify-api.server', () => ({
  shopifyApi: {
    request: vi.fn()
  }
}));

vi.mock('~/lib/email.server', () => ({
  sendEmail: vi.fn()
}));

describe('Group Gifting System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroupGift', () => {
    it('should create a new group gift session', async () => {
      const mockRegistryItem = {
        id: 'item_123',
        registryId: 'reg_123',
        productTitle: 'Wedding Photo Album',
        price: 150
      };

      const mockGroupGift = {
        id: 'gg_123',
        registryItemId: 'item_123',
        targetAmount: 150,
        currentAmount: 0,
        organizerEmail: 'organizer@example.com',
        organizerName: 'Jane Smith',
        title: 'Wedding Photo Album Group Gift',
        status: 'active',
        slug: 'wedding-photo-album-group-gift-123'
      };

      vi.mocked(db.registryItem.findUnique).mockResolvedValue(mockRegistryItem as any);
      vi.mocked(db.groupGift.create).mockResolvedValue(mockGroupGift as any);
      vi.mocked(db.registryActivity.create).mockResolvedValue({} as any);

      const groupGiftData = {
        registryItemId: 'item_123',
        targetAmount: 150,
        organizerEmail: 'organizer@example.com',
        organizerName: 'Jane Smith',
        title: 'Wedding Photo Album Group Gift'
      };

      const result = await createGroupGift(groupGiftData);

      expect(result).toEqual(mockGroupGift);
      expect(db.groupGift.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          registryItemId: 'item_123',
          targetAmount: 150,
          currentAmount: 0,
          status: 'active',
          allowAnonymous: true,
          showContributorList: true,
          minimumContribution: 5.00,
          autoOrderOnTarget: true
        })
      });
    });

    it('should reject group gift if registry item not found', async () => {
      vi.mocked(db.registryItem.findUnique).mockResolvedValue(null);

      const groupGiftData = {
        registryItemId: 'non_existent',
        targetAmount: 100,
        organizerEmail: 'test@example.com',
        organizerName: 'Test User',
        title: 'Test Group Gift'
      };

      await expect(createGroupGift(groupGiftData)).rejects.toThrow('Registry item not found');
    });

    it('should set custom minimum contribution', async () => {
      vi.mocked(db.registryItem.findUnique).mockResolvedValue({ id: 'item_123' } as any);
      vi.mocked(db.groupGift.create).mockResolvedValue({ id: 'gg_123' } as any);

      const groupGiftData = {
        registryItemId: 'item_123',
        targetAmount: 500,
        organizerEmail: 'test@example.com',
        organizerName: 'Test User',
        title: 'Expensive Item',
        minimumContribution: 25
      };

      await createGroupGift(groupGiftData);

      expect(db.groupGift.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          minimumContribution: 25
        })
      });
    });

    it('should set deadline if provided', async () => {
      vi.mocked(db.registryItem.findUnique).mockResolvedValue({ id: 'item_123' } as any);
      vi.mocked(db.groupGift.create).mockResolvedValue({ id: 'gg_123' } as any);

      const deadline = new Date('2024-12-25');
      const groupGiftData = {
        registryItemId: 'item_123',
        targetAmount: 200,
        organizerEmail: 'test@example.com',
        organizerName: 'Test User',
        title: 'Christmas Gift',
        deadline
      };

      await createGroupGift(groupGiftData);

      expect(db.groupGift.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deadline
        })
      });
    });
  });

  describe('addContribution', () => {
    const mockGroupGift = {
      id: 'gg_123',
      registryItemId: 'item_123',
      targetAmount: 100,
      currentAmount: 50,
      status: 'active',
      minimumContribution: 5,
      allowAnonymous: true,
      autoOrderOnTarget: true,
      registryItem: {
        id: 'item_123',
        registryId: 'reg_123',
        productTitle: 'Test Product'
      },
      contributions: []
    };

    it('should add contribution to active group gift', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);
      vi.mocked(db.groupGiftContribution.create).mockResolvedValue({
        id: 'contrib_123',
        amount: 25
      } as any);
      vi.mocked(db.groupGift.update).mockResolvedValue({
        ...mockGroupGift,
        currentAmount: 75
      } as any);

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'contributor@example.com',
        contributorName: 'John Doe',
        amount: 25
      };

      const result = await addContribution(contribution);

      expect(result).toHaveProperty('id', 'contrib_123');
      expect(db.groupGiftContribution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 25,
          status: 'completed',
          isAnonymous: false
        })
      });
      expect(db.groupGift.update).toHaveBeenCalledWith({
        where: { id: 'gg_123' },
        data: { currentAmount: 75 }
      });
    });

    it('should reject contribution below minimum amount', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'test@example.com',
        contributorName: 'Test User',
        amount: 2 // Below minimum of 5
      };

      await expect(addContribution(contribution)).rejects.toThrow('Minimum contribution is 5');
    });

    it('should reject contribution if group gift is not active', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        ...mockGroupGift,
        status: 'completed'
      } as any);

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'test@example.com',
        contributorName: 'Test User',
        amount: 10
      };

      await expect(addContribution(contribution)).rejects.toThrow('Group gift is not active');
    });

    it('should reject contribution if deadline has passed', async () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 1);

      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        ...mockGroupGift,
        deadline: pastDeadline
      } as any);

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'test@example.com',
        contributorName: 'Test User',
        amount: 10
      };

      await expect(addContribution(contribution)).rejects.toThrow('Group gift deadline has passed');
    });

    it('should reject contribution that exceeds target amount', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        ...mockGroupGift,
        currentAmount: 90,
        targetAmount: 100
      } as any);

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'test@example.com',
        contributorName: 'Test User',
        amount: 20 // Would make total 110, exceeding target of 100
      };

      await expect(addContribution(contribution)).rejects.toThrow('Contribution would exceed target amount');
    });

    it('should support anonymous contributions', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);
      vi.mocked(db.groupGiftContribution.create).mockResolvedValue({
        id: 'contrib_123',
        isAnonymous: true
      } as any);
      vi.mocked(db.groupGift.update).mockResolvedValue({} as any);

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'anon@example.com',
        contributorName: 'Anonymous',
        amount: 25,
        isAnonymous: true
      };

      const result = await addContribution(contribution);

      expect(db.groupGiftContribution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isAnonymous: true
        })
      });
    });

    it('should trigger completion when target is reached', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        ...mockGroupGift,
        currentAmount: 75,
        targetAmount: 100,
        autoOrderOnTarget: true
      } as any);
      vi.mocked(db.groupGiftContribution.create).mockResolvedValue({} as any);
      vi.mocked(db.groupGift.update).mockResolvedValue({} as any);
      vi.mocked(db.registryItem.update).mockResolvedValue({} as any);
      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          orderCreate: {
            order: { id: 'order_123', name: '#1001' },
            userErrors: []
          }
        }
      });

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'test@example.com',
        contributorName: 'Test User',
        amount: 25 // Makes total exactly 100
      };

      await addContribution(contribution);

      expect(db.groupGift.update).toHaveBeenCalledWith({
        where: { id: 'gg_123' },
        data: expect.objectContaining({
          status: 'completed'
        })
      });
    });

    it('should enforce maximum contributors limit', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        ...mockGroupGift,
        maxContributors: 2,
        contributions: [{ id: '1' }, { id: '2' }] // Already 2 contributors
      } as any);

      const contribution = {
        groupGiftId: 'gg_123',
        contributorEmail: 'test@example.com',
        contributorName: 'Test User',
        amount: 10
      };

      await expect(addContribution(contribution)).rejects.toThrow('Maximum number of contributors reached');
    });
  });

  describe('completeGroupGift', () => {
    it('should complete group gift and create order', async () => {
      const mockGroupGift = {
        id: 'gg_123',
        status: 'active',
        currentAmount: 100,
        targetAmount: 100,
        registryItem: {
          id: 'item_123',
          registryId: 'reg_123',
          productVariantId: 'var_123',
          quantity: 1,
          registry: {
            customerId: 'cust_123',
            shippingAddress: {
              address1: '123 Main St',
              city: 'Anytown',
              province: 'CA',
              zip: '12345',
              country: 'US'
            }
          }
        },
        contributions: [
          { id: 'contrib_1', amount: 50, status: 'completed' },
          { id: 'contrib_2', amount: 50, status: 'completed' }
        ]
      };

      const mockOrder = {
        id: 'order_123',
        name: '#1001'
      };

      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);
      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          orderCreate: {
            order: mockOrder,
            userErrors: []
          }
        }
      });
      vi.mocked(db.groupGift.update).mockResolvedValue({} as any);
      vi.mocked(db.registryItem.update).mockResolvedValue({} as any);

      const result = await completeGroupGift('gg_123');

      expect(result).toEqual(mockOrder);
      expect(shopifyApi.request).toHaveBeenCalledWith(
        expect.stringContaining('orderCreate'),
        expect.objectContaining({
          variables: {
            order: expect.objectContaining({
              lineItems: expect.arrayContaining([
                expect.objectContaining({
                  variantId: 'var_123',
                  quantity: 1
                })
              ])
            })
          }
        })
      );
      expect(db.groupGift.update).toHaveBeenCalledWith({
        where: { id: 'gg_123' },
        data: {
          status: 'completed',
          shopifyOrderId: 'order_123'
        }
      });
    });

    it('should reject completion if group gift not found', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue(null);

      await expect(completeGroupGift('non_existent')).rejects.toThrow('Group gift not found');
    });

    it('should reject completion if already completed', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        id: 'gg_123',
        status: 'completed'
      } as any);

      await expect(completeGroupGift('gg_123')).rejects.toThrow('Group gift is not active');
    });

    it('should handle Shopify order creation errors', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        id: 'gg_123',
        status: 'active',
        registryItem: { registry: {} },
        contributions: []
      } as any);
      
      vi.mocked(shopifyApi.request).mockResolvedValue({
        data: {
          orderCreate: {
            order: null,
            userErrors: [{ message: 'Invalid variant ID' }]
          }
        }
      });

      await expect(completeGroupGift('gg_123')).rejects.toThrow('Order creation failed: Invalid variant ID');
    });
  });

  describe('handleIncompleteGroupGift', () => {
    it('should process refunds for all contributions', async () => {
      const mockGroupGift = {
        id: 'gg_123',
        contributions: [
          { id: 'contrib_1', amount: 50, status: 'completed', paymentIntentId: 'pi_1' },
          { id: 'contrib_2', amount: 25, status: 'completed', paymentIntentId: 'pi_2' }
        ]
      };

      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);
      vi.mocked(db.groupGiftContribution.update).mockResolvedValue({} as any);
      vi.mocked(db.groupGift.update).mockResolvedValue({} as any);

      const result = await handleIncompleteGroupGift('gg_123');

      expect(result).toBe(true);
      expect(db.groupGiftContribution.update).toHaveBeenCalledTimes(2);
      expect(db.groupGiftContribution.update).toHaveBeenCalledWith({
        where: { id: 'contrib_1' },
        data: { status: 'refunded' }
      });
      expect(db.groupGift.update).toHaveBeenCalledWith({
        where: { id: 'gg_123' },
        data: { status: 'cancelled' }
      });
    });

    it('should handle refund processing errors gracefully', async () => {
      vi.mocked(db.groupGift.findUnique).mockResolvedValue({
        id: 'gg_123',
        contributions: [{ id: 'contrib_1', amount: 50, paymentIntentId: 'pi_1' }]
      } as any);
      vi.mocked(db.groupGiftContribution.update).mockRejectedValue(new Error('Database error'));

      await expect(handleIncompleteGroupGift('gg_123')).rejects.toThrow('Failed to process refunds');
    });
  });

  describe('getGroupGiftProgress', () => {
    it('should calculate progress correctly', async () => {
      const mockGroupGift = {
        id: 'gg_123',
        currentAmount: 75,
        targetAmount: 100,
        deadline: new Date('2024-12-25'),
        contributions: [
          { id: 'contrib_1', amount: 50 },
          { id: 'contrib_2', amount: 25 }
        ],
        registryItem: {
          registry: {}
        }
      };

      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);

      const result = await getGroupGiftProgress('gg_123');

      expect(result.progressPercentage).toBe(75);
      expect(result.remainingAmount).toBe(25);
      expect(result.isCompleted).toBe(false);
      expect(result.daysRemaining).toBeGreaterThan(0);
    });

    it('should handle completed group gifts', async () => {
      const mockGroupGift = {
        id: 'gg_123',
        currentAmount: 100,
        targetAmount: 100,
        contributions: [],
        registryItem: { registry: {} }
      };

      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);

      const result = await getGroupGiftProgress('gg_123');

      expect(result.progressPercentage).toBe(100);
      expect(result.remainingAmount).toBe(0);
      expect(result.isCompleted).toBe(true);
    });

    it('should handle overfunded group gifts', async () => {
      const mockGroupGift = {
        id: 'gg_123',
        currentAmount: 120,
        targetAmount: 100,
        contributions: [],
        registryItem: { registry: {} }
      };

      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);

      const result = await getGroupGiftProgress('gg_123');

      expect(result.progressPercentage).toBe(100); // Capped at 100
      expect(result.remainingAmount).toBe(0); // Can't be negative
    });

    it('should detect expired group gifts', async () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 1);

      const mockGroupGift = {
        id: 'gg_123',
        currentAmount: 50,
        targetAmount: 100,
        deadline: pastDeadline,
        contributions: [],
        registryItem: { registry: {} }
      };

      vi.mocked(db.groupGift.findUnique).mockResolvedValue(mockGroupGift as any);

      const result = await getGroupGiftProgress('gg_123');

      expect(result.isExpired).toBe(true);
      expect(result.daysRemaining).toBeLessThan(0);
    });
  });
});