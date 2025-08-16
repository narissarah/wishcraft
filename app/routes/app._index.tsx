import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRouteError } from "@remix-run/react";
import { Page, Layout, Text, Card, Button, BlockStack, InlineStack, Badge } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-remix/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Dynamic import to avoid initialization issues
  const { authenticate } = await import("~/shopify.server");
  const { admin, session } = await authenticate.admin(request);

  // Get shop details using GraphQL (2025 standard)
  const response = await admin.graphql(`
    #graphql
    query getShop {
      shop {
        id
        name
        email
        myshopifyDomain
        currencyCode
        ianaTimezone
      }
    }
  `);
  
  const shopData = await response.json();

  return json({
    shop: shopData.data.shop,
    sessionShop: session.shop,
  });
};

export default function Index() {
  const { shop, sessionShop } = useLoaderData<typeof loader>();

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Welcome to WishCraft! 🎁
              </Text>
              <Text as="p" variant="bodyMd">
                Your Shopify Gift Registry App is ready to help customers create
                and manage their wish lists.
              </Text>
              <InlineStack gap="200">
                <Badge tone="success">{`Connected to ${shop?.name || sessionShop}`}</Badge>
                <Badge>{shop?.myshopifyDomain || sessionShop}</Badge>
                {shop?.currencyCode && <Badge tone="info">{shop.currencyCode}</Badge>}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Quick Actions
              </Text>
              <Button variant="primary">Create New Registry</Button>
              <Button>View All Registries</Button>
              <Button>App Settings</Button>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Recent Activity
              </Text>
              <Text as="p" variant="bodyMd">
                No registries created yet. Get started by creating your first
                gift registry!
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// 2025 Error Boundary with Shopify boundary helper
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Required headers for embedded apps
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};