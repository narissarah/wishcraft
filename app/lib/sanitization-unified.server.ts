/**
 * Unified Sanitization System
 * Consolidates all sanitization functions into a single, comprehensive utility
 * Eliminates duplicate sanitization logic across the codebase
 */

// Server-side sanitization utilities
import { log } from "./logger.server";

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  maxLength?: number;
  preserveFormatting?: boolean;
  logAttempts?: boolean;
}

/**
 * Comprehensive sanitization utility class
 */
export class SanitizationService {
  private static instance: SanitizationService;
  
  private readonly SQL_INJECTION_PATTERNS = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR|SCRIPT|IFRAME|OBJECT|EMBED|APPLET)\b)/gi,
    /(\b(AND|OR|NOT)\s+\d+\s*[=><!]+\s*\d+)/gi,
    /(\b(AND|OR|NOT)\s+['"]?\w+['"]?\s*[=><!]+\s*['"]?\w+['"]?)/gi,
    /(\-\-|\#|\/\*|\*\/)/g,
    /(\b(XSS|ALERT|CONFIRM|PROMPT|EVAL|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR)\b)/gi,
    /(<script|<iframe|<object|<embed|<applet|<form|<link|<meta|<style)/gi,
    /(\bon\w+\s*=)/gi,
    /(\bjavascript\s*:)/gi,
    /(\bvbscript\s*:)/gi,
    /(\bdata\s*:)/gi,
    /(\bexpression\s*\()/gi,
    /['"`;]/g,
    /(\(|\)|\[|\]|\{|\})/g,
    /([<>])/g,
    /(\\)/g,
    /(%[0-9a-fA-F]{2})/g,
    /(\&#[0-9]+;)/g,
    /(\&[a-zA-Z]+;)/g,
    /(\&#x[0-9a-fA-F]+;)/g,
  ];

  private constructor() {}

  public static getInstance(): SanitizationService {
    if (!SanitizationService.instance) {
      SanitizationService.instance = new SanitizationService();
    }
    return SanitizationService.instance;
  }

  /**
   * Sanitize plain text input - removes all HTML tags and normalizes whitespace
   */
  public sanitizeText(text: string, options: SanitizationOptions = {}): string {
    if (!text || typeof text !== 'string') return '';

    const {
      maxLength = 1000,
      logAttempts = false
    } = options;

    const original = text;
    
    // Remove HTML tags and decode entities
    let cleaned = text.replace(/<[^>]*>/g, '');
    
    // Normalize whitespace
    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    // Apply length limit
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
    }

    // Log sanitization attempts if enabled
    if (logAttempts && cleaned !== original) {
      log.debug('Text sanitization applied', {
        original: original.substring(0, 100),
        sanitized: cleaned.substring(0, 100),
        lengthReduction: original.length - cleaned.length
      });
    }

    return cleaned;
  }

  /**
   * Sanitize HTML content with configurable allowed tags
   */
  public sanitizeHtml(html: string, options: SanitizationOptions = {}): string {
    if (!html || typeof html !== 'string') return '';

    const {
      allowedTags = [],
      allowedAttributes = [],
      maxLength = 5000,
      logAttempts = false
    } = options;

    const original = html;

    const config = {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttributes,
      REMOVE_DATA_ATTRS: true,
      REMOVE_UNKNOWN_SCHEMAS: true,
      USE_PROFILES: { html: true }
    };

    // Basic HTML entity encoding for security
    let cleaned = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Apply length limit
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
    }

    // Log sanitization attempts if enabled
    if (logAttempts && cleaned !== original) {
      log.debug('HTML sanitization applied', {
        original: original.substring(0, 100),
        sanitized: cleaned.substring(0, 100),
        tagsRemoved: (original.match(/<[^>]*>/g) || []).length - (cleaned.match(/<[^>]*>/g) || []).length
      });
    }

    return cleaned;
  }

  /**
   * Sanitize gift message content with basic formatting support
   */
  public sanitizeGiftMessage(message: string, options: SanitizationOptions = {}): string {
    if (!message || typeof message !== 'string') return '';

    const {
      allowedTags = ['b', 'i', 'em', 'strong', 'br'],
      allowedAttributes = [],
      maxLength = 500,
      logAttempts = false
    } = options;

    return this.sanitizeHtml(message, {
      allowedTags,
      allowedAttributes,
      maxLength,
      logAttempts
    });
  }

  /**
   * Sanitize search query with SQL injection protection
   */
  public sanitizeSearchQuery(query: string, options: SanitizationOptions = {}): string {
    if (!query || typeof query !== 'string') return '';

    const {
      maxLength = 100,
      logAttempts = true
    } = options;

    const original = query;
    let sanitized = query;

    // Apply SQL injection patterns
    this.SQL_INJECTION_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Remove remaining special characters
    sanitized = sanitized.replace(/[^\w\s-]/g, '');

    // Normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');

    // Apply length limit
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Log potential injection attempts
    if (logAttempts && sanitized !== original) {
      log.warn('Potential SQL injection attempt detected and sanitized', {
        original,
        sanitized,
        timestamp: new Date().toISOString()
      });
    }

    return sanitized;
  }

  /**
   * Sanitize general user input with XSS protection
   */
  public sanitizeInput(input: string, options: SanitizationOptions = {}): string {
    if (!input || typeof input !== 'string') return '';

    const {
      maxLength = 1000,
      logAttempts = false
    } = options;

    const original = input;
    let sanitized = input;

    // Remove HTML tags and scripts
    sanitized = sanitized.replace(/[<>]/g, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    
    // Normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');

    // Apply length limit
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Log sanitization attempts if enabled
    if (logAttempts && sanitized !== original) {
      log.debug('Input sanitization applied', {
        original: original.substring(0, 100),
        sanitized: sanitized.substring(0, 100)
      });
    }

    return sanitized;
  }

  /**
   * Sanitize email for search purposes
   */
  public sanitizeEmailForSearch(email: string): string {
    if (!email || typeof email !== 'string') return '';

    // Basic email validation and normalization
    const sanitized = email
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9@._-]/g, '');

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(sanitized)) {
      return '';
    }

    return sanitized;
  }

  /**
   * Sanitize customer data
   */
  public sanitizeCustomerData(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } {
    return {
      firstName: data.firstName ? this.sanitizeText(data.firstName, { maxLength: 50 }) : undefined,
      lastName: data.lastName ? this.sanitizeText(data.lastName, { maxLength: 50 }) : undefined,
      email: data.email ? this.sanitizeEmailForSearch(data.email) : undefined,
      phone: data.phone ? this.sanitizeText(data.phone, { maxLength: 20 }) : undefined
    };
  }

  /**
   * Sanitize filename for file uploads
   */
  public sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') return '';

    return filename
      .replace(/[^\w.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100);
  }

  /**
   * Create a slug from text
   */
  public createSlug(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Sanitize rich text content with extended formatting
   */
  public sanitizeRichText(content: string, options: SanitizationOptions = {}): string {
    if (!content || typeof content !== 'string') return '';

    const {
      allowedTags = ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'a'],
      allowedAttributes = ['href', 'title'],
      maxLength = 2000,
      logAttempts = false
    } = options;

    return this.sanitizeHtml(content, {
      allowedTags,
      allowedAttributes,
      maxLength,
      logAttempts
    });
  }

  /**
   * Batch sanitize multiple values
   */
  public batchSanitize(values: Record<string, string>, type: 'text' | 'html' | 'input' = 'text'): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(values)) {
      switch (type) {
        case 'html':
          sanitized[key] = this.sanitizeHtml(value);
          break;
        case 'input':
          sanitized[key] = this.sanitizeInput(value);
          break;
        case 'text':
        default:
          sanitized[key] = this.sanitizeText(value);
          break;
      }
    }

    return sanitized;
  }

  /**
   * Validate and sanitize URL
   */
  public sanitizeUrl(url: string, options: { maxLength?: number; allowedProtocols?: string[] } = {}): string {
    if (!url || typeof url !== 'string') return '';

    const {
      maxLength = 2048,
      allowedProtocols = ['http:', 'https:']
    } = options;

    try {
      const urlObj = new URL(url);
      
      // Check allowed protocols
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return '';
      }

      // Apply length limit
      const sanitized = url.length > maxLength ? url.substring(0, maxLength) : url;
      
      return sanitized;
    } catch {
      return '';
    }
  }
}

