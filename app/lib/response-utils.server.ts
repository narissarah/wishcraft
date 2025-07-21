/**
 * Simple Response Utils
 * Replacement for removed complex response utils
 */

import { json } from "@remix-run/node";

export const responses = {
  tooManyRequests: () => json({ error: "Too many requests" }, { status: 429 }),
  methodNotAllowed: () => json({ error: "Method not allowed" }, { status: 405 }),
  serverError: () => json({ error: "Internal server error" }, { status: 500 }),
  badRequest: (message = "Bad request") => json({ error: message }, { status: 400 }),
  unauthorized: () => json({ error: "Unauthorized" }, { status: 401 }),
  notFound: () => json({ error: "Not found" }, { status: 404 })
};