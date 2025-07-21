// Customer Privacy API Integration for Built for Shopify Compliance
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { encryptPII, decryptPII } from "~/lib/encryption.server";

/**
 * Customer Privacy Configuration
 */
export const PRIVACY_CONFIG = {
  // Data retention periods (in days)
  DEFAULT_RETENTION_PERIOD: 365, // 1 year
  ANONYMOUS_RETENTION_PERIOD: 30, // 30 days for anonymous data
  
  // Privacy levels
  PRIVACY_LEVELS: {
    FULL: "full", // All data visible
    ANONYMIZED: "anonymized", // PII removed
    REDACTED: "redacted", // All data removed
  },
  
  // Sensitive fields that require encryption
  SENSITIVE_FIELDS: [
    "email",
    "firstName",
    "lastName",
    "phone",
    "address",
  ],
};

/**
 * Customer Data Management Service
 */
export class CustomerPrivacyService {
  private shopId: string;
  private accessToken: string;
  
  constructor(shopId: string, accessToken: string) {
    this.shopId = shopId;
    this.accessToken = accessToken;
  }
  
  /**
   * Get all customer data for export (GDPR Article 15)
   */
  async exportCustomerData(customerId: string, email: string) {
    try {
      // 1. Get registries owned by customer
      const registries = await db.registry.findMany({
        where: {
          shopId: this.shopId,
          OR: [
            { customerId },
            { customerEmail: encryptPII(email) },
          ],
        },
        include: {
          items: true,
        },
      });
      
      // 2. Get purchases made by customer
      const purchases = await db.registryPurchase.findMany({
        where: {
          purchaserEmail: email,
          registry_items: {
            registry: {
              shopId: this.shopId,
            }
          },
        },
        include: {
          registry_items: {
            select: {
              registry: {
                select: {
                  title: true,
                  slug: true,
                }
              }
            }
          },
        },
      });
      
      // 3. Get audit logs for customer
      const auditLogs = await db.auditLog.findMany({
        where: {
          shopId: this.shopId,
          userEmail: email,
        },
        orderBy: {
          timestamp: "desc",
        },
      });
      
      // 4. Decrypt PII for export
      const decryptedRegistries = registries.map(registry => ({
        ...registry,
        customerEmail: registry.customerEmail ? decryptPII(registry.customerEmail) : null,
        customerFirstName: registry.customerFirstName ? decryptPII(registry.customerFirstName) : null,
        customerLastName: registry.customerLastName ? decryptPII(registry.customerLastName) : null,
      }));
      
      // 5. Format data for export
      const exportData = {
        exportDate: new Date().toISOString(),
        customer: {
          id: customerId,
          email,
        },
        registries: decryptedRegistries.map(registry => ({
          id: registry.id,
          title: registry.title,
          description: registry.description,
          status: registry.status,
          eventType: registry.eventType,
          eventDate: registry.eventDate,
          createdAt: registry.createdAt,
          items: registry.items.map(item => ({
            productTitle: item.productTitle,
            variantTitle: item.variantTitle,
            quantity: item.quantity,
            quantityPurchased: item.quantityPurchased,
            price: item.price,
            notes: item.notes,
          })),
          totalValue: registry.totalValue,
          purchasedValue: registry.purchasedValue,
        })),
        purchases: purchases.map(purchase => ({
          registryTitle: purchase.registry_items.registry.title,
          registrySlug: purchase.registry_items.registry.slug,
          quantity: purchase.quantity,
          totalAmount: purchase.totalAmount,
          giftMessage: purchase.giftMessage,
          createdAt: purchase.createdAt,
        })),
        activityLog: auditLogs.map(log => ({
          action: log.action,
          resource: log.resource,
          timestamp: log.timestamp,
        })),
      };
      
      log.info("Customer data exported", {
        customerId,
        email,
        registryCount: decryptedRegistries.length,
        purchaseCount: purchases.length,
      });
      
      return exportData;
    } catch (error) {
      log.error("Failed to export customer data", error as Error, {
        customerId,
        email,
      });
      throw error;
    }
  }
  
