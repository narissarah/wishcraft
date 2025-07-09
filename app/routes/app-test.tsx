import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Text, BlockStack } from "@shopify/polaris";

export const loader = async () => {
  return json({
    shopOrigin: "test-shop.myshopify.com",
    apiKey: process.env.SHOPIFY_API_KEY || "",
    message: "App is working without authentication",
    cspFixed: true
  });
};

export default function AppTest() {
  const { shopOrigin, apiKey, message, cspFixed } = useLoaderData<typeof loader>();

  return (
    <Page title="WishCraft Test">
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            🎁 WishCraft App Test
          </Text>
          <Text as="p" variant="bodyMd">
            {message}
          </Text>
          <Text as="p" variant="bodyMd">
            <strong>CSP Fixed:</strong> {cspFixed ? "✅ Yes" : "❌ No"}
          </Text>
          <Text as="p" variant="bodyMd">
            <strong>Shop Origin:</strong> {shopOrigin}
          </Text>
          <Text as="p" variant="bodyMd">
            <strong>API Key:</strong> {apiKey ? "✅ Set" : "❌ Not Set"}
          </Text>
          <Text as="p" variant="bodyMd">
            <strong>Environment:</strong> {process.env.NODE_ENV}
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}