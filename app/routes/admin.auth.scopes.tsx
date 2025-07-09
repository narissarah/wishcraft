import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { Card, Page, Button, Text, BlockStack, List } from "@shopify/polaris";
import { requireAdminAuth, requestAdditionalScopes } from "~/lib/auth.server";

interface LoaderData {
  requiredScopes: string[];
  currentScopes: string[];
  returnUrl: string;
}

/**
 * Scope Request Route
 * Handles additional OAuth scope requests for admin features
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await requireAdminAuth(request);
  const url = new URL(request.url);
  
  const requiredScopes = url.searchParams.get("required")?.split(",") || [];
  const returnUrl = url.searchParams.get("redirect") || "/admin";
  const currentScopes = session.scope?.split(",") || [];
  
  // If all scopes are already granted, redirect back
  const missingScopes = requiredScopes.filter(scope => !currentScopes.includes(scope));
  if (missingScopes.length === 0) {
    return redirect(returnUrl);
  }
  
  return json<LoaderData>({
    requiredScopes,
    currentScopes,
    returnUrl
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const scopes = formData.get("scopes") as string;
  const returnUrl = formData.get("returnUrl") as string;
  const reason = formData.get("reason") as string;
  
  return await requestAdditionalScopes(request, {
    scopes: scopes.split(","),
    reason: reason || "Additional permissions required",
    optional: false
  });
};

const scopeDescriptions: Record<string, string> = {
  "read_customers": "Read customer information and profiles",
  "write_customers": "Create and update customer accounts",
  "read_orders": "View order details and history",
  "write_orders": "Create and modify orders",
  "read_products": "Access product catalog and inventory",
  "write_products": "Create and update products",
  "read_inventory": "View inventory levels and tracking",
  "write_inventory": "Update inventory quantities"
};

export default function ScopeRequest() {
  const { requiredScopes, currentScopes, returnUrl } = useLoaderData<LoaderData>();
  const missingScopes = requiredScopes.filter(scope => !currentScopes.includes(scope));
  
  return (
    <Page title="Additional Permissions Required">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Grant Additional Permissions
          </Text>
          
          <Text as="p">
            This feature requires additional permissions to access your Shopify data.
            Please review and approve the following permissions:
          </Text>
          
          <BlockStack gap="200">
            <Text variant="headingSm" as="h3">Required Permissions:</Text>
            <List type="bullet">
              {missingScopes.map(scope => (
                <List.Item key={scope}>
                  <strong>{scope}:</strong> {scopeDescriptions[scope] || "Access to specific Shopify resources"}
                </List.Item>
              ))}
            </List>
          </BlockStack>
          
          <Text as="p" tone="subdued" variant="bodySm">
            These permissions are required to provide full functionality for your gift registry features.
            You can revoke these permissions at any time from your Shopify admin.
          </Text>
          
          <Form method="post">
            <input type="hidden" name="scopes" value={missingScopes.join(",")} />
            <input type="hidden" name="returnUrl" value={returnUrl} />
            <input type="hidden" name="reason" value="Gift registry features require additional Shopify access" />
            
            <BlockStack gap="300">
              <Button
                variant="primary"
                size="large"
                submit
              >
                Grant Permissions
              </Button>
              
              <Button
                url={returnUrl}
                variant="secondary"
              >
                Cancel
              </Button>
            </BlockStack>
          </Form>
        </BlockStack>
      </Card>
    </Page>
  );
}