import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "@remix-run/react";
import { Card, Page, Button, Text, BlockStack, InlineStack } from "@shopify/polaris";
import { initiateCustomerAuth, getCustomerSession } from "~/lib/customer-auth.server";
import { sessionStorage } from "~/lib/auth.server";

interface LoaderData {
  shop: string;
  returnUrl?: string;
  error?: string;
}

/**
 * Customer Login Route
 * Initiates Customer Account API authentication flow
 * Following 2025 PKCE security standards
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const returnUrl = url.searchParams.get("redirect");
  const error = url.searchParams.get("error");
  
  // Check if customer is already authenticated
  const existingSession = await getCustomerSession(request);
  if (existingSession && !error) {
    return redirect(returnUrl || "/customer/dashboard");
  }
  
  // For embedded app, extract shop from session
  let shopDomain = shop;
  if (!shopDomain) {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    shopDomain = session.get("shop");
  }
  
  if (!shopDomain) {
    throw new Response("Shop parameter required", { status: 400 });
  }
  
  return json<LoaderData>({
    shop: shopDomain,
    returnUrl: returnUrl || undefined,
    error: error || undefined
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shop = formData.get("shop") as string;
  const returnUrl = formData.get("returnUrl") as string;
  
  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }
  
  try {
    // Initiate PKCE OAuth flow
    const { authUrl, state, codeVerifier } = await initiateCustomerAuth(shop, returnUrl);
    
    // Store OAuth state and code verifier in session
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    session.set("oauth_state", state);
    session.set("code_verifier", codeVerifier);
    session.set("shop", shop);
    
    const headers = {
      "Set-Cookie": await sessionStorage.commitSession(session),
    };
    
    return redirect(authUrl, { headers });
  } catch (error) {
    console.error("Customer auth initiation failed:", error);
    return json({ error: "Failed to initiate authentication" }, { status: 500 });
  }
};

export default function CustomerLogin() {
  const { shop, returnUrl, error } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  
  return (
    <Page title="Customer Login">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Sign in to your account
          </Text>
          
          {error && (
            <Text as="p" tone="critical">
              {error === "access_denied" 
                ? "Authentication was cancelled or denied"
                : error === "invalid_request"
                ? "Invalid authentication request"
                : "Authentication failed. Please try again."
              }
            </Text>
          )}
          
          <Text as="p" tone="subdued">
            Sign in with your {shop.replace('.myshopify.com', '')} customer account to access your gift registries.
          </Text>
          
          <Form method="post">
            <input type="hidden" name="shop" value={shop} />
            <input type="hidden" name="returnUrl" value={returnUrl || ""} />
            
            <InlineStack gap="300">
              <Button
                variant="primary"
                size="large"
                submit
              >
                Sign in with Shopify
              </Button>
              
              {returnUrl && (
                <Button
                  url="/registries"
                  variant="secondary"
                  size="large"
                >
                  Browse Registries
                </Button>
              )}
            </InlineStack>
          </Form>
          
          <Text as="p" variant="bodySm" tone="subdued">
            By signing in, you agree to our terms of service and privacy policy.
            Your account information is managed by {shop.replace('.myshopify.com', '')}.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}