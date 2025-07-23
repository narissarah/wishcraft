import { redirect } from "@remix-run/node";
import { generateState, generateCodeVerifier, generateCodeChallenge, createCustomerSession, getCustomerSession, makeCustomerAPIRequest } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import crypto from "crypto";

// Re-export getCustomerSession for routes
export { getCustomerSession } from "~/lib/auth.server";

// ============================================================================
// CUSTOMER ACCOUNT API CONFIGURATION
// ============================================================================

interface CustomerAccountConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  graphqlEndpoint: string;
  scopes: string[];
  clientId: string;
  redirectUri: string;
}

function getCustomerAccountConfig(shop: string): CustomerAccountConfig {
  const apiVersion = '2025-07'; // Latest Shopify API version for 2025 compliance
  return {
    authorizationEndpoint: `https://shopify.com/${shop}/account/oauth/authorize`,
    tokenEndpoint: `https://shopify.com/${shop}/account/oauth/token`,
    graphqlEndpoint: `https://shopify.com/${shop}/account/customer/api/${apiVersion}/graphql`,
    scopes: [
      "https://api.customers.com/auth/customer.graphql",
      "https://api.customers.com/auth/customer.addresses",
      "https://api.customers.com/auth/customer.orders"
    ],
    clientId: process.env.SHOPIFY_API_KEY!,
    redirectUri: `${process.env.SHOPIFY_APP_URL}/customer/auth/callback`,
  };
}

// ============================================================================
// CUSTOMER AUTHENTICATION FLOW
// ============================================================================

export async function initiateCustomerAuth(
  shop: string, 
  returnUrl?: string
): Promise<{ authUrl: string; state: string; codeVerifier: string }> {
  const config = getCustomerAccountConfig(shop);
  
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  
  // Build authorization URL
  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('scope', config.scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  if (returnUrl) {
    authUrl.searchParams.set('return_url', returnUrl);
  }
  
  return {
    authUrl: authUrl.toString(),
    state,
    codeVerifier
  };
}

export async function handleCustomerAuthCallback(
  shop: string,
  code: string,
  state: string,
  codeVerifier: string
): Promise<string> {
  const config = getCustomerAccountConfig(shop);
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: process.env.SHOPIFY_API_SECRET!,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get customer information
    const customerData = await makeCustomerAPIRequest(
      {
        customerId: '', // Will be filled from response
        accessToken: tokenData.access_token,
        shop,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
      },
      `#graphql
        query GetCustomer {
          customer {
            id
            email
            firstName
            lastName
            displayName
          }
        }
      `
    );
    
    if (customerData.errors) {
      throw new Error(`Customer API error: ${JSON.stringify(customerData.errors)}`);
    }
    
    const customer = customerData.data.customer;
    
    // Create customer session
    const sessionCookie = await createCustomerSession(
      customer.id,
      tokenData.access_token,
      shop,
      tokenData.expires_in
    );
    
    return sessionCookie;
    
  } catch (error) {
    log.error('Customer auth callback error', error as Error, { shop });
    throw new Error('Authentication failed');
  }
}

// ============================================================================
// CUSTOMER DATA OPERATIONS
// ============================================================================

export async function getCustomerOrders(customerSession: any) {
  const query = `#graphql
    query GetCustomerOrders($first: Int!) {
      customer {
        orders(first: $first) {
          edges {
            node {
              id
              orderNumber
              processedAt
              totalPrice {
                amount
                currencyCode
              }
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    title
                    quantity
                    variant {
                      id
                      title
                      product {
                        id
                        handle
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  return await makeCustomerAPIRequest(customerSession, query, { first: 20 });
}

export async function getCustomerAddresses(customerSession: any) {
  const query = `#graphql
    query GetCustomerAddresses {
      customer {
        addresses(first: 10) {
          edges {
            node {
              id
              address1
              address2
              city
              province
              zip
              country
              firstName
              lastName
              company
              phone
            }
          }
        }
        defaultAddress {
          id
        }
      }
    }
  `;
  
  return await makeCustomerAPIRequest(customerSession, query);
}

export async function updateCustomerProfile(
  customerSession: any,
  profileData: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }
) {
  const mutation = `#graphql
    mutation CustomerUpdate($customer: CustomerUpdateInput!) {
      customerUpdate(customer: $customer) {
        customer {
          id
          email
          firstName
          lastName
          displayName
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  return await makeCustomerAPIRequest(customerSession, mutation, {
    customer: profileData
  });
}

// ============================================================================
// REGISTRY-SPECIFIC CUSTOMER OPERATIONS
// ============================================================================

export async function getCustomerRegistries(customerId: string, shop: string) {
  try {
    const registries = await db.registries.findMany({
      where: {
        customerId,
        shopId: shop
      },
      include: {
        registry_items: true,
        _count: {
          select: {
            registry_items: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return registries;
  } catch (error) {
    log.error('Failed to get customer registries', error as Error, { customerId, shop });
    throw new Error('Failed to retrieve registries');
  }
}

export async function linkCustomerToRegistry(
  customerId: string,
  registryId: string,
  customerSession: any
) {
  try {
    // Get customer profile to update registry with current customer info
    const customerProfile = await makeCustomerAPIRequest(
      customerSession,
      `#graphql
        query GetCustomer {
          customer {
            id
            email
            firstName
            lastName
            displayName
            phoneNumber {
              phoneNumber
            }
          }
        }
      `
    );
    
    if (customerProfile.errors) {
      throw new Error('Failed to get customer profile');
    }
    
    const customer = customerProfile.data.customer;
    
    // Update registry with customer information
    const updatedRegistry = await db.registries.update({
      where: { id: registryId },
      data: {
        customerId: customer.id,
        customerEmail: customer.email,
        customerFirstName: customer.firstName,
        customerLastName: customer.lastName
      }
    });
    
    // Log activity in audit log
    await db.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: 'customer_linked',
        resource: 'registry',
        resourceId: registryId,
        shopId: updatedRegistry.shopId,
        metadata: JSON.stringify({
          customerId: customer.id,
          customerEmail: customer.email,
          customerName: customer.displayName || `${customer.firstName} ${customer.lastName}`
        })
      }
    });
    
    return updatedRegistry;
    
  } catch (error) {
    log.error('Failed to link customer to registry', error as Error, { customerId, registryId });
    throw new Error('Failed to link customer account');
  }
}

// ============================================================================
// CUSTOMER SESSION UTILITIES
// ============================================================================

export async function validateCustomerAccess(
  request: Request,
  registryId: string
): Promise<{ hasAccess: boolean; customer?: any; registry?: any }> {
  try {
    // Get customer session
    const customerSession = await getCustomerSession(request);
    if (!customerSession) {
      return { hasAccess: false };
    }
    
    // Get registry with shop validation for security
    const registry = await db.registries.findUnique({
      where: { 
        id: registryId,
        // Ensure shop context is validated through customer session
        shopId: customerSession.shop
      }
    });
    
    if (!registry) {
      return { hasAccess: false };
    }
    
    // Check if customer owns the registry
    if (registry.customerId === customerSession.customerId) {
      return { hasAccess: true, customer: customerSession, registry };
    }
    
    // SECURITY FIX: Public registry access with proper validation
    if (registry.visibility === 'public') {
      // Additional security: Log public access for monitoring
      log.info("Public registry access granted", { 
        registryId: registry.id, 
        shopId: registry.shopId,
        customerId: customerSession?.customerId || 'anonymous' 
      });
      
      return { hasAccess: true, customer: customerSession, registry };
    }
    
    return { hasAccess: false, registry };
    
  } catch (error) {
    log.error('Failed to validate customer access', error as Error, { registryId });
    return { hasAccess: false };
  }
}

export async function requireCustomerRegistryAccess(
  request: Request,
  registryId: string
) {
  const { hasAccess, customer, registry } = await validateCustomerAccess(request, registryId);
  
  if (!hasAccess) {
    if (!customer) {
      throw redirect(`/customer/login?redirect=${encodeURIComponent(request.url)}`);
    }
    
    if (registry?.visibility === 'private') {
      throw new Response('Access denied to private registry', { status: 403 });
    }
    
    if (registry?.visibility === 'password') {
      throw redirect(`/registry/${registry.slug}/password`);
    }
    
    throw new Response('Access denied', { status: 403 });
  }
  
  return { customer, registry };
}

// Simple error handling using unified AppError
import { AppError } from "~/lib/errors.server";

export function handleCustomerAuthError(error: any): AppError {
  // Map common errors to appropriate status codes
  if (error.message?.includes('invalid_grant')) {
    return new AppError('Authentication expired. Please log in again.', 401, 'TOKEN_EXPIRED');
  }
  
  if (error.message?.includes('access_denied')) {
    return new AppError('Access denied. Please check your permissions.', 403, 'ACCESS_DENIED');
  }
  
  return new AppError('Authentication failed. Please try again.', 500, 'AUTH_FAILED');
}