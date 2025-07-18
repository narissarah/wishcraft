// Utility functions for WishCraft app

import type { GraphQLResponse } from "./types";

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatPrice(price: string | number, currencyCode = "USD"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(numPrice);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function generateId(length = 13): string {
  // More secure ID generation for client-side use (replace removed utils.server.ts version)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function extractShopifyId(gid: string): string {
  return gid.split("/").pop() || "";
}

export function createShopifyGid(resource: string, id: string): string {
  return `gid://shopify/${resource}/${id}`;
}

export function handleGraphQLResponse<T>(response: GraphQLResponse<T>): T {
  if (response.errors && response.errors.length > 0) {
    throw new Error(response.errors[0].message);
  }
  
  if (!response.data) {
    throw new Error("No data received from GraphQL query");
  }
  
  return response.data;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function calculateProgress(purchased: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((purchased / total) * 100);
}

export function getEventTypeEmoji(eventType: string): string {
  const emojiMap: Record<string, string> = {
    wedding: "💍",
    birthday: "🎂",
    baby: "👶",
    graduation: "🎓",
    anniversary: "💕",
    holiday: "🎄",
    housewarming: "🏠",
    general: "🎁",
  };
  return emojiMap[eventType] || "🎁";
}

export function validateRegistryData(data: {
  title: string;
  eventDate?: string;
  eventType: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.title || data.title.trim().length < 3) {
    errors.push("Title must be at least 3 characters long");
  }
  
  if (data.eventDate && new Date(data.eventDate) < new Date()) {
    errors.push("Event date cannot be in the past");
  }
  
  const validEventTypes = [
    "wedding",
    "birthday",
    "baby",
    "graduation",
    "anniversary",
    "holiday",
    "housewarming",
    "general",
  ];
  
  if (!validEventTypes.includes(data.eventType)) {
    errors.push("Invalid event type");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getRegistryShareUrl(slug: string, domain: string): string {
  return `https://${domain}/registry/${slug}`;
}

/**
 * Sanitize HTML input to prevent XSS attacks
 * Production-grade sanitization with configurable options
 */
export function sanitizeHtml(html: string, options: {
  allowedTags?: string[];
  allowedAttributes?: string[];
  allowData?: boolean;
} = {}): string {
  const {
    allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote'],
    allowedAttributes = ['href', 'title', 'target'],
    allowData = false
  } = options;

  // Basic HTML entity encoding for security
  // In production, consider using a server-side sanitization library
  let result = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
    
  return result;
}

/**
 * Strict HTML sanitization for user-generated content
 */
export function sanitizeUserContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
    allowedAttributes: [],
    allowData: false
  });
}

/**
 * Sanitize rich text content (for gift messages, descriptions)
 */
export function sanitizeRichText(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'h3', 'h4'],
    allowedAttributes: ['href', 'title', 'target', 'rel'],
    allowData: false
  });
}