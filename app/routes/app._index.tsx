import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  return json({
    shop: {
      name: session.shop.replace('.myshopify.com', ''),
      myshopifyDomain: session.shop,
      email: session.accessToken ? 'shop@example.com' : ''
    },
  });
};

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();

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
                <Badge tone="success">{`Connected to ${shop.name}`}</Badge>
                <Badge>{shop.myshopifyDomain}</Badge>
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