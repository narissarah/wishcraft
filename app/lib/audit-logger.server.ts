/**
 * Audit Logger Service - Centralized audit logging
 * Provides consistent audit trail across the application
 */

import { db } from './db.server';
import { log } from '~/lib/logger.server';

export interface AuditLogParams {
  action: string;
  resource: string;
  resourceId: string;
  shopId: string;
  metadata?: Record<string, any>;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Centralized audit logging service
 */
export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(params: AuditLogParams): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          shopId: params.shopId,
          userId: params.userId,
          userEmail: params.userEmail,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
          timestamp: new Date()
        }
      });
    } catch (error) {
      // Silent failure - audit logging should never break the main flow
      log.error('[AuditLogger] Failed to create audit log', error as Error);
    }
  }

  /**
   * Log webhook events
   */
  static async logWebhook(
    topic: string,
    shopId: string,
    resourceId: string,
    payload?: any
  ): Promise<void> {
    await this.log({
      action: `webhook.${topic}`,
      resource: 'webhook',
      resourceId,
      shopId,
      metadata: { 
        topic,
        payloadSize: payload ? JSON.stringify(payload).length : 0
      }
    });
  }

  /**
   * Log user actions
   */
  static async logUserAction(
    action: string,
    resource: string,
    resourceId: string,
    shopId: string,
    userId?: string,
    userEmail?: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      action,
      resource,
      resourceId,
      shopId,
      userId,
      userEmail,
      ipAddress: request?.headers.get('x-forwarded-for') || 
                 request?.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request?.headers.get('user-agent') || 'unknown'
    });
  }

  /**
   * Log API actions
   */
  static async logApiAction(
    action: string,
    resource: string,
    resourceId: string,
    shopId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: `api.${action}`,
      resource,
      resourceId,
      shopId,
      metadata
    });
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(
    event: string,
    shopId: string,
    details: Record<string, any>,
    request?: Request
  ): Promise<void> {
    await this.log({
      action: `security.${event}`,
      resource: 'security',
      resourceId: 'system',
      shopId,
      ipAddress: request?.headers.get('x-forwarded-for') || 
                 request?.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request?.headers.get('user-agent') || 'unknown',
      metadata: details
    });
  }

  /**
   * Log system events
   */
  static async logSystemEvent(
    event: string,
    details: Record<string, any>,
    shopId = 'system'
  ): Promise<void> {
    await this.log({
      action: `system.${event}`,
      resource: 'system',
      resourceId: 'system',
      shopId,
      metadata: details
    });
  }
}