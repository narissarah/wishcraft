import { db } from "~/lib/db.server";
import { createRegistryAccessService } from "~/lib/registry-access.server";
import crypto from "crypto";

// ============================================================================
// REGISTRY SHARING SERVICE
// ============================================================================

export interface ShareableLink {
  url: string;
  token: string;
  expiresAt: Date | null;
  createdAt: Date;
  useCount: number;
  maxUses: number | null;
}

export interface ShareOptions {
  platform?: 'facebook' | 'twitter' | 'linkedin' | 'pinterest' | 'email' | 'link';
  message?: string;
  expiresIn?: number; // hours
  maxUses?: number;
  allowGuests?: boolean;
  trackViews?: boolean;
}

export interface ShareStats {
  totalShares: number;
  totalViews: number;
  sharesByPlatform: Record<string, number>;
  recentShares: Array<{
    platform: string;
    sharedAt: Date;
    sharedBy?: string;
  }>;
}

export interface EmailShareOptions {
  recipientEmails: string[];
  senderName: string;
  senderEmail: string;
  personalMessage?: string;
  includePreview?: boolean;
}

export class RegistrySharingService {
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;
  }

  /**
   * Generate shareable link for registry
   */
  async generateShareableLink(
    registryId: string, 
    options: ShareOptions = {}
  ): Promise<ShareableLink | null> {
    try {
      // Verify registry exists and belongs to shop
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = options.expiresIn 
        ? new Date(Date.now() + options.expiresIn * 60 * 60 * 1000)
        : null;

      // Store shareable link
      const shareLink = await db.registryInvitation.create({
        data: {
          registryId,
          token,
          type: 'link',
          email: null,
          expiresAt,
          maxUses: options.maxUses || null,
          allowGuests: options.allowGuests ?? true,
          createdBy: registry.customerId || 'system',
          metadata: JSON.stringify({
            platform: options.platform || 'link',
            trackViews: options.trackViews ?? true,
            message: options.message
          })
        }
      });

      // Generate shareable URL
      const baseUrl = process.env.SHOPIFY_APP_URL || 'https://your-app.com';
      const shareUrl = `${baseUrl}/registry/${registry.slug}?share=${token}`;

      // Log sharing activity
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'link_generated',
          description: `Shareable link generated for ${options.platform || 'direct sharing'}`,
          actorType: 'owner',
          actorId: registry.customerId || 'system',
          actorEmail: registry.customerEmail,
          actorName: registry.customerFirstName && registry.customerLastName 
            ? `${registry.customerFirstName} ${registry.customerLastName}`
            : null,
          metadata: JSON.stringify({
            platform: options.platform,
            token: token.substring(0, 8) + '...' // Log partial token for debugging
          })
        }
      });

      return {
        url: shareUrl,
        token,
        expiresAt,
        createdAt: shareLink.createdAt,
        useCount: 0,
        maxUses: options.maxUses || null
      };
    } catch (error) {
      console.error('Error generating shareable link:', error);
      return null;
    }
  }

  /**
   * Generate social media share URLs
   */
  async generateSocialShareUrls(registryId: string, baseUrl: string): Promise<Record<string, string>> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId },
        include: {
          items: {
            take: 3,
            include: {
              product: true
            }
          }
        }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      const registryUrl = `${baseUrl}/registry/${registry.slug}`;
      const title = encodeURIComponent(`${registry.title} - Gift Registry`);
      const description = encodeURIComponent(
        registry.description || 
        `Check out ${registry.customerFirstName}'s gift registry with ${registry.items.length} items!`
      );

      // Generate platform-specific URLs
      const shareUrls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(registryUrl)}&quote=${description}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(registryUrl)}&text=${title}&hashtags=GiftRegistry,Wishlist`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(registryUrl)}&title=${title}&summary=${description}`,
        pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(registryUrl)}&description=${title}`,
        reddit: `https://reddit.com/submit?url=${encodeURIComponent(registryUrl)}&title=${title}`,
        whatsapp: `https://api.whatsapp.com/send?text=${title}%20${encodeURIComponent(registryUrl)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(registryUrl)}&text=${title}`,
        email: `mailto:?subject=${title}&body=${description}%0A%0A${encodeURIComponent(registryUrl)}`
      };

      // Track social share URL generation
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'social_urls_generated',
          description: 'Social media share URLs generated',
          actorType: 'system',
          actorId: 'sharing_service',
          actorEmail: null,
          actorName: 'Sharing Service',
          metadata: JSON.stringify({
            platforms: Object.keys(shareUrls),
            registryUrl
          })
        }
      });

      return shareUrls;
    } catch (error) {
      console.error('Error generating social share URLs:', error);
      return {};
    }
  }

  /**
   * Send email invitations to share registry
   */
  async sendEmailShares(
    registryId: string, 
    emailOptions: EmailShareOptions
  ): Promise<{ success: boolean; sentEmails: string[]; failedEmails: string[] }> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId },
        include: {
          items: {
            take: 5,
            include: {
              product: true
            }
          }
        }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      const sentEmails: string[] = [];
      const failedEmails: string[] = [];

      // Generate shareable link for email
      const shareLink = await this.generateShareableLink(registryId, {
        platform: 'email',
        expiresIn: 24 * 7, // 7 days
        allowGuests: true,
        trackViews: true
      });

      if (!shareLink) {
        throw new Error('Failed to generate shareable link');
      }

      // Send emails to recipients
      for (const email of emailOptions.recipientEmails) {
        try {
          await this.sendRegistryEmailInvitation({
            registry,
            shareLink: shareLink.url,
            recipientEmail: email,
            senderName: emailOptions.senderName,
            senderEmail: emailOptions.senderEmail,
            personalMessage: emailOptions.personalMessage,
            includePreview: emailOptions.includePreview ?? true
          });

          sentEmails.push(email);

          // Log individual email share
          await db.registryActivity.create({
            data: {
              registryId,
              type: 'email_shared',
              description: `Registry shared via email to ${email}`,
              actorType: 'owner',
              actorId: registry.customerId || emailOptions.senderEmail,
              actorEmail: emailOptions.senderEmail,
              actorName: emailOptions.senderName,
              metadata: JSON.stringify({
                recipientEmail: email,
                personalMessage: emailOptions.personalMessage ? true : false
              })
            }
          });
        } catch (emailError) {
          console.error(`Error sending email to ${email}:`, emailError);
          failedEmails.push(email);
        }
      }

      return {
        success: sentEmails.length > 0,
        sentEmails,
        failedEmails
      };
    } catch (error) {
      console.error('Error sending email shares:', error);
      return {
        success: false,
        sentEmails: [],
        failedEmails: emailOptions.recipientEmails
      };
    }
  }

  /**
   * Track share event
   */
  async trackShare(
    registryId: string,
    platform: string,
    sharedBy?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Create share tracking record
      await db.registryShare.create({
        data: {
          registryId,
          platform,
          sharedBy: sharedBy || 'anonymous',
          sharedAt: new Date(),
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      });

      // Log activity
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'registry_shared',
          description: `Registry shared on ${platform}`,
          actorType: sharedBy ? 'customer' : 'guest',
          actorId: sharedBy || 'anonymous',
          actorEmail: null,
          actorName: null,
          metadata: JSON.stringify({
            platform,
            timestamp: new Date().toISOString(),
            ...metadata
          })
        }
      });
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  }

  /**
   * Track share link view
   */
  async trackShareView(
    token: string,
    viewerInfo?: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
    }
  ): Promise<boolean> {
    try {
      // Find share link
      const shareLink = await db.registryInvitation.findFirst({
        where: {
          token,
          type: 'link'
        },
        include: {
          registry: {
            select: { id: true, shopId: true }
          }
        }
      });

      if (!shareLink || shareLink.registry.shopId !== this.shopId) {
        return false;
      }

      // Check if link is expired
      if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
        return false;
      }

      // Check if max uses exceeded
      if (shareLink.maxUses && shareLink.useCount >= shareLink.maxUses) {
        return false;
      }

      // Increment use count
      await db.registryInvitation.update({
        where: { id: shareLink.id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      });

      // Log view activity
      await db.registryActivity.create({
        data: {
          registryId: shareLink.registryId,
          type: 'shared_link_viewed',
          description: 'Registry accessed via shared link',
          actorType: 'guest',
          actorId: viewerInfo?.ipAddress || 'unknown',
          actorEmail: null,
          actorName: null,
          metadata: JSON.stringify({
            token: token.substring(0, 8) + '...',
            viewerInfo: {
              ipAddress: viewerInfo?.ipAddress,
              userAgent: viewerInfo?.userAgent,
              referrer: viewerInfo?.referrer
            },
            timestamp: new Date().toISOString()
          })
        }
      });

      return true;
    } catch (error) {
      console.error('Error tracking share view:', error);
      return false;
    }
  }

  /**
   * Get sharing statistics for registry
   */
  async getShareStats(registryId: string): Promise<ShareStats> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      // Get share counts by platform
      const shares = await db.registryShare.groupBy({
        by: ['platform'],
        where: { registryId },
        _count: { platform: true }
      });

      const sharesByPlatform = shares.reduce((acc, share) => {
        acc[share.platform] = share._count.platform;
        return acc;
      }, {} as Record<string, number>);

      // Get total shares
      const totalShares = Object.values(sharesByPlatform).reduce((sum, count) => sum + count, 0);

      // Get share link views
      const shareViews = await db.registryInvitation.aggregate({
        where: {
          registryId,
          type: 'link'
        },
        _sum: { useCount: true }
      });

      const totalViews = shareViews._sum.useCount || 0;

      // Get recent shares
      const recentShares = await db.registryShare.findMany({
        where: { registryId },
        orderBy: { sharedAt: 'desc' },
        take: 10,
        select: {
          platform: true,
          sharedAt: true,
          sharedBy: true
        }
      });

      return {
        totalShares,
        totalViews,
        sharesByPlatform,
        recentShares
      };
    } catch (error) {
      console.error('Error getting share stats:', error);
      return {
        totalShares: 0,
        totalViews: 0,
        sharesByPlatform: {},
        recentShares: []
      };
    }
  }

  /**
   * Send registry email invitation
   */
  private async sendRegistryEmailInvitation(options: {
    registry: any;
    shareLink: string;
    recipientEmail: string;
    senderName: string;
    senderEmail: string;
    personalMessage?: string;
    includePreview: boolean;
  }): Promise<void> {
    try {
      // This would integrate with your email service (SendGrid, Mailgun, etc.)
      console.log(`Sending registry email invitation to ${options.recipientEmail}`);
      
      const emailContent = this.generateEmailContent(options);
      
      // Mock email sending - replace with actual email service
      // await emailService.send({
      //   to: options.recipientEmail,
      //   from: options.senderEmail,
      //   subject: emailContent.subject,
      //   html: emailContent.html,
      //   text: emailContent.text
      // });

      console.log('Email content generated:', {
        to: options.recipientEmail,
        subject: emailContent.subject,
        previewText: emailContent.text.substring(0, 100) + '...'
      });
    } catch (error) {
      console.error('Error sending registry email invitation:', error);
      throw error;
    }
  }

  /**
   * Generate email content for registry sharing
   */
  private generateEmailContent(options: {
    registry: any;
    shareLink: string;
    recipientEmail: string;
    senderName: string;
    personalMessage?: string;
    includePreview: boolean;
  }) {
    const registryOwner = options.registry.customerFirstName || 'Someone';
    const registryTitle = options.registry.title;
    
    const subject = `${options.senderName} shared a gift registry with you: ${registryTitle}`;
    
    const personalMessageBlock = options.personalMessage 
      ? `<p style="margin: 16px 0; font-style: italic; color: #666;">"${options.personalMessage}"</p>`
      : '';

    const previewBlock = options.includePreview && options.registry.items?.length > 0
      ? `
        <div style="margin: 24px 0; padding: 16px; background: #f9f9f9; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; color: #333;">Registry Preview</h3>
          <p style="margin: 0 0 8px 0; color: #666;">${options.registry.items.length} items</p>
          ${options.registry.description ? `<p style="margin: 8px 0; color: #666;">${options.registry.description}</p>` : ''}
        </div>
      `
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; color: #333; font-size: 24px;">You've been invited to view a gift registry!</h1>
              
              <p style="margin: 16px 0; font-size: 16px;">
                Hello! ${options.senderName} has shared ${registryOwner}'s gift registry "${registryTitle}" with you.
              </p>
              
              ${personalMessageBlock}
              
              ${previewBlock}
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${options.shareLink}" 
                   style="display: inline-block; padding: 12px 24px; background: #007cba; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                  View Gift Registry
                </a>
              </div>
              
              <p style="margin: 16px 0; font-size: 14px; color: #666;">
                If the button above doesn't work, you can copy and paste this link into your browser:
                <br><a href="${options.shareLink}" style="color: #007cba; word-break: break-all;">${options.shareLink}</a>
              </p>
              
              <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
              
              <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                This registry was shared through WishCraft Gift Registry.
                <br>If you have any questions, please contact ${options.senderName} directly.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
You've been invited to view a gift registry!

${options.senderName} has shared ${registryOwner}'s gift registry "${registryTitle}" with you.

${options.personalMessage ? `Personal message: "${options.personalMessage}"` : ''}

View the registry: ${options.shareLink}

This registry was shared through WishCraft Gift Registry.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Revoke shareable link
   */
  async revokeShareableLink(registryId: string, token: string): Promise<boolean> {
    try {
      const shareLink = await db.registryInvitation.findFirst({
        where: {
          registryId,
          token,
          type: 'link'
        }
      });

      if (!shareLink) {
        return false;
      }

      await db.registryInvitation.delete({
        where: { id: shareLink.id }
      });

      // Log revocation
      await db.registryActivity.create({
        data: {
          registryId,
          type: 'link_revoked',
          description: 'Shareable link revoked',
          actorType: 'owner',
          actorId: 'system',
          actorEmail: null,
          actorName: 'System',
          metadata: JSON.stringify({
            token: token.substring(0, 8) + '...',
            revokedAt: new Date().toISOString()
          })
        }
      });

      return true;
    } catch (error) {
      console.error('Error revoking shareable link:', error);
      return false;
    }
  }

  /**
   * Get active shareable links for registry
   */
  async getActiveShareableLinks(registryId: string): Promise<ShareableLink[]> {
    try {
      const links = await db.registryInvitation.findMany({
        where: {
          registryId,
          type: 'link',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      return links.map(link => ({
        url: `${process.env.SHOPIFY_APP_URL || 'https://your-app.com'}/registry?share=${link.token}`,
        token: link.token,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
        useCount: link.useCount,
        maxUses: link.maxUses
      }));
    } catch (error) {
      console.error('Error getting active shareable links:', error);
      return [];
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create RegistrySharingService instance
 */
export function createRegistrySharingService(shopId: string): RegistrySharingService {
  return new RegistrySharingService(shopId);
}

/**
 * Generate QR code for registry sharing (would require QR library)
 */
export function generateRegistryQRCode(registryUrl: string): string {
  // This would integrate with a QR code generation library
  // For now, return a placeholder URL that generates QR codes
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registryUrl)}`;
}

/**
 * Format platform name for display
 */
export function formatPlatformName(platform: string): string {
  const platformNames: Record<string, string> = {
    facebook: 'Facebook',
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    pinterest: 'Pinterest',
    reddit: 'Reddit',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    email: 'Email',
    link: 'Direct Link'
  };

  return platformNames[platform] || platform;
}

/**
 * Get platform-specific sharing best practices
 */
export function getSharingBestPractices(platform: string): string[] {
  const bestPractices: Record<string, string[]> = {
    facebook: [
      'Add a personal message to engage your friends',
      'Post in relevant groups if appropriate',
      'Tag close friends who might be interested'
    ],
    twitter: [
      'Use relevant hashtags like #GiftRegistry #Wishlist',
      'Keep your message under 280 characters',
      'Consider threading for more details'
    ],
    linkedin: [
      'Share with professional network for work events',
      'Add context about the occasion',
      'Keep tone professional'
    ],
    email: [
      'Add a personal message explaining the occasion',
      'Include event details if applicable',
      'Send to people who would actually want to contribute'
    ],
    default: [
      'Add context about the occasion',
      'Be considerate of your audience',
      'Include event details if relevant'
    ]
  };

  return bestPractices[platform] || bestPractices.default;
}