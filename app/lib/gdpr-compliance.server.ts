/**
 * GDPR Compliance Features for Built for Shopify 2025
 * 
 * Features:
 * - Data retention management
 * - Consent management
 * - Data export (Right to Access)
 * - Data deletion (Right to Erasure)
 * - Data portability
 * - Audit logging
 * - Automated cleanup
 */

import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { cache } from "~/lib/cache.server";
import { decryptPII, createSearchableEmailHash } from "~/lib/encryption.server";
import { z } from "zod";

// GDPR consent types
export enum ConsentType {
  ANALYTICS = "analytics",
  MARKETING = "marketing",
  FUNCTIONALITY = "functionality",
  PERFORMANCE = "performance"
}

// GDPR request types
export enum GDPRRequestType {
  ACCESS = "access",
  PORTABILITY = "portability",
  RECTIFICATION = "rectification",
  ERASURE = "erasure",
  RESTRICTION = "restriction",
  OBJECTION = "objection"
}

// Data retention periods (in days)
export const DATA_RETENTION_PERIODS = {
  REGISTRY_DATA: parseInt(process.env.DATA_RETENTION_DAYS || "730"), // 2 years
  AUDIT_LOGS: 2555, // 7 years
  PERFORMANCE_METRICS: 365, // 1 year
  SESSION_DATA: 30, // 30 days
  WEBHOOK_LOGS: 90, // 90 days
  PURCHASE_DATA: 2555, // 7 years (legal requirement)
  CUSTOMER_COMMUNICATION: 365 // 1 year
};

// Consent management
export interface ConsentRecord {
  id: string;
  shopId: string;
  customerEmail: string;
  consentType: ConsentType;
  granted: boolean;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  method: 'explicit' | 'implied' | 'withdrawn';
  legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
  expiresAt?: Date;
}

export class GDPRComplianceService {
  
  /**
   * Record user consent
   */
  async recordConsent(data: {
    shopId: string;
    customerEmail: string;
    consentType: ConsentType;
    granted: boolean;
    ipAddress?: string;
    userAgent?: string;
    method: 'explicit' | 'implied' | 'withdrawn';
    legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
    expiresAt?: Date;
  }): Promise<void> {
    const emailHash = createSearchableEmailHash(data.customerEmail);
    
    // Create consent record
    await db.auditLog.create({
      data: {
        shopId: data.shopId,
        userEmail: data.customerEmail,
        action: `consent_${data.granted ? 'granted' : 'withdrawn'}`,
        resource: 'consent',
        resourceId: `${data.consentType}:${emailHash}`,
        metadata: JSON.stringify({
          consentType: data.consentType,
          granted: data.granted,
          method: data.method,
          legalBasis: data.legalBasis,
          expiresAt: data.expiresAt,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent
        }),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      }
    });
    
    // Invalidate consent cache
    await cache.del(this.getConsentCacheKey(data.shopId, data.customerEmail));
    
    log.info("Consent recorded", {
      shopId: data.shopId,
      customerEmail: data.customerEmail,
      consentType: data.consentType,
      granted: data.granted,
      method: data.method
    });
  }

  private getConsentCacheKey(shopId: string, customerEmail: string): string {
    return `consent:${shopId}:${createSearchableEmailHash(customerEmail)}`;
  }
}

/**
 * Export all customer data for GDPR compliance
 */
export async function exportCustomerData(customerId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    log.info(`GDPR: Exporting data for customer ${customerId}`);

    // Get all registries for the customer
    const registries = await db.registry.findMany({
      where: { 
        customerId,
        status: { not: "deleted" }
      },
      include: {
        items: true,
        shop: {
          select: {
            domain: true,
            name: true
          }
        }
      }
    });

    // Get audit logs for transparency
    const auditLogs = await db.auditLog.findMany({
      where: { 
        userId: customerId,
        action: { in: ["REGISTRY_CREATED", "REGISTRY_UPDATED", "ITEM_ADDED", "ITEM_PURCHASED"] }
      },
      orderBy: { timestamp: "desc" },
      take: 100 // Limit to recent activity
    });

    const exportData = {
      customerId,
      exportDate: new Date().toISOString(),
      registries: registries.map(registry => ({
        id: registry.id,
        title: registry.title,
        description: registry.description,
        eventDate: registry.eventDate,
        eventType: registry.eventType,
        status: registry.status,
        visibility: registry.visibility,
        createdAt: registry.createdAt,
        updatedAt: registry.updatedAt,
        shop: registry.shop,
        items: registry.items.map(item => ({
          id: item.id,
          productId: item.productId,
          productTitle: item.productTitle,
          productHandle: item.productHandle,
          productImage: item.productImage,
          price: item.price,
          currencyCode: item.currencyCode,
          quantity: item.quantity,
          notes: item.notes,
          priority: item.priority,
          status: item.status,
          createdAt: item.createdAt
        })),
        itemsCount: registry.items.length
      })),
      auditTrail: auditLogs.map(log => ({
        action: log.action,
        timestamp: log.timestamp,
        metadata: log.metadata
      })),
      dataProcessingInfo: {
        dataController: "WishCraft App",
        legalBasis: "User consent and legitimate interest",
        retentionPeriod: "Data retained while account is active, deleted within 30 days of account deletion",
        rights: [
          "Right to access your data",
          "Right to rectify incorrect data", 
          "Right to erase your data",
          "Right to restrict processing",
          "Right to data portability",
          "Right to object to processing"
        ]
      }
    };

    return {
      success: true,
      data: exportData
    };

  } catch (error) {
    log.error("GDPR: Failed to export customer data", error as Error);
    return {
      success: false,
      error: "Failed to export customer data"
    };
  }
}

