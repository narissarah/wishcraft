/**
 * Registry PII encryption/decryption utilities
 * Handles sensitive data for registry operations
 */

import { encryptPII, decryptPII } from "~/lib/crypto.server";

export interface RegistryPII {
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
}

export interface EncryptedRegistryPII {
  customerEmail: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
}

/**
 * Encrypt registry PII data
 */
export function encryptRegistryPII(data: RegistryPII): EncryptedRegistryPII {
  return {
    customerEmail: data.customerEmail ? encryptPII(data.customerEmail) : encryptPII(''),
    customerFirstName: data.customerFirstName ? encryptPII(data.customerFirstName) : undefined,
    customerLastName: data.customerLastName ? encryptPII(data.customerLastName) : undefined,
    customerPhone: data.customerPhone ? encryptPII(data.customerPhone) : undefined,
  };
}

/**
 * Decrypt registry PII data
 */
export function decryptRegistryPII(data: EncryptedRegistryPII): RegistryPII {
  return {
    customerEmail: data.customerEmail ? decryptPII(data.customerEmail) : undefined,
    customerFirstName: data.customerFirstName ? decryptPII(data.customerFirstName) : undefined,
    customerLastName: data.customerLastName ? decryptPII(data.customerLastName) : undefined,
    customerPhone: data.customerPhone ? decryptPII(data.customerPhone) : undefined,
  };
}

/**
 * Decrypt registry for safe display
 */
export function decryptRegistryForDisplay(registry: any): any {
  if (!registry) return registry;
  
  const decrypted = { ...registry };
  
  if (registry.customerEmail) {
    decrypted.customerEmail = decryptPII(registry.customerEmail);
  }
  if (registry.customerFirstName) {
    decrypted.customerFirstName = decryptPII(registry.customerFirstName);
  }
  if (registry.customerLastName) {
    decrypted.customerLastName = decryptPII(registry.customerLastName);
  }
  if (registry.customerPhone) {
    decrypted.customerPhone = decryptPII(registry.customerPhone);
  }
  
  return decrypted;
}