// Create singleton instance
export const sanitizationService = SanitizationService.getInstance();

// Export convenience functions for backward compatibility
export const sanitizeText = (text: string, options?: SanitizationOptions) => 
  sanitizationService.sanitizeText(text, options);

export const sanitizeHtml = (html: string, options?: SanitizationOptions) => 
  sanitizationService.sanitizeHtml(html, options);

export const sanitizeGiftMessage = (message: string, options?: SanitizationOptions) => 
  sanitizationService.sanitizeGiftMessage(message, options);

export const sanitizeSearchQuery = (query: string, options?: SanitizationOptions) => 
  sanitizationService.sanitizeSearchQuery(query, options);

export const sanitizeInput = (input: string, options?: SanitizationOptions) => 
  sanitizationService.sanitizeInput(input, options);

export const sanitizeEmailForSearch = (email: string) => 
  sanitizationService.sanitizeEmailForSearch(email);

export const sanitizeCustomerData = (data: any) => 
  sanitizationService.sanitizeCustomerData(data);

export const sanitizeFilename = (filename: string) => 
  sanitizationService.sanitizeFilename(filename);

export const createSlug = (text: string) => 
  sanitizationService.createSlug(text);

export const sanitizeRichText = (content: string, options?: SanitizationOptions) => 
  sanitizationService.sanitizeRichText(content, options);

export const sanitizeUrl = (url: string, options?: { maxLength?: number; allowedProtocols?: string[] }) => 
  sanitizationService.sanitizeUrl(url, options);

/**
 * Legacy exports for migration compatibility
 */
export const Sanitizer = {
  sanitizeHtml: sanitizeText,
  sanitizeGiftMessage,
  sanitizeSearchQuery,
  createSlug,
  sanitizeCustomerData
};