/**
 * Delete all customer data for GDPR compliance
 */
export async function deleteCustomerData(customerId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    log.info(`GDPR: Deleting data for customer ${customerId}`);

    await db.$transaction(async (tx) => {
      // Soft delete registries (mark as deleted but keep for audit trail)
      await tx.registry.updateMany({
        where: { customerId },
        data: { 
          status: "deleted",
          // Clear personal data
          title: "[DELETED]",
          description: "[DELETED]"
        }
      });

      // Delete registry items
      await tx.registryItem.deleteMany({
        where: {
          registry: { customerId }
        }
      });

      // Delete purchases
      await tx.registryPurchase.deleteMany({
        where: {
          registry_items: {
            registry: { customerId }
          }
        }
      });

      // Create audit log for deletion
      await tx.auditLog.create({
        data: {
          shopId: "", // Will be set by calling context
          userId: customerId,
          action: "DATA_DELETED",
          resource: "customer_data",
          resourceId: customerId,
          metadata: JSON.stringify({
            reason: "GDPR deletion request",
            timestamp: new Date().toISOString()
          }),
          timestamp: new Date()
        }
      });
    });

    return { success: true };

  } catch (error) {
    log.error("GDPR: Failed to delete customer data", error as Error);
    return {
      success: false,
      error: "Failed to delete customer data"
    };
  }
}

/**
 * Clean up old audit logs (data retention policy)
 */
export async function cleanupOldAuditLogs(retentionDays: number = 90): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    
    log.info(`GDPR: Cleaning up audit logs older than ${retentionDays} days`);

    const result = await db.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate }
      }
    });

    log.info(`GDPR: Deleted ${result.count} old audit log entries`);

    return {
      success: true,
      deletedCount: result.count
    };

  } catch (error) {
    log.error("GDPR: Failed to cleanup old audit logs", error as Error);
    return {
      success: false,
      error: "Failed to cleanup old audit logs"
    };
  }
}

/**
 * Generate privacy compliance report
 */
export async function generatePrivacyReport(shopId: string): Promise<{
  success: boolean;
  report?: any;
  error?: string;
}> {
  try {
    log.info(`GDPR: Generating privacy report for shop ${shopId}`);

    const totalRegistries = await db.registry.count({
      where: { shopId, status: { not: "DELETED" } }
    });

    const totalItems = await db.registryItem.count({
      where: { registry: { shopId } }
    });

    const totalPurchases = await db.registryPurchase.count({
      where: {
        registry_items: {
          registry: { shopId }
        }
      }
    });

    const auditLogCount = await db.auditLog.count({
      where: { shopId }
    });

    const dataRetentionInfo = await db.auditLog.aggregate({
      where: { shopId },
      _min: { timestamp: true },
      _max: { timestamp: true }
    });

    const report = {
      shopId,
      reportDate: new Date().toISOString(),
      dataStats: {
        totalRegistries,
        totalItems,
        totalPurchases,
        auditLogEntries: auditLogCount
      },
      dataRetention: {
        oldestRecord: dataRetentionInfo._min.timestamp,
        newestRecord: dataRetentionInfo._max.timestamp,
        retentionPolicy: "90 days for audit logs, lifetime for active registries"
      },
      complianceFeatures: [
        "HMAC webhook verification",
        "Encrypted session storage", 
        "Audit trail logging",
        "Data export functionality",
        "Right to deletion",
        "Automatic data cleanup"
      ],
      contactInfo: {
        dataController: "WishCraft App",
        contact: "privacy@wishcraft.app",
        website: "https://wishcraft.app/privacy"
      }
    };

    return {
      success: true,
      report
    };

  } catch (error) {
    log.error("GDPR: Failed to generate privacy report", error as Error);
    return {
      success: false,
      error: "Failed to generate privacy report"
    };
  }
}

/**
 * Scheduled cleanup job (call this from a cron job)
 */
export async function runScheduledDataCleanup(): Promise<void> {
  try {
    log.info("GDPR: Running scheduled data cleanup");

    // Clean up old audit logs
    await cleanupOldAuditLogs(90);

    // Clean up deleted registries older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    
    const deletedRegistries = await db.registry.deleteMany({
      where: {
        status: "deleted",
        updatedAt: { lt: thirtyDaysAgo }
      }
    });

    log.info(`GDPR: Permanently deleted ${deletedRegistries.count} old deleted registries`);

  } catch (error) {
    log.error("GDPR: Scheduled cleanup failed", error as Error);
  }
}