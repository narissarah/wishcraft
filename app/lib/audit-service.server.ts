import { z } from "zod";

// ============================================================================
// EXTERNAL AUDIT SERVICE FOR GDPR COMPLIANCE
// ============================================================================

const AuditEventSchema = z.object({
  event: z.enum([
    "gdpr_customer_redact",
    "gdpr_shop_redact", 
    "gdpr_data_request",
    "app_installed",
    "app_uninstalled",
    "shop_data_deleted",
    "customer_data_anonymized",
    "data_export_requested",
    "data_export_completed"
  ]),
  shopDomain: z.string(),
  timestamp: z.string(),
  environment: z.enum(["development", "staging", "production"]),
  metadata: z.record(z.any()).optional(),
  recordStats: z.object({
    registries: z.number().optional(),
    customers: z.number().optional(),
    analytics: z.number().optional(),
    totalRecords: z.number().optional()
  }).optional()
});

type AuditEvent = z.infer<typeof AuditEventSchema>;

export class AuditService {
  private serviceUrl: string | null;
  private apiKey: string | null;
  private batchQueue: AuditEvent[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_BATCH_SIZE = 100;
  private readonly BATCH_DELAY = 5000; // 5 seconds

  constructor() {
    this.serviceUrl = process.env.AUDIT_SERVICE_URL || null;
    this.apiKey = process.env.AUDIT_SERVICE_API_KEY || null;
  }

  /**
   * Log an audit event to external service
   */
  async logEvent(event: AuditEvent): Promise<void> {
    if (!this.serviceUrl) {
      // If no audit service configured, log locally
      console.log("[AUDIT]", JSON.stringify(event));
      return;
    }

    try {
      // Validate event
      const validatedEvent = AuditEventSchema.parse(event);
      
      // Add to batch queue
      this.batchQueue.push(validatedEvent);
      
      // Send immediately if batch is full
      if (this.batchQueue.length >= this.MAX_BATCH_SIZE) {
        await this.flushBatch();
      } else {
        // Schedule batch send
        this.scheduleBatchFlush();
      }
    } catch (error) {
      console.error("[AUDIT] Invalid event format:", error);
    }
  }

  /**
   * Log GDPR compliance event
   */
  async logGDPREvent(
    type: "customer_redact" | "shop_redact" | "data_request",
    shop: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event: `gdpr_${type}` as any,
      shopDomain: shop,
      timestamp: new Date().toISOString(),
      environment: (process.env.NODE_ENV || "development") as any,
      metadata: {
        ...details,
        gdprCompliant: true,
        dataProcessingVersion: "2.0"
      }
    });
  }

  /**
   * Log shop lifecycle event
   */
  async logShopEvent(
    type: "installed" | "uninstalled" | "data_deleted",
    shop: string,
    stats?: { registries?: number; customers?: number; analytics?: number }
  ): Promise<void> {
    await this.logEvent({
      event: type === "installed" ? "app_installed" : 
             type === "uninstalled" ? "app_uninstalled" : 
             "shop_data_deleted",
      shopDomain: shop,
      timestamp: new Date().toISOString(),
      environment: (process.env.NODE_ENV || "development") as any,
      recordStats: stats
    });
  }

  /**
   * Schedule batch flush
   */
  private scheduleBatchFlush(): void {
    if (this.batchTimeout) return;
    
    this.batchTimeout = setTimeout(() => {
      this.flushBatch().catch(err => 
        console.error("[AUDIT] Batch flush failed:", err)
      );
    }, this.BATCH_DELAY);
  }

  /**
   * Flush batch to external service
   */
  private async flushBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0 || !this.serviceUrl) {
      return;
    }

    const eventsToSend = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const response = await fetch(this.serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "X-Shopify-App": "wishcraft",
          "X-Batch-Size": eventsToSend.length.toString()
        },
        body: JSON.stringify({
          events: eventsToSend,
          source: "wishcraft",
          version: "1.0.0"
        })
      });

      if (!response.ok) {
        throw new Error(`Audit service returned ${response.status}`);
      }

      console.log(`[AUDIT] Successfully sent ${eventsToSend.length} events`);
    } catch (error) {
      console.error("[AUDIT] Failed to send events:", error);
      
      // Re-queue failed events (with limit to prevent memory issues)
      if (this.batchQueue.length < this.MAX_BATCH_SIZE * 2) {
        this.batchQueue.unshift(...eventsToSend);
      }
      
      // Retry with exponential backoff
      setTimeout(() => this.flushBatch(), 30000); // 30 seconds
    }
  }

  /**
   * Flush any pending events (call on app shutdown)
   */
  async shutdown(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    await this.flushBatch();
  }
}

// Singleton instance
export const auditService = new AuditService();

// ============================================================================
// AUDIT MIDDLEWARE
// ============================================================================

export function createAuditMiddleware() {
  return async function auditMiddleware(
    request: Request,
    context: any,
    next: () => Promise<Response>
  ): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    try {
      const response = await next();
      
      // Log specific audit-worthy events
      if (url.pathname.includes("/gdpr/") || url.pathname.includes("/webhooks/")) {
        await auditService.logEvent({
          event: "gdpr_data_request",
          shopDomain: context.shop || "unknown",
          timestamp: new Date().toISOString(),
          environment: (process.env.NODE_ENV || "development") as any,
          metadata: {
            path: url.pathname,
            method: request.method,
            statusCode: response.status,
            duration: Date.now() - startTime
          }
        });
      }
      
      return response;
    } catch (error) {
      // Log errors for audit-worthy endpoints
      if (url.pathname.includes("/gdpr/") || url.pathname.includes("/webhooks/")) {
        await auditService.logEvent({
          event: "gdpr_data_request",
          shopDomain: context.shop || "unknown",
          timestamp: new Date().toISOString(),
          environment: (process.env.NODE_ENV || "development") as any,
          metadata: {
            path: url.pathname,
            method: request.method,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - startTime
          }
        });
      }
      
      throw error;
    }
  };
}

// ============================================================================
// COMPLIANCE REPORT GENERATOR
// ============================================================================

export async function generateComplianceReport(
  shop: string,
  startDate: Date,
  endDate: Date
): Promise<{
  shop: string;
  period: { start: string; end: string };
  gdprEvents: {
    customerRedactions: number;
    dataRequests: number;
    shopRedactions: number;
  };
  dataRetention: {
    anonymizedRecords: number;
    deletedRecords: number;
    retentionCompliant: boolean;
  };
  auditTrail: {
    totalEvents: number;
    criticalEvents: number;
  };
}> {
  // This would query your audit logs and generate a compliance report
  // For now, returning a mock structure
  return {
    shop,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    gdprEvents: {
      customerRedactions: 0,
      dataRequests: 0,
      shopRedactions: 0
    },
    dataRetention: {
      anonymizedRecords: 0,
      deletedRecords: 0,
      retentionCompliant: true
    },
    auditTrail: {
      totalEvents: 0,
      criticalEvents: 0
    }
  };
}

// Graceful shutdown handler
process.on("SIGTERM", async () => {
  await auditService.shutdown();
});

process.on("SIGINT", async () => {
  await auditService.shutdown();
});