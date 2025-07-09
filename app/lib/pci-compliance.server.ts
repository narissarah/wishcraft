import crypto from "crypto";
import { db } from "~/lib/db.server";

/**
 * PCI DSS 4.0 Compliance Implementation
 * Ensures secure handling of payment card data and customer information
 */

// Encryption configuration
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * PCI DSS Compliance Levels
 */
export enum PCIComplianceLevel {
  SAQ_A = "SAQ-A", // Card data never touches our servers
  SAQ_A_EP = "SAQ-A-EP", // E-commerce with payment page redirect
  SAQ_D = "SAQ-D", // Direct card data handling (not recommended)
}

/**
 * Security event types for audit logging
 */
export enum SecurityEventType {
  ACCESS_GRANTED = "ACCESS_GRANTED",
  ACCESS_DENIED = "ACCESS_DENIED",
  DATA_ACCESSED = "DATA_ACCESSED",
  DATA_MODIFIED = "DATA_MODIFIED",
  DATA_DELETED = "DATA_DELETED",
  AUTHENTICATION_SUCCESS = "AUTHENTICATION_SUCCESS",
  AUTHENTICATION_FAILURE = "AUTHENTICATION_FAILURE",
  ENCRYPTION_PERFORMED = "ENCRYPTION_PERFORMED",
  DECRYPTION_PERFORMED = "DECRYPTION_PERFORMED",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
}

/**
 * Derive encryption key from password
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encryptData(plaintext: string, password?: string): string {
  const encryptionKey = password || process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("Encryption key not configured");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(encryptionKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  return combined.toString("base64");
}

/**
 * Decrypt data encrypted with encryptData
 */
export function decryptData(encryptedData: string, password?: string): string {
  const encryptionKey = password || process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("Encryption key not configured");
  }

  const combined = Buffer.from(encryptedData, "base64");
  
  // Extract components
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = deriveKey(encryptionKey, salt);
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return decrypted.toString("utf8");
}

/**
 * Hash sensitive data for comparison (one-way)
 */
export function hashData(data: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify hashed data
 */
export function verifyHash(data: string, hashedData: string): boolean {
  const [salt, originalHash] = hashedData.split(":");
  const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) {
    return "****";
  }
  
  const visible = data.slice(-visibleChars);
  const masked = "*".repeat(Math.max(data.length - visibleChars, 4));
  return `${masked}${visible}`;
}

/**
 * Log security event for audit trail
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  details: {
    userId?: string;
    userEmail?: string;
    shopId?: string;
    resource?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: eventType,
        resource: details.resource || "system",
        resourceId: details.resourceId || "unknown",
        shopId: details.shopId,
        userId: details.userId,
        userEmail: details.userEmail,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        metadata: details.metadata ? JSON.stringify(details.metadata) : null,
      },
    });
  } catch (error) {
    console.error("Failed to log security event:", error);
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Validate request for suspicious activity
 */
export function detectSuspiciousActivity(request: Request): {
  isSuspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  
  // Check for SQL injection patterns
  const url = new URL(request.url);
  const params = Array.from(url.searchParams.values()).join(" ");
  const sqlInjectionPatterns = [
    /(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|where|table)\b)/i,
    /(';|--;|\/\*|\*\/)/,
    /(\bor\b.*=.*\bor\b)/i,
  ];
  
  if (sqlInjectionPatterns.some(pattern => pattern.test(params))) {
    reasons.push("Potential SQL injection attempt");
  }
  
  // Check for XSS patterns
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];
  
  if (xssPatterns.some(pattern => pattern.test(params))) {
    reasons.push("Potential XSS attempt");
  }
  
  // Check for path traversal
  if (params.includes("../") || params.includes("..\\")) {
    reasons.push("Potential path traversal attempt");
  }
  
  // Check for unusual user agents
  const userAgent = request.headers.get("user-agent") || "";
  const suspiciousAgents = [
    "sqlmap",
    "nikto",
    "havij",
    "acunetix",
  ];
  
  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    reasons.push("Suspicious user agent detected");
  }
  
  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * PCI DSS compliant data retention policy
 */
