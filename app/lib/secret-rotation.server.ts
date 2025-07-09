/**
 * Secret Rotation Policies and Validation
 * Automated secret management and rotation for enhanced security
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { promisify } from 'util';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '~/monitoring/logger';
import { db } from './db.server';

// Secret types
export enum SecretType {
  SHOPIFY_SECRET = 'shopify_secret',
  SHOPIFY_WEBHOOK_SECRET = 'shopify_webhook_secret',
  SESSION_SECRET = 'session_secret',
  ENCRYPTION_KEY = 'encryption_key',
  DATABASE_PASSWORD = 'database_password',
  REDIS_PASSWORD = 'redis_password',
  JWT_SECRET = 'jwt_secret',
  API_KEY = 'api_key',
  WEBHOOK_SECRET = 'webhook_secret',
  OAUTH_SECRET = 'oauth_secret',
}

// Secret rotation policy
interface SecretRotationPolicy {
  type: SecretType;
  rotationInterval: number; // in milliseconds
  gracePeriod: number; // in milliseconds
  maxAge: number; // in milliseconds
  minLength: number;
  requiredCharacters: {
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
  excludeCharacters: string[];
  validateStrength: boolean;
  notifyBeforeRotation: number; // in milliseconds
  backupCount: number;
}

// Secret metadata
interface SecretMetadata {
  id: string;
  type: SecretType;
  version: number;
  createdAt: Date;
  lastRotated: Date;
  nextRotation: Date;
  isActive: boolean;
  checksum: string;
  encryptionMethod: string;
  rotationCount: number;
  usageCount: number;
  lastUsed: Date;
}

// Secret validation result
interface SecretValidationResult {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong' | 'very_strong';
  score: number;
  issues: string[];
  recommendations: string[];
}

// Secret rotation result
interface SecretRotationResult {
  success: boolean;
  secretId: string;
  oldVersion: number;
  newVersion: number;
  rotatedAt: Date;
  error?: string;
}

// Secret audit log entry
interface SecretAuditEntry {
  id: string;
  secretId: string;
  action: 'created' | 'rotated' | 'accessed' | 'validated' | 'archived';
  timestamp: Date;
  userId?: string;
  metadata: Record<string, any>;
}

/**
 * Secret Manager Class
 */
export class SecretManager {
  private secrets: Map<string, SecretMetadata> = new Map();
  private policies: Map<SecretType, SecretRotationPolicy> = new Map();
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();
  private auditLog: SecretAuditEntry[] = [];
  private encryptionKey: Buffer;
  private secretsPath: string;

  constructor(secretsPath: string = './secrets') {
    this.secretsPath = secretsPath;
    this.encryptionKey = this.deriveEncryptionKey();
    this.initializePolicies();
    this.loadSecrets();
    this.startRotationScheduler();
  }

  /**
   * Initialize default rotation policies
   */
  private initializePolicies(): void {
    const defaultPolicies: Array<{ type: SecretType; policy: SecretRotationPolicy }> = [
      {
        type: SecretType.SHOPIFY_SECRET,
        policy: {
          type: SecretType.SHOPIFY_SECRET,
          rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
          gracePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
          minLength: 32,
          requiredCharacters: {
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
          },
          excludeCharacters: ['"', "'", '\\', '`'],
          validateStrength: true,
          notifyBeforeRotation: 7 * 24 * 60 * 60 * 1000, // 7 days
          backupCount: 3,
        },
      },
      {
        type: SecretType.SESSION_SECRET,
        policy: {
          type: SecretType.SESSION_SECRET,
          rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
          gracePeriod: 24 * 60 * 60 * 1000, // 1 day
          maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
          minLength: 64,
          requiredCharacters: {
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: false,
          },
          excludeCharacters: [],
          validateStrength: true,
          notifyBeforeRotation: 3 * 24 * 60 * 60 * 1000, // 3 days
          backupCount: 2,
        },
      },
      {
        type: SecretType.JWT_SECRET,
        policy: {
          type: SecretType.JWT_SECRET,
          rotationInterval: 15 * 24 * 60 * 60 * 1000, // 15 days
          gracePeriod: 60 * 60 * 1000, // 1 hour
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          minLength: 32,
          requiredCharacters: {
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
          },
          excludeCharacters: ['"', "'", '\\'],
          validateStrength: true,
          notifyBeforeRotation: 24 * 60 * 60 * 1000, // 1 day
          backupCount: 3,
        },
      },
      {
        type: SecretType.DATABASE_PASSWORD,
        policy: {
          type: SecretType.DATABASE_PASSWORD,
          rotationInterval: 60 * 24 * 60 * 60 * 1000, // 60 days
          gracePeriod: 5 * 60 * 1000, // 5 minutes
          maxAge: 120 * 24 * 60 * 60 * 1000, // 120 days
          minLength: 20,
          requiredCharacters: {
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
          },
          excludeCharacters: ['"', "'", '\\', '`', '$', ';'],
          validateStrength: true,
          notifyBeforeRotation: 7 * 24 * 60 * 60 * 1000, // 7 days
          backupCount: 2,
        },
      },
    ];

    defaultPolicies.forEach(({ type, policy }) => {
      this.policies.set(type, policy);
    });
  }

