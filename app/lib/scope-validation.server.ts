/**
 * OAuth Scope Validation for Shopify 2025 Compliance
 * Ensures minimal required permissions and validates scope usage
 */

import { logger } from './logger.server';

// Minimal required scopes for WishCraft functionality
export const REQUIRED_SCOPES = [
  'read_customers',
  'read_orders',
  'write_orders',
  'read_products',
  'read_inventory',
  'write_inventory',
  'read_metaobjects',
  'write_metaobjects',
] as const;

// Scope usage tracking for compliance
export const SCOPE_USAGE_MAP = {
  'read_customers': [
    'Customer registry lookup',
    'Customer data export (GDPR)',
    'Registry sharing permissions',
  ],
  'read_orders': [
    'Registry purchase tracking',
    'Order fulfillment status',
    'Purchase notifications',
  ],
  'write_orders': [
    'Registry purchase completion',
    'Order notes with registry info',
  ],
  'read_products': [
    'Registry item synchronization',
    'Product availability checking',
    'Inventory level monitoring',
  ],
  'read_inventory': [
    'Real-time inventory sync',
    'Stock level alerts',
    'Availability notifications',
  ],
  'write_inventory': [
    'Registry reservation system',
    'Inventory hold for purchases',
  ],
  'read_metaobjects': [
    'Registry metadata storage',
    'Custom registry fields',
  ],
  'write_metaobjects': [
    'Registry data persistence',
    'Custom field updates',
  ],
} as const;

type RequiredScope = typeof REQUIRED_SCOPES[number];

export interface ScopeValidationResult {
  valid: boolean;
  missingScopes: string[];
  excessScopes: string[];
  recommendations: string[];
}

/**
 * Validate OAuth scopes for 2025 compliance
 */
export function validateScopes(grantedScopes: string[]): ScopeValidationResult {
  const granted = new Set(grantedScopes);
  const required = new Set(REQUIRED_SCOPES);
  
  const missingScopes = REQUIRED_SCOPES.filter(scope => !granted.has(scope));
  const excessScopes = grantedScopes.filter(scope => !required.has(scope as RequiredScope));
  
  const recommendations: string[] = [];
  
  if (excessScopes.length > 0) {
    recommendations.push(
      `Remove unnecessary scopes: ${excessScopes.join(', ')}`
    );
  }
  
  if (missingScopes.length > 0) {
    recommendations.push(
      `Add required scopes: ${missingScopes.join(', ')}`
    );
  }
  
  const valid = missingScopes.length === 0 && excessScopes.length === 0;
  
  logger.info('Scope validation result:', {
    valid,
    grantedScopes: grantedScopes.length,
    requiredScopes: REQUIRED_SCOPES.length,
    missingScopes: missingScopes.length,
    excessScopes: excessScopes.length,
  });
  
  return {
    valid,
    missingScopes,
    excessScopes,
    recommendations,
  };
}

/**
 * Check if a specific scope is available
 */
export function hasScope(grantedScopes: string[], requiredScope: RequiredScope): boolean {
  return grantedScopes.includes(requiredScope);
}

/**
 * Get scope usage justification for compliance reporting
 */
export function getScopeJustification(scope: RequiredScope): string[] {
  return SCOPE_USAGE_MAP[scope] || [];
}

/**
 * Middleware to validate scopes on API requests
 */
export function createScopeValidator(requiredScopes: RequiredScope[]) {
  return (grantedScopes: string[]) => {
    const missing = requiredScopes.filter(scope => !hasScope(grantedScopes, scope));
    
    if (missing.length > 0) {
      throw new Error(
        `Insufficient permissions. Missing scopes: ${missing.join(', ')}`
      );
    }
    
    return true;
  };
}

/**
 * Generate compliance report for scope usage
 */
export function generateScopeComplianceReport(grantedScopes: string[]): {
  compliant: boolean;
  score: number;
  details: Record<string, any>;
} {
  const validation = validateScopes(grantedScopes);
  
  // Calculate compliance score
  const totalRequired = REQUIRED_SCOPES.length;
  const grantedRequired = REQUIRED_SCOPES.filter(scope => 
    grantedScopes.includes(scope)
  ).length;
  
  const excessPenalty = validation.excessScopes.length * 5; // 5 points per excess scope
  const baseScore = (grantedRequired / totalRequired) * 100;
  const score = Math.max(0, baseScore - excessPenalty);
  
  return {
    compliant: validation.valid,
    score,
    details: {
      requiredScopes: REQUIRED_SCOPES,
      grantedScopes,
      validation,
      usage: Object.fromEntries(
        REQUIRED_SCOPES.map(scope => [
          scope,
          {
            granted: hasScope(grantedScopes, scope),
            justification: getScopeJustification(scope),
          },
        ])
      ),
    },
  };
}

/**
 * Validate scopes during app installation
 */
export async function validateInstallationScopes(
  shop: string,
  grantedScopes: string[]
): Promise<void> {
  const validation = validateScopes(grantedScopes);
  
  if (!validation.valid) {
    logger.error('Invalid scopes granted during installation:', {
      shop,
      grantedScopes,
      validation,
    });
    
    throw new Error(
      `Installation failed: Invalid scopes. ${validation.recommendations.join('. ')}`
    );
  }
  
  logger.info('Installation scopes validated successfully:', {
    shop,
    scopeCount: grantedScopes.length,
  });
}