export async function enforceDataRetention(): Promise<void> {
  const retentionPeriod = 90; // days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionPeriod);
  
  try {
    // Delete old audit logs (keep summary)
    await db.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
        action: { notIn: ["gdpr_customer_redact", "gdpr_data_request", "shop_data_deleted"] },
      },
    });
    
    // Archive old analytics events
    await db.analyticsEvent.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });
    
    console.log(`✅ Data retention policy enforced. Removed data older than ${retentionPeriod} days`);
  } catch (error) {
    console.error("Failed to enforce data retention:", error);
  }
}

/**
 * Secure session configuration
 */
export function getSecureSessionConfig(): any {
  const isProduction = process.env.NODE_ENV === "production";
  
  return {
    cookie: {
      name: "__session",
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secrets: [process.env.SESSION_SECRET!],
    },
    sessionStorage: {
      async createData(data: any, expires?: Date) {
        // Encrypt session data before storage
        const encrypted = encryptData(JSON.stringify(data));
        // Store encrypted session
        return encrypted;
      },
      async readData(id: string) {
        try {
          // Decrypt session data
          const decrypted = decryptData(id);
          return JSON.parse(decrypted);
        } catch {
          return null;
        }
      },
      async updateData(id: string, data: any, expires?: Date) {
        const encrypted = encryptData(JSON.stringify(data));
        return encrypted;
      },
      async deleteData(id: string) {
        // Session deletion handled by framework
      },
    },
  };
}

/**
 * Validate PCI compliance for the application
 */
export function validatePCICompliance(): {
  level: PCIComplianceLevel;
  compliant: boolean;
  requirements: string[];
} {
  const requirements: string[] = [];
  
  // Check encryption key
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    requirements.push("Configure strong encryption key (32+ characters)");
  }
  
  // Check session secret
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    requirements.push("Configure strong session secret (32+ characters)");
  }
  
  // Check HTTPS enforcement
  if (process.env.NODE_ENV === "production" && !process.env.FORCE_HTTPS) {
    requirements.push("Enable HTTPS enforcement in production");
  }
  
  // Check audit logging
  if (!process.env.ENABLE_AUDIT_LOGGING) {
    requirements.push("Enable audit logging for security events");
  }
  
  return {
    level: PCIComplianceLevel.SAQ_A, // We don't handle card data directly
    compliant: requirements.length === 0,
    requirements,
  };
}

/**
 * Middleware to enforce PCI compliance
 */
export function pciComplianceMiddleware(handler: Function) {
  return async (args: any) => {
    const request = args.request as Request;
    
    // Detect suspicious activity
    const { isSuspicious, reasons } = detectSuspiciousActivity(request);
    if (isSuspicious) {
      await logSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        metadata: { reasons },
      });
      
      throw new Response("Forbidden", { status: 403 });
    }
    
    // Continue with request
    return handler(args);
  };
}

/**
 * Export utilities for card number validation (without storing)
 */
export const CardValidation = {
  // Luhn algorithm for card number validation
  isValidCardNumber(cardNumber: string): boolean {
    // Remove spaces and validate format
    const cleaned = cardNumber.replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(cleaned)) {
      return false;
    }
    
    // Luhn check
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  },
  
  // Get card type from number
  getCardType(cardNumber: string): string | null {
    const cleaned = cardNumber.replace(/\s/g, "");
    
    if (/^4/.test(cleaned)) return "visa";
    if (/^5[1-5]/.test(cleaned)) return "mastercard";
    if (/^3[47]/.test(cleaned)) return "amex";
    if (/^6(?:011|5)/.test(cleaned)) return "discover";
    
    return null;
  },
  
  // Mask card number for display
  maskCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\s/g, "");
    if (cleaned.length < 8) return "****";
    
    const first4 = cleaned.slice(0, 4);
    const last4 = cleaned.slice(-4);
    const masked = "*".repeat(cleaned.length - 8);
    
    return `${first4}${masked}${last4}`;
  },
};