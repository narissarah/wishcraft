import { json } from "@remix-run/node";

/**
 * Standard API response for successful operations
 */
export function apiSuccess<T>(data: T, status = 200) {
  return json({ success: true, data }, { status });
}

/**
 * Standard API response for errors
 */
export function apiError(error: string, status = 500) {
  return json({ success: false, error }, { status });
}

/**
 * Standard API response for validation errors
 */
export function apiValidationError(errors: Record<string, string>) {
  return json({ success: false, errors }, { status: 400 });
}

/**
 * Standard API response for unauthorized access
 */
export function apiUnauthorized(message = "Unauthorized") {
  return json({ success: false, error: message }, { status: 401 });
}

/**
 * Standard API response for forbidden access
 */
export function apiForbidden(message = "Forbidden") {
  return json({ success: false, error: message }, { status: 403 });
}

/**
 * Standard API response for not found
 */
export function apiNotFound(message = "Not found") {
  return json({ success: false, error: message }, { status: 404 });
}

/**
 * Standard API response for method not allowed
 */
export function apiMethodNotAllowed(allowedMethods: string[]) {
  return json(
    { success: false, error: `Method not allowed. Allowed methods: ${allowedMethods.join(", ")}` },
    { status: 405, headers: { Allow: allowedMethods.join(", ") } }
  );
}