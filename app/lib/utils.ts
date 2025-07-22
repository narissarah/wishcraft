// Utility functions for WishCraft app

import type { GraphQLResponse } from "./types";

// Sanitization utilities
export const Sanitizer = {
  string: (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
  },
  
  sanitizeHtml: (input: string): string => {
    return input.replace(/<[^>]*>/g, '').trim();
  },
  
  slug: (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },
  
  number: (input: any): number => {
    const num = parseFloat(input);
    return isNaN(num) ? 0 : num;
  },
  
  boolean: (input: any): boolean => {
    return Boolean(input);
  }
};

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

