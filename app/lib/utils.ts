/**
 * Client-side utilities for WishCraft
 * Formatting, validation, and helper functions
 */

import type { GraphQLResponse } from "./types";

// Price formatting
export function formatPrice(price: string | number, currencyCode = "USD"): string {
  const numPrice = typeof price === "string" ? parseFloat(price) || 0 : price || 0;
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(numPrice);
}

// Date formatting
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Text utilities
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

// Shopify ID utilities
export function extractShopifyId(gid: string): string {
  return gid.split("/").pop() || "";
}

export function createShopifyGid(resource: string, id: string): string {
  return `gid://shopify/${resource}/${id}`;
}

// GraphQL response handling
export function handleGraphQLResponse<T>(response: GraphQLResponse<T>): T {
  if (response.errors?.length) {
    throw new Error(response.errors[0].message);
  }
  
  if (!response.data) {
    throw new Error("No data received from GraphQL query");
  }
  
  return response.data;
}

// Performance utilities
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

// Registry utilities
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

// Simple validation
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
    "wedding", "birthday", "baby", "graduation", 
    "anniversary", "holiday", "housewarming", "general"
  ];
  
  if (!validEventTypes.includes(data.eventType)) {
    errors.push("Invalid event type");
  }
  
  return { isValid: errors.length === 0, errors };
}

// URL helper
export function getRegistryShareUrl(slug: string, domain: string): string {
  return `https://${domain}/registry/${slug}`;
}