  /**
   * Derive encryption key from environment
   */
  private deriveEncryptionKey(): Buffer {
    const salt = process.env.SECRET_ENCRYPTION_SALT || 'wishcraft-secret-salt';
    const password = process.env.SECRET_ENCRYPTION_PASSWORD || 'wishcraft-default-password';
    
    return pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  /**
   * Load secrets from storage
   */
  private async loadSecrets(): Promise<void> {
    try {
      const secretsFile = join(this.secretsPath, 'secrets.json');
      await access(secretsFile);
      
      const encryptedData = await readFile(secretsFile, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const secretsData = JSON.parse(decryptedData);
      
      secretsData.forEach((secret: any) => {
        this.secrets.set(secret.id, {
          ...secret,
          createdAt: new Date(secret.createdAt),
          lastRotated: new Date(secret.lastRotated),
          nextRotation: new Date(secret.nextRotation),
          lastUsed: new Date(secret.lastUsed),
        });
      });
      
      logger.info(`Loaded ${this.secrets.size} secrets from storage`);
    } catch (error) {
      logger.info('No existing secrets file found, starting fresh');
    }
  }

  /**
   * Save secrets to storage
   */
  private async saveSecrets(): Promise<void> {
    try {
      const secretsData = Array.from(this.secrets.values());
      const jsonData = JSON.stringify(secretsData, null, 2);
      const encryptedData = this.encrypt(jsonData);
      
      const secretsFile = join(this.secretsPath, 'secrets.json');
      await writeFile(secretsFile, encryptedData, 'utf8');
      
      logger.info('Secrets saved to storage');
    } catch (error) {
      logger.error('Failed to save secrets:', error);
    }
  }

  /**
   * Encrypt data
   */
  private encrypt(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data
   */
  private decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate a secure secret
   */
  private generateSecret(policy: SecretRotationPolicy): string {
    const charset = this.buildCharset(policy);
    const length = Math.max(policy.minLength, 32);
    
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += charset[Math.floor(Math.random() * charset.length)];
    }
    
    return secret;
  }

  /**
   * Build character set for secret generation
   */
  private buildCharset(policy: SecretRotationPolicy): string {
    let charset = '';
    
    if (policy.requiredCharacters.lowercase) {
      charset += 'abcdefghijklmnopqrstuvwxyz';
    }
    
    if (policy.requiredCharacters.uppercase) {
      charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    if (policy.requiredCharacters.numbers) {
      charset += '0123456789';
    }
    
    if (policy.requiredCharacters.symbols) {
      charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }
    
    // Remove excluded characters
    policy.excludeCharacters.forEach(char => {
      charset = charset.replace(new RegExp(char, 'g'), '');
    });
    
    return charset;
  }

  /**
   * Validate secret strength
   */
  validateSecret(secret: string, policy: SecretRotationPolicy): SecretValidationResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    
    // Check length
    if (secret.length < policy.minLength) {
      issues.push(`Secret is too short (${secret.length} chars, minimum ${policy.minLength})`);
    } else {
      score += 20;
    }
    
    // Check character requirements
    if (policy.requiredCharacters.uppercase && !/[A-Z]/.test(secret)) {
      issues.push('Secret must contain uppercase letters');
    } else if (policy.requiredCharacters.uppercase) {
      score += 15;
    }
    
    if (policy.requiredCharacters.lowercase && !/[a-z]/.test(secret)) {
      issues.push('Secret must contain lowercase letters');
    } else if (policy.requiredCharacters.lowercase) {
      score += 15;
    }
    
    if (policy.requiredCharacters.numbers && !/[0-9]/.test(secret)) {
      issues.push('Secret must contain numbers');
    } else if (policy.requiredCharacters.numbers) {
      score += 15;
    }
    
    if (policy.requiredCharacters.symbols && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(secret)) {
      issues.push('Secret must contain symbols');
    } else if (policy.requiredCharacters.symbols) {
      score += 15;
    }
    
    // Check excluded characters
    const excludedFound = policy.excludeCharacters.filter(char => secret.includes(char));
    if (excludedFound.length > 0) {
      issues.push(`Secret contains excluded characters: ${excludedFound.join(', ')}`);
    }
    
    // Check for common patterns
    if (/(.)\1{2,}/.test(secret)) {
      issues.push('Secret contains repeating characters');
      score -= 10;
    }
    
    if (/123|abc|qwe|password|secret/.test(secret.toLowerCase())) {
      issues.push('Secret contains common patterns');
      score -= 20;
    }
    
    // Calculate entropy
    const uniqueChars = new Set(secret).size;
    const entropy = secret.length * Math.log2(uniqueChars);
    
    if (entropy < 50) {
      issues.push('Secret has low entropy');
    } else if (entropy > 80) {
      score += 20;
    }
    
    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' | 'very_strong' = 'weak';
    if (score >= 80) strength = 'very_strong';
    else if (score >= 60) strength = 'strong';
    else if (score >= 40) strength = 'medium';
    
    // Generate recommendations
    if (issues.length > 0) {
      recommendations.push('Consider using a password manager or generator');
      recommendations.push('Ensure the secret meets all policy requirements');
    }
    
    if (entropy < 80) {
      recommendations.push('Increase secret length or use more character types');
    }
    
    return {
      isValid: issues.length === 0,
      strength,
      score: Math.max(0, Math.min(100, score)),
      issues,
      recommendations,
    };
  }

  /**
   * Create a new secret
   */
  async createSecret(
    id: string,
    type: SecretType,
    value?: string,
    customPolicy?: Partial<SecretRotationPolicy>
  ): Promise<SecretMetadata> {
    const policy = this.policies.get(type);
    if (!policy) {
      throw new Error(`No policy defined for secret type: ${type}`);
    }
    
    const mergedPolicy = { ...policy, ...customPolicy };
    const secretValue = value || this.generateSecret(mergedPolicy);
    
    // Validate secret
    if (mergedPolicy.validateStrength) {
      const validation = this.validateSecret(secretValue, mergedPolicy);
      if (!validation.isValid) {
        throw new Error(`Secret validation failed: ${validation.issues.join(', ')}`);
      }
    }
    
    const now = new Date();
    const metadata: SecretMetadata = {
      id,
      type,
      version: 1,
      createdAt: now,
      lastRotated: now,
      nextRotation: new Date(now.getTime() + mergedPolicy.rotationInterval),
      isActive: true,
      checksum: createHash('sha256').update(secretValue).digest('hex'),
      encryptionMethod: 'aes-256-gcm',
      rotationCount: 0,
      usageCount: 0,
      lastUsed: now,
    };
    
    this.secrets.set(id, metadata);
    
    // Store encrypted secret value
    await this.storeSecretValue(id, secretValue);
    
    // Schedule rotation
    this.scheduleRotation(id, mergedPolicy);
    
    // Log audit entry
    this.addAuditEntry({
      id: `audit-${Date.now()}`,
      secretId: id,
      action: 'created',
      timestamp: now,
      metadata: {
        type,
        version: 1,
        strength: this.validateSecret(secretValue, mergedPolicy).strength,
      },
    });
    
    await this.saveSecrets();
    
    logger.info(`Secret created: ${id} (type: ${type})`);
    
    return metadata;
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(id: string, force: boolean = false): Promise<SecretRotationResult> {
    const metadata = this.secrets.get(id);
    if (!metadata) {
      throw new Error(`Secret not found: ${id}`);
    }
    
    const policy = this.policies.get(metadata.type);
    if (!policy) {
      throw new Error(`No policy defined for secret type: ${metadata.type}`);
    }
    
    // Check if rotation is needed
    if (!force && new Date() < metadata.nextRotation) {
      throw new Error(`Secret rotation not due yet: ${id}`);
    }
    
    try {
      // Generate new secret
      const newSecretValue = this.generateSecret(policy);
      
      // Validate new secret
      const validation = this.validateSecret(newSecretValue, policy);
      if (!validation.isValid) {
        throw new Error(`New secret validation failed: ${validation.issues.join(', ')}`);
      }
      
      // Update metadata
      const now = new Date();
      const oldVersion = metadata.version;
      metadata.version += 1;
      metadata.lastRotated = now;
      metadata.nextRotation = new Date(now.getTime() + policy.rotationInterval);
      metadata.rotationCount += 1;
      metadata.checksum = createHash('sha256').update(newSecretValue).digest('hex');
      
      // Store new secret value
      await this.storeSecretValue(id, newSecretValue);
      
      // Archive old version
      await this.archiveSecretVersion(id, oldVersion);
      
      // Reschedule rotation
      this.scheduleRotation(id, policy);
      
      // Log audit entry
      this.addAuditEntry({
        id: `audit-${Date.now()}`,
        secretId: id,
        action: 'rotated',
        timestamp: now,
        metadata: {
          oldVersion,
          newVersion: metadata.version,
          strength: validation.strength,
        },
      });
      
      await this.saveSecrets();
      
      logger.info(`Secret rotated: ${id} (version ${oldVersion} -> ${metadata.version})`);
      
      return {
        success: true,
        secretId: id,
        oldVersion,
        newVersion: metadata.version,
        rotatedAt: now,
      };
    } catch (error) {
      logger.error(`Secret rotation failed: ${id}`, error);
      
      return {
        success: false,
        secretId: id,
        oldVersion: metadata.version,
        newVersion: metadata.version,
        rotatedAt: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Get secret value
   */
  async getSecret(id: string): Promise<string> {
    const metadata = this.secrets.get(id);
    if (!metadata) {
      throw new Error(`Secret not found: ${id}`);
    }
    
    if (!metadata.isActive) {
      throw new Error(`Secret is not active: ${id}`);
    }
    
    // Update usage statistics
    metadata.usageCount += 1;
    metadata.lastUsed = new Date();
    
    // Log access
    this.addAuditEntry({
      id: `audit-${Date.now()}`,
      secretId: id,
      action: 'accessed',
      timestamp: new Date(),
      metadata: {
        version: metadata.version,
        usageCount: metadata.usageCount,
      },
    });
    
    return this.loadSecretValue(id);
  }

  /**
   * Store secret value
   */
  private async storeSecretValue(id: string, value: string): Promise<void> {
    const encryptedValue = this.encrypt(value);
    const secretFile = join(this.secretsPath, `${id}.secret`);
    await writeFile(secretFile, encryptedValue, 'utf8');
  }

  /**
   * Load secret value
   */
  private async loadSecretValue(id: string): Promise<string> {
    const secretFile = join(this.secretsPath, `${id}.secret`);
    const encryptedValue = await readFile(secretFile, 'utf8');
    return this.decrypt(encryptedValue);
  }

  /**
   * Archive secret version
   */
  private async archiveSecretVersion(id: string, version: number): Promise<void> {
    const policy = this.policies.get(this.secrets.get(id)!.type)!;
    const archiveFile = join(this.secretsPath, `${id}.v${version}.archive`);
    const secretFile = join(this.secretsPath, `${id}.secret`);
    
    try {
      const secretValue = await readFile(secretFile, 'utf8');
      await writeFile(archiveFile, secretValue, 'utf8');
      
      // Clean up old archives
      const metadata = this.secrets.get(id)!;
      if (metadata.version > policy.backupCount) {
        const oldArchiveFile = join(this.secretsPath, `${id}.v${metadata.version - policy.backupCount}.archive`);
        try {
          await readFile(oldArchiveFile);
          // File exists, remove it
          // In a real implementation, you'd use fs.unlink here
        } catch (error) {
          // File doesn't exist, ignore
        }
      }
    } catch (error) {
      logger.error(`Failed to archive secret version: ${id}.v${version}`, error);
    }
  }

  /**
   * Schedule rotation
   */
  private scheduleRotation(id: string, policy: SecretRotationPolicy): void {
    const existing = this.rotationTimers.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    
    const metadata = this.secrets.get(id)!;
    const timeToRotation = metadata.nextRotation.getTime() - Date.now();
    
    if (timeToRotation > 0) {
      const timer = setTimeout(async () => {
        try {
          await this.rotateSecret(id);
        } catch (error) {
          logger.error(`Scheduled rotation failed: ${id}`, error);
        }
      }, timeToRotation);
      
      this.rotationTimers.set(id, timer);
    }
    
    // Schedule notification
    const notificationTime = timeToRotation - policy.notifyBeforeRotation;
    if (notificationTime > 0) {
      setTimeout(() => {
        this.notifyRotationDue(id);
      }, notificationTime);
    }
  }

  /**
   * Notify rotation due
   */
  private notifyRotationDue(id: string): void {
    const metadata = this.secrets.get(id);
    if (!metadata) return;
    
    logger.warn(`Secret rotation due soon: ${id}`, {
      secretId: id,
      type: metadata.type,
      nextRotation: metadata.nextRotation,
    });
    
    // In a real implementation, you'd send notifications here
    // (email, Slack, etc.)
  }

  /**
   * Add audit entry
   */
  private addAuditEntry(entry: SecretAuditEntry): void {
    this.auditLog.push(entry);
    
    // Limit audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Start rotation scheduler
   */
  private startRotationScheduler(): void {
    this.secrets.forEach((metadata, id) => {
      const policy = this.policies.get(metadata.type);
      if (policy) {
        this.scheduleRotation(id, policy);
      }
    });
  }

  /**
   * Get secret metadata
   */
  getSecretMetadata(id: string): SecretMetadata | undefined {
    return this.secrets.get(id);
  }

  /**
   * List all secrets
   */
  listSecrets(): SecretMetadata[] {
    return Array.from(this.secrets.values());
  }

  /**
   * Get audit log
   */
  getAuditLog(secretId?: string): SecretAuditEntry[] {
    if (secretId) {
      return this.auditLog.filter(entry => entry.secretId === secretId);
    }
    return this.auditLog;
  }

  /**
   * Set rotation policy
   */
  setRotationPolicy(type: SecretType, policy: SecretRotationPolicy): void {
    this.policies.set(type, policy);
  }

  /**
   * Get rotation policy
   */
  getRotationPolicy(type: SecretType): SecretRotationPolicy | undefined {
    return this.policies.get(type);
  }

  /**
   * Delete secret
   */
  async deleteSecret(id: string): Promise<void> {
    const metadata = this.secrets.get(id);
    if (!metadata) {
      throw new Error(`Secret not found: ${id}`);
    }
    
    // Clear rotation timer
    const timer = this.rotationTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.rotationTimers.delete(id);
    }
    
    // Remove from memory
    this.secrets.delete(id);
    
    // Archive for compliance
    this.addAuditEntry({
      id: `audit-${Date.now()}`,
      secretId: id,
      action: 'archived',
      timestamp: new Date(),
      metadata: {
        type: metadata.type,
        version: metadata.version,
        reason: 'deleted',
      },
    });
    
    await this.saveSecrets();
    
    logger.info(`Secret deleted: ${id}`);
  }

  /**
   * Shutdown the secret manager
   */
  shutdown(): void {
    this.rotationTimers.forEach(timer => {
      clearTimeout(timer);
    });
    this.rotationTimers.clear();
    
    logger.info('Secret manager shutdown');
  }
}

// Create and export singleton instance
export const secretManager = new SecretManager();

// Export types and enums
export type {
  SecretRotationPolicy,
  SecretMetadata,
  SecretValidationResult,
  SecretRotationResult,
  SecretAuditEntry,
};

// Environment variable validation
export function validateEnvironmentSecrets(): void {
  const requiredSecrets = [
    'SHOPIFY_API_SECRET',
    'SHOPIFY_WEBHOOK_SECRET',
    'SESSION_SECRET',
    'DATABASE_URL',
  ];
  
  const missing = requiredSecrets.filter(secret => !process.env[secret]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment secrets: ${missing.join(', ')}`);
  }
  
  // Validate secret strength
  requiredSecrets.forEach(secret => {
    const value = process.env[secret]!;
    const policy = secretManager.getRotationPolicy(SecretType.SHOPIFY_SECRET);
    
    if (policy) {
      const validation = secretManager.validateSecret(value, policy);
      if (!validation.isValid) {
        logger.warn(`Weak secret detected: ${secret}`, {
          secret,
          issues: validation.issues,
          strength: validation.strength,
        });
      }
    }
  });
}

export default secretManager;