import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  Badge,
  Button,
  Box,
  InlineStack,
  Icon
} from "@shopify/polaris";
import {
  ChartVerticalIcon,
  OrderIcon,
  ProductIcon,
  SettingsIcon,
  PlusIcon
} from "@shopify/polaris-icons";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";

interface LoaderData {
  shop: {
    id: string;
    name: string;
    domain: string;
  };
  stats: {
    totalRegistries: number;
    activeRegistries: number;
    totalItems: number;
    totalValue: number;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Get shop from session
  const shopId = session.shop;
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    include: { settings: true }
  });
  
  if (!shop) {
    throw new Error(`Shop ${shopId} not found in database`);
  }

  const [totalRegistries, activeRegistries] = await Promise.all([
    db.registry.count({ where: { shopId: shop.id } }),
    db.registry.count({ 
      where: { 
        shopId: shop.id, 
        status: { in: ['active'] }
      } 
    })
  ]);

  const registryItems = await db.registryItem.findMany({
    where: { 
      registry: { shopId: shop.id } 
    },
    select: { price: true }
  });

  const totalItems = registryItems.length;
  const totalValue = registryItems.reduce((sum, item) => sum + (item.price || 0), 0);

  const stats = {
    totalRegistries,
    activeRegistries,
    totalItems,
    totalValue
  };

  return json<LoaderData>({
    shop: {
      id: shop.id,
      name: shop.name,
      domain: shop.domain
    },
    stats
  });
};

export default function AdminDashboard() {
  const { shop, stats } = useLoaderData<LoaderData>();

  return (
    <Page
      title="WishCraft Dashboard"
      subtitle={`Gift registry management for ${shop.name}`}
      primaryAction={{
        content: "View Registries",
        icon: PlusIcon,
        url: "/admin/registries"
      }}
    >
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Total Registries</Text>
                <Icon source={OrderIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                {stats.totalRegistries}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Active Registries</Text>
                <Icon source={ChartVerticalIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                {stats.activeRegistries}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Registry Items</Text>
                <Icon source={ProductIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                {stats.totalItems}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Total Value</Text>
                <Icon source={SettingsIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                ${stats.totalValue.toLocaleString()}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">Quick Actions</Text>
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              <Button url="/admin/registries" size="large" fullWidth>
                Manage Registries
              </Button>
              <Button url="/admin/settings" size="large" fullWidth variant="secondary">
                App Settings
              </Button>
            </InlineGrid>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}