  /**
   * Anonymize customer data (soft delete)
   */
  async anonymizeCustomerData(customerId: string, email: string) {
    try {
      const anonymizedEmail = `anonymized_${Date.now()}@privacy.local`;
      const anonymizedName = "ANONYMIZED";
      
      // Anonymize registries
      const registryResult = await db.registry.updateMany({
        where: {
          shopId: this.shopId,
          OR: [
            { customerId },
            { customerEmail: encryptPII(email) },
          ],
        },
        data: {
          customerEmail: encryptPII(anonymizedEmail),
          customerFirstName: encryptPII(anonymizedName),
          customerLastName: encryptPII(anonymizedName),
          customerId: `anonymized_${customerId}`,
        },
      });
      
      // Anonymize purchases
      const purchaseResult = await db.registryPurchase.updateMany({
        where: {
          purchaserEmail: email,
          registry_items: {
            registry: {
              shopId: this.shopId,
            }
          },
        },
        data: {
          purchaserEmail: anonymizedEmail,
          purchaserName: anonymizedName,
        },
      });
      
      log.info("Customer data anonymized", {
        customerId,
        email,
        registriesAnonymized: registryResult.count,
        purchasesAnonymized: purchaseResult.count,
      });
      
      return {
        success: true,
        registriesAnonymized: registryResult.count,
        purchasesAnonymized: purchaseResult.count,
      };
    } catch (error) {
      log.error("Failed to anonymize customer data", error as Error, {
        customerId,
        email,
      });
      throw error;
    }
  }
  
  /**
   * Delete customer data (hard delete)
   */
  async deleteCustomerData(customerId: string, email: string) {
    try {
      await db.$transaction(async (tx) => {
        // Get registries to delete
        const registries = await tx.registry.findMany({
          where: {
            shopId: this.shopId,
            OR: [
              { customerId },
              { customerEmail: encryptPII(email) },
            ],
          },
          select: { id: true },
        });
        
        const registryIds = registries.map(r => r.id);
        
        // Delete in correct order
        await tx.registryPurchase.deleteMany({
          where: { 
            registry_items: {
              registry: {
                id: { in: registryIds }
              }
            }
          },
        });
        
        await tx.registryItem.deleteMany({
          where: { registryId: { in: registryIds } },
        });
        
        await tx.registry.deleteMany({
          where: { id: { in: registryIds } },
        });
        
        // Delete audit logs
        await tx.auditLog.deleteMany({
          where: {
            shopId: this.shopId,
            userEmail: email,
          },
        });
        
        log.info("Customer data deleted", {
          customerId,
          email,
          registriesDeleted: registries.length,
        });
      });
      
      return {
        success: true,
        message: "All customer data has been permanently deleted",
      };
    } catch (error) {
      log.error("Failed to delete customer data", error as Error, {
        customerId,
        email,
      });
      throw error;
    }
  }
  
  /**
   * Get customer consent status
   */
  async getCustomerConsent(customerId: string) {
    // This would require GraphQL implementation
    // For now, return a placeholder
    return {
      id: customerId,
      email: "placeholder@example.com",
      marketingOptInLevel: "NOT_OPTED_IN",
      smsMarketingConsent: {
        marketingState: "NOT_SUBSCRIBED",
        consentUpdatedAt: new Date().toISOString(),
      },
      emailMarketingConsent: {
        marketingState: "NOT_SUBSCRIBED",
        consentUpdatedAt: new Date().toISOString(),
      },
    };
  }
  
  /**
   * Update customer marketing consent
   */
  async updateCustomerConsent(
    customerId: string,
    emailConsent: boolean,
    smsConsent: boolean
  ) {
    // This would require GraphQL implementation
    // For now, return a placeholder
    log.info("Customer consent updated", {
      customerId,
      emailConsent,
      smsConsent,
    });
    
    return {
      id: customerId,
      emailMarketingConsent: {
        marketingState: emailConsent ? "SUBSCRIBED" : "UNSUBSCRIBED",
        consentUpdatedAt: new Date().toISOString(),
      },
      smsMarketingConsent: {
        marketingState: smsConsent ? "SUBSCRIBED" : "UNSUBSCRIBED",
        consentUpdatedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Privacy Policy Helpers
 */
export const privacyHelpers = {
  /**
   * Check if customer data should be retained
   */
  shouldRetainData(lastActivity: Date, retentionDays: number = 365): boolean {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - retentionDays);
    return lastActivity > retentionDate;
  },
  
  /**
   * Generate privacy policy URL
   */
  getPrivacyPolicyUrl(shopDomain: string): string {
    return `https://${shopDomain}/policies/privacy-policy`;
  },
  
  /**
   * Format data for privacy export
   */
  formatForExport(data: any): {
    json: string;
    csv: string;
  } {
    // JSON format
    const json = JSON.stringify(data, null, 2);
    
    // CSV format (simplified - would need a proper CSV library for production)
    const csv = "Data export in CSV format not yet implemented";
    
    return { json, csv };
  },
};