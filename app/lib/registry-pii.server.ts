import { encrypt, decrypt } from "./crypto.server";
import type { RegistryWithPII } from "./types";

export function encryptRegistryPII(registry: RegistryWithPII): RegistryWithPII {
  const encryptedRegistry = { ...registry };
  
  if (registry.customerEmail) {
    encryptedRegistry.customerEmail = encrypt(registry.customerEmail);
  }
  
  if (registry.customerPhone) {
    encryptedRegistry.customerPhone = encrypt(registry.customerPhone);
  }
  
  return encryptedRegistry;
}

export function decryptRegistryPII(registry: RegistryWithPII): RegistryWithPII {
  const decryptedRegistry = { ...registry };
  
  if (registry.customerEmail) {
    decryptedRegistry.customerEmail = decrypt(registry.customerEmail);
  }
  
  if (registry.customerPhone) {
    decryptedRegistry.customerPhone = decrypt(registry.customerPhone);
  }
  
  return decryptedRegistry;
}

export function decryptRegistryForDisplay(registry: RegistryWithPII | null): RegistryWithPII | null {
  if (!registry) return null;
  
  const decrypted = { ...registry };
  
  if (registry.customerEmail) {
    try {
      decrypted.customerEmail = decrypt(registry.customerEmail);
    } catch {
      decrypted.customerEmail = null;
    }
  }
  
  if (registry.customerPhone) {
    try {
      decrypted.customerPhone = decrypt(registry.customerPhone);
    } catch {
      decrypted.customerPhone = null;
    }
  }
  
  if (registry.registry_collaborators) {
    decrypted.registry_collaborators = registry.registry_collaborators.map((collab) => ({
      ...collab,
      email: collab.email ? decrypt(collab.email) : null
    }));
  }
  
  return decrypted;
}