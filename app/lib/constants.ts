/**
 * Application-wide constants
 */

// Time constants (in seconds)
export const TIME_CONSTANTS = {
  SESSION_DURATION_ADMIN: 60 * 60 * 24 * 30, // 30 days
  SESSION_DURATION_CUSTOMER: 60 * 60 * 24 * 7, // 7 days
  API_TIMEOUT_DEFAULT: 25000, // 25 seconds
  DATABASE_TIMEOUT: 10, // 10 seconds
} as const;

// API Limits
export const API_LIMITS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Registry Status Values
export const REGISTRY_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DRAFT: 'draft',
} as const;

// Registry Visibility Values
export const REGISTRY_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  FRIENDS: 'friends',
  PASSWORD: 'password',
} as const;

// Registry Event Types
export const REGISTRY_EVENT_TYPES = {
  WEDDING: 'wedding',
  BIRTHDAY: 'birthday',
  BABY: 'baby',
  GRADUATION: 'graduation',
  ANNIVERSARY: 'anniversary',
  HOLIDAY: 'holiday',
  HOUSEWARMING: 'housewarming',
  GENERAL: 'general',
} as const;

// Collaborator Status Values
export const COLLABORATOR_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DECLINED: 'declined',
  REMOVED: 'removed',
} as const;

// Registry Item Status Values
export const REGISTRY_ITEM_STATUS = {
  AVAILABLE: 'available',
  PURCHASED: 'purchased',
  PARTIALLY_PURCHASED: 'partially_purchased',
} as const;

// Query Limits
export const QUERY_LIMITS = {
  MAX_REGISTRIES_PER_CUSTOMER: 100,
  MAX_ORDERS_PER_QUERY: 20,
  MAX_ADDRESSES_PER_QUERY: 10,
  MAX_COLLABORATORS_PER_REGISTRY: 50,
  MAX_ITEMS_PER_REGISTRY: 100,
} as const;

// Type exports
export type RegistryStatus = typeof REGISTRY_STATUS[keyof typeof REGISTRY_STATUS];
export type RegistryVisibility = typeof REGISTRY_VISIBILITY[keyof typeof REGISTRY_VISIBILITY];
export type RegistryEventType = typeof REGISTRY_EVENT_TYPES[keyof typeof REGISTRY_EVENT_TYPES];
export type CollaboratorStatus = typeof COLLABORATOR_STATUS[keyof typeof COLLABORATOR_STATUS];
export type RegistryItemStatus = typeof REGISTRY_ITEM_STATUS[keyof typeof REGISTRY_ITEM_STATUS];