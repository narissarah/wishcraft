import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { handleCustomerAuthCallback } from "~/lib/customer-auth.server";
import { sessionStorage } from "~/lib/auth.server";

/**
 * Customer OAuth Callback Route
 * Handles Customer Account API OAuth callback with PKCE verification
 * Following 2025 security standards for token exchange
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  
  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    return redirect(`/customer/login?error=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state) {
    return redirect("/customer/login?error=invalid_request");
  }
  
  try {
    // Get OAuth state and code verifier from session
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const storedState = session.get("oauth_state");
    const codeVerifier = session.get("code_verifier");
    const shop = session.get("shop");
    
    // Verify state parameter (CSRF protection)
    if (!storedState || storedState !== state) {
      console.error("OAuth state mismatch");
      return redirect("/customer/login?error=invalid_state");
    }
    
    if (!codeVerifier || !shop) {
      console.error("Missing OAuth session data");
      return redirect("/customer/login?error=invalid_session");
    }
    
    // Exchange authorization code for access token
    const customerSessionCookie = await handleCustomerAuthCallback(
      shop,
      code,
      state,
      codeVerifier
    );
    
    // Clear OAuth session data
    session.unset("oauth_state");
    session.unset("code_verifier");
    await sessionStorage.commitSession(session);
    
    // Get return URL
    const returnUrl = url.searchParams.get("return_url") || "/customer/dashboard";
    
    // Set customer session cookie
    const headers = {
      "Set-Cookie": customerSessionCookie
    };
    
    return redirect(returnUrl, { headers });
    
  } catch (error) {
    console.error("Customer auth callback failed:", error);
    return redirect("/customer/login?error=auth_failed");
  }
};