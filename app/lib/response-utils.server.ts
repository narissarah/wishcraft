/**
 * Response Utilities - Standardized HTTP response helpers
 * Ensures consistent response patterns across the application
 */

/**
 * Standard HTTP response helpers with consistent status codes and headers
 */
export const responses = {
  ok: (message = "OK") => new Response(message, { status: 200 }),
  
  created: (message = "Created") => new Response(message, { status: 201 }),
  
  noContent: () => new Response(null, { status: 204 }),
  
  badRequest: (message = "Bad Request") => new Response(message, { 
    status: 400,
    headers: { 'Content-Type': 'text/plain' }
  }),
  
  unauthorized: (message = "Unauthorized") => new Response(message, { 
    status: 401,
    headers: { 'Content-Type': 'text/plain' }
  }),
  
  forbidden: (message = "Forbidden") => new Response(message, { 
    status: 403,
    headers: { 'Content-Type': 'text/plain' }
  }),
  
  notFound: (message = "Not Found") => new Response(message, { 
    status: 404,
    headers: { 'Content-Type': 'text/plain' }
  }),
  
  methodNotAllowed: (message = "Method Not Allowed") => new Response(message, { 
    status: 405,
    headers: { 'Content-Type': 'text/plain' }
  }),
  
  tooManyRequests: (message = "Too Many Requests", retryAfter?: number) => {
    const headers: HeadersInit = { 'Content-Type': 'text/plain' };
    if (retryAfter) {
      headers['Retry-After'] = retryAfter.toString();
    }
    return new Response(message, { 
      status: 429,
      headers
    });
  },
  
  serverError: (message = "Internal Server Error") => new Response(message, { 
    status: 500,
    headers: { 'Content-Type': 'text/plain' }
  }),
  
  serviceUnavailable: (message = "Service Unavailable") => new Response(message, { 
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  })
};

/**
 * JSON response helper with consistent headers
 */
export function jsonResponse(data: any, status = 200, additionalHeaders?: HeadersInit) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
  
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

/**
 * CORS-enabled response helper
 */
export function corsResponse(
  body: string | null = null, 
  status = 200, 
  additionalHeaders?: HeadersInit
) {
  const headers: HeadersInit = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...additionalHeaders
  };
  
  return new Response(body, { status, headers });
}