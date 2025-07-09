import { db } from "~/lib/db.server";
import { createShopifyAPI } from "~/lib/shopify-api.server";
import { sendEmail } from "~/lib/email.server";

// ============================================================================
// GROUP GIFTING CORE SYSTEM
// ============================================================================

export interface GroupGiftContribution {
  id: string;
  groupGiftId: string;
  contributorId?: string;
  contributorEmail: string;
  contributorName: string;
  amount: number;
  isAnonymous: boolean;
  message?: string;
  paymentIntentId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupGiftSession {
  id: string;
  registryItemId: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date;
  organizerEmail: string;
  organizerName: string;
  title: string;
  description?: string;
  allowAnonymous: boolean;
  showContributorList: boolean;
  minimumContribution: number;
  maxContributors?: number;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
  autoOrderOnTarget: boolean;
  shippingAddress?: any;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// GROUP GIFT CREATION AND MANAGEMENT
// ============================================================================

export async function createGroupGift(data: {
  registryItemId: string;
  targetAmount: number;
  organizerEmail: string;
  organizerName: string;
  title: string;
  description?: string;
  deadline?: Date;
  allowAnonymous?: boolean;
  showContributorList?: boolean;
  minimumContribution?: number;
  maxContributors?: number;
  autoOrderOnTarget?: boolean;
  shippingAddress?: any;
}): Promise<GroupGiftSession> {
  try {
    // Verify registry item exists and get details
    const registryItem = await db.registryItem.findUnique({
      where: { id: data.registryItemId },
      include: {
        registry: true
      }
    });

    if (!registryItem) {
      throw new Error('Registry item not found');
    }

    // Create group gift session
    const groupGift = await db.groupGift.create({
      data: {
        registryItemId: data.registryItemId,
        targetAmount: data.targetAmount,
        currentAmount: 0,
        deadline: data.deadline,
        organizerEmail: data.organizerEmail,
        organizerName: data.organizerName,
        title: data.title,
        description: data.description,
        allowAnonymous: data.allowAnonymous ?? true,
        showContributorList: data.showContributorList ?? true,
        minimumContribution: data.minimumContribution ?? 5.00,
        maxContributors: data.maxContributors,
        status: 'active',
        autoOrderOnTarget: data.autoOrderOnTarget ?? true,
        shippingAddress: data.shippingAddress,
        slug: generateGroupGiftSlug(data.title)
      }
    });

    // Log activity
    await db.registryActivity.create({
      data: {
        registryId: registryItem.registryId,
        type: 'group_gift_created',
        description: `Group gift "${data.title}" created for ${registryItem.productTitle}`,
        actorType: 'organizer',
        actorEmail: data.organizerEmail,
        actorName: data.organizerName,
        metadata: {
          groupGiftId: groupGift.id,
          targetAmount: data.targetAmount
        }
      }
    });

    return groupGift as GroupGiftSession;
  } catch (error) {
    console.error('Failed to create group gift:', error);
    throw new Error('Failed to create group gift');
  }
}

export async function addContribution(data: {
  groupGiftId: string;
  contributorEmail: string;
  contributorName: string;
  amount: number;
  isAnonymous?: boolean;
  message?: string;
  paymentIntentId?: string;
}): Promise<GroupGiftContribution> {
  try {
    // Get group gift details
    const groupGift = await db.groupGift.findUnique({
      where: { id: data.groupGiftId },
      include: {
        registryItem: {
          include: {
            registry: true
          }
        },
        contributions: true
      }
    });

    if (!groupGift) {
      throw new Error('Group gift not found');
    }

    if (groupGift.status !== 'active') {
      throw new Error('Group gift is not active');
    }

    // Check deadline
    if (groupGift.deadline && new Date() > groupGift.deadline) {
      throw new Error('Group gift deadline has passed');
    }

    // Check minimum contribution
    if (data.amount < groupGift.minimumContribution) {
      throw new Error(`Minimum contribution is ${groupGift.minimumContribution}`);
    }

    // Check max contributors
    if (groupGift.maxContributors && groupGift.contributions.length >= groupGift.maxContributors) {
      throw new Error('Maximum number of contributors reached');
    }

    // Check if amount would exceed target
    const newTotal = groupGift.currentAmount + data.amount;
    if (newTotal > groupGift.targetAmount) {
      throw new Error('Contribution would exceed target amount');
    }

    // Create contribution
    const contribution = await db.groupGiftContribution.create({
      data: {
        groupGiftId: data.groupGiftId,
        contributorEmail: data.contributorEmail,
        contributorName: data.contributorName,
        amount: data.amount,
        isAnonymous: data.isAnonymous ?? false,
        message: data.message,
        paymentIntentId: data.paymentIntentId,
        status: 'completed'
      }
    });

    // Update group gift current amount
    const updatedGroupGift = await db.groupGift.update({
      where: { id: data.groupGiftId },
      data: {
        currentAmount: newTotal
      }
    });

    // Log activity
    await db.registryActivity.create({
      data: {
        registryId: groupGift.registryItem.registryId,
        type: 'group_gift_contribution',
        description: `${data.isAnonymous ? 'Anonymous contributor' : data.contributorName} contributed $${data.amount} to group gift`,
        actorType: 'contributor',
        actorEmail: data.contributorEmail,
        actorName: data.contributorName,
        metadata: {
          groupGiftId: data.groupGiftId,
          amount: data.amount,
          isAnonymous: data.isAnonymous
        }
      }
    });

    // Check if target is reached
    if (newTotal >= groupGift.targetAmount && groupGift.autoOrderOnTarget) {
      await completeGroupGift(data.groupGiftId);
    }

    // Send notification emails
    await sendContributionNotifications(groupGift, contribution, newTotal);

    return contribution as GroupGiftContribution;
  } catch (error) {
    console.error('Failed to add contribution:', error);
    throw new Error('Failed to add contribution');
  }
}

// ============================================================================
// GROUP GIFT COMPLETION AND ORDERING
// ============================================================================

export async function completeGroupGift(groupGiftId: string) {
  try {
    const groupGift = await db.groupGift.findUnique({
      where: { id: groupGiftId },
      include: {
        registryItem: {
          include: {
            registry: true
          }
        },
        contributions: {
          where: { status: 'completed' }
        }
      }
    });

    if (!groupGift) {
      throw new Error('Group gift not found');
    }

    if (groupGift.status !== 'active') {
      throw new Error('Group gift is not active');
    }

    // Create Shopify order
    const order = await createGroupGiftOrder(groupGift);

    // Update group gift status
    await db.groupGift.update({
      where: { id: groupGiftId },
      data: {
        status: 'completed',
        shopifyOrderId: order.id
      }
    });

    // Mark registry item as purchased
    await db.registryItem.update({
      where: { id: groupGift.registryItemId },
      data: {
        status: 'purchased',
        purchasedAt: new Date()
      }
    });

    // Log completion
    await db.registryActivity.create({
      data: {
        registryId: groupGift.registryItem.registryId,
        type: 'group_gift_completed',
        description: `Group gift "${groupGift.title}" completed and order created`,
        actorType: 'system',
        metadata: {
          groupGiftId: groupGiftId,
          orderId: order.id,
          totalAmount: groupGift.currentAmount
        }
      }
    });

    // Send completion notifications
    await sendGroupGiftCompletionNotifications(groupGift, order);

    return order;
  } catch (error) {
    console.error('Failed to complete group gift:', error);
    throw new Error('Failed to complete group gift');
  }
}

async function createGroupGiftOrder(groupGift: any) {
  const mutation = `#graphql
    mutation CreateOrder($order: OrderInput!) {
      orderCreate(order: $order) {
        order {
          id
          name
          totalPrice {
            amount
            currencyCode
          }
          customer {
            id
            email
          }
          shippingAddress {
            address1
            city
            province
            zip
            country
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const orderData = {
    customerId: groupGift.registryItem.registry.customerId,
    email: groupGift.organizerEmail,
    lineItems: [
      {
        variantId: groupGift.registryItem.productVariantId,
        quantity: groupGift.registryItem.quantity || 1,
        customAttributes: [
          {
            key: 'group_gift_id',
            value: groupGift.id
          },
          {
            key: 'gift_type',
            value: 'group_gift'
          }
        ]
      }
    ],
    shippingAddress: groupGift.shippingAddress || groupGift.registryItem.registry.shippingAddress,
    tags: ['wishcraft', 'group-gift'],
    note: `Group gift: ${groupGift.title}. Contributors: ${groupGift.contributions.length}`,
    metafields: [
      {
        namespace: 'wishcraft',
        key: 'group_gift_id',
        value: groupGift.id,
        type: 'single_line_text_field'
      }
    ]
  };

  const response = await shopifyApi.request(mutation, {
    variables: { order: orderData }
  });

  if (response.data.orderCreate.userErrors.length > 0) {
    throw new Error(`Order creation failed: ${response.data.orderCreate.userErrors[0].message}`);
  }

  return response.data.orderCreate.order;
}

// ============================================================================
// REFUND HANDLING
// ============================================================================

export async function handleIncompleteGroupGift(groupGiftId: string) {
  try {
    const groupGift = await db.groupGift.findUnique({
      where: { id: groupGiftId },
      include: {
        contributions: {
          where: { status: 'completed' }
        }
      }
    });

    if (!groupGift) {
      throw new Error('Group gift not found');
    }

    // Process refunds for all contributions
    const refundPromises = groupGift.contributions.map(async (contribution) => {
      if (contribution.paymentIntentId) {
        // In a real implementation, you would integrate with Shopify Payments
        // or your payment processor to handle refunds
        await processRefund(contribution.paymentIntentId, contribution.amount);
        
        // Update contribution status
        await db.groupGiftContribution.update({
          where: { id: contribution.id },
          data: { status: 'refunded' }
        });
      }
    });

    await Promise.all(refundPromises);

    // Update group gift status
    await db.groupGift.update({
      where: { id: groupGiftId },
      data: { status: 'cancelled' }
    });

    // Send refund notifications
    await sendRefundNotifications(groupGift);

    return true;
  } catch (error) {
    console.error('Failed to handle incomplete group gift:', error);
    throw new Error('Failed to process refunds');
  }
}

async function processRefund(paymentIntentId: string, amount: number) {
  // This would integrate with your payment processor
  // For Shopify Payments, you'd use the Admin API
  console.log(`Processing refund for payment ${paymentIntentId}: $${amount}`);
  
  // Placeholder for actual refund processing
  return true;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateGroupGiftSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);
}

export async function getGroupGiftProgress(groupGiftId: string) {
  const groupGift = await db.groupGift.findUnique({
    where: { id: groupGiftId },
    include: {
      contributions: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' }
      },
      registryItem: {
        include: {
          registry: true
        }
      }
    }
  });

  if (!groupGift) {
    throw new Error('Group gift not found');
  }

  const progressPercentage = (groupGift.currentAmount / groupGift.targetAmount) * 100;
  const remainingAmount = groupGift.targetAmount - groupGift.currentAmount;
  const daysRemaining = groupGift.deadline 
    ? Math.ceil((groupGift.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    ...groupGift,
    progressPercentage: Math.min(progressPercentage, 100),
    remainingAmount: Math.max(remainingAmount, 0),
    daysRemaining,
    isCompleted: groupGift.currentAmount >= groupGift.targetAmount,
    isExpired: groupGift.deadline ? new Date() > groupGift.deadline : false
  };
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

async function sendContributionNotifications(groupGift: any, contribution: GroupGiftContribution, newTotal: number) {
  // Notify organizer
  await sendEmail({
    to: groupGift.organizerEmail,
    subject: `New contribution to "${groupGift.title}"`,
    template: 'group-gift-contribution',
    data: {
      groupGiftTitle: groupGift.title,
      contributorName: contribution.isAnonymous ? 'Anonymous' : contribution.contributorName,
      amount: contribution.amount,
      message: contribution.message,
      currentTotal: newTotal,
      targetAmount: groupGift.targetAmount,
      progressPercentage: (newTotal / groupGift.targetAmount) * 100
    }
  });

  // Notify registry owner if different from organizer
  if (groupGift.registryItem.registry.customerEmail !== groupGift.organizerEmail) {
    await sendEmail({
      to: groupGift.registryItem.registry.customerEmail,
      subject: `Progress update on your group gift`,
      template: 'group-gift-progress',
      data: {
        registryTitle: groupGift.registryItem.registry.title,
        groupGiftTitle: groupGift.title,
        productTitle: groupGift.registryItem.productTitle,
        currentTotal: newTotal,
        targetAmount: groupGift.targetAmount,
        progressPercentage: (newTotal / groupGift.targetAmount) * 100
      }
    });
  }
}

async function sendGroupGiftCompletionNotifications(groupGift: any, order: any) {
  // Notify all contributors
  for (const contribution of groupGift.contributions) {
    await sendEmail({
      to: contribution.contributorEmail,
      subject: `Group gift completed: "${groupGift.title}"`,
      template: 'group-gift-completed',
      data: {
        groupGiftTitle: groupGift.title,
        contributorName: contribution.contributorName,
        contributionAmount: contribution.amount,
        totalAmount: groupGift.currentAmount,
        orderNumber: order.name,
        productTitle: groupGift.registryItem.productTitle
      }
    });
  }

  // Notify organizer
  await sendEmail({
    to: groupGift.organizerEmail,
    subject: `Group gift completed and order placed`,
    template: 'group-gift-organizer-completed',
    data: {
      groupGiftTitle: groupGift.title,
      totalAmount: groupGift.currentAmount,
      contributorCount: groupGift.contributions.length,
      orderNumber: order.name,
      trackingInfo: order.trackingInfo
    }
  });
}

async function sendRefundNotifications(groupGift: any) {
  for (const contribution of groupGift.contributions) {
    await sendEmail({
      to: contribution.contributorEmail,
      subject: `Refund processed for group gift: "${groupGift.title}"`,
      template: 'group-gift-refund',
      data: {
        groupGiftTitle: groupGift.title,
        contributorName: contribution.contributorName,
        refundAmount: contribution.amount,
        reason: 'Group gift did not reach target amount'
      }
    });
  }
}