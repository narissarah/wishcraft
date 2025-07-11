import { redirect } from "@remix-run/node";
import { 
  generateState, 
  generateCodeVerifier, 
  generateCodeChallenge,
  createCustomerSession,
  getCustomerSession,
  destroyCustomerSession,
  makeCustomerAPIRequest
} from "~/lib/auth.server";
import { db } from "~/lib/db.server";

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
  return {
    authorizationEndpoint: `https://shopify.com/${shop}/account/oauth/authorize`,
    tokenEndpoint: `https://shopify.com/${shop}/account/oauth/token`,
    graphqlEndpoint: `https://shopify.com/${shop}/account/customer/api/2025-07/graphql`,
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
        scope: config.scopes,
        refreshToken: tokenData.refresh_token
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
      config.scopes,
      tokenData.expires_in,
      tokenData.refresh_token
    );
    
    return sessionCookie;
    
  } catch (error) {
    console.error('Customer auth callback error:', error);
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
    const registries = await db.registry.findMany({
      where: {
        customerId,
        shopId: shop
      },
      include: {
        items: true,
        purchases: true,
        _count: {
          select: {
            items: true,
            purchases: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return registries;
  } catch (error) {
    console.error('Failed to get customer registries:', error);
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
    const updatedRegistry = await db.registry.update({
      where: { id: registryId },
      data: {
        customerId: customer.id,
        customerEmail: customer.email,
        customerFirstName: customer.firstName,
        customerLastName: customer.lastName
      }
    });
    
    // Log activity in audit log
    await db.auditLog.create({
      data: {
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
    console.error('Failed to link customer to registry:', error);
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
    const registry = await db.registry.findUnique({
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
    
    // Check registry visibility
    if (registry.visibility === 'public') {
      return { hasAccess: true, customer: customerSession, registry };
    }
    
    return { hasAccess: false, registry };
    
  } catch (error) {
    console.error('Failed to validate customer access:', error);
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

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class CustomerAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'CustomerAuthError';
  }
}

export function handleCustomerAuthError(error: any) {
  if (error instanceof CustomerAuthError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode
    };
  }
  
  // Map common errors
  if (error.message?.includes('invalid_grant')) {
    return {
      error: 'Authentication expired. Please log in again.',
      code: 'TOKEN_EXPIRED',
      statusCode: 401
    };
  }
  
  if (error.message?.includes('access_denied')) {
    return {
      error: 'Access denied. Please check your permissions.',
      code: 'ACCESS_DENIED', 
      statusCode: 403
    };
  }
  
  return {
    error: 'Authentication failed. Please try again.',
    code: 'AUTH_FAILED',
    statusCode: 500
  };
}