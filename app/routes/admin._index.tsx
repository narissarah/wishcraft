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
  Divider,
  ProgressBar,
  Link,
  Thumbnail,
  Icon
} from "@shopify/polaris";

// Screen reader only styles
const srOnlyStyles = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: 0,
};
import {
  ChartVerticalIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  SettingsIcon,
  PlusIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
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
    conversionRate: number;
    monthlyGrowth: number;
  };
  recentRegistries: Array<{
    id: string;
    title: string;
    customerName: string;
    itemCount: number;
    totalValue: number;
    createdAt: string;
    status: string;
  }>;
  quickActions: Array<{
    title: string;
    description: string;
    action: string;
    icon: any;
    badge?: string;
  }>;
}

/**
 * WishCraft Admin Dashboard
 * Main admin interface following Polaris v12+ design patterns
 */
export const loader = withAdminAuth(async ({ request }, { admin, session, shop }) => {
  // Get registry statistics
  const [totalRegistries, activeRegistries] = await Promise.all([
    db.registry.count({ where: { shopId: shop.id } }),
    db.registry.count({ 
      where: { 
        shopId: shop.id, 
        status: { in: ['active', 'public'] }
      } 
    })
  ]);

  // Get registry items statistics
  const registryItems = await db.registryItem.findMany({
    where: { 
      registry: { shopId: shop.id } 
    },
    select: { price: true }
  });

  const totalItems = registryItems.length;
  const totalValue = registryItems.reduce((sum, item) => sum + (item.price || 0), 0);

  // Get recent registries with customer info
  const recentRegistries = await db.registry.findMany({
    where: { shopId: shop.id },
    include: {
      items: true,
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  // Calculate mock analytics (in production, use real analytics)
  const conversionRate = activeRegistries > 0 ? (activeRegistries / totalRegistries) * 100 : 0;
  const monthlyGrowth = 12.5; // Mock growth rate

  const stats = {
    totalRegistries,
    activeRegistries,
    totalItems,
    totalValue,
    conversionRate,
    monthlyGrowth
  };

  const formattedRecentRegistries = recentRegistries.map(registry => ({
    id: registry.id,
    title: registry.title,
    customerName: registry.customerFirstName && registry.customerLastName 
      ? `${registry.customerFirstName} ${registry.customerLastName}`
      : registry.customerEmail || 'Guest',
    itemCount: registry._count.items,
    totalValue: registry.items.reduce((sum, item) => sum + (item.price || 0), 0),
    createdAt: registry.createdAt.toISOString(),
    status: registry.status
  }));

  const quickActions = [
    {
      title: "View Analytics",
      description: "See detailed registry performance",
      action: "/admin/analytics",
      icon: ChartVerticalIcon,
      badge: "Popular"
    },
    {
      title: "Manage Registries",
      description: "Browse and manage all registries",
      action: "/admin/registries",
      icon: OrderIcon
    },
    {
      title: "Product Suggestions",
      description: "Configure product recommendations",
      action: "/admin/products",
      icon: ProductIcon
    },
    {
      title: "Customer Insights",
      description: "View customer registry behavior",
      action: "/admin/customers",
      icon: PersonIcon
    },
    {
      title: "App Settings",
      description: "Configure WishCraft preferences",
      action: "/admin/settings",
      icon: SettingsIcon
    }
  ];

  return json<LoaderData>({
    shop: {
      id: shop.id,
      name: shop.name,
      domain: shop.domain
    },
    stats,
    recentRegistries: formattedRecentRegistries,
    quickActions
  });
});

export default function AdminDashboard() {
  const { shop, stats, recentRegistries, quickActions } = useLoaderData<LoaderData>();

  return (
    <Page
      title="WishCraft Dashboard"
      subtitle={`Welcome back to your gift registry management for ${shop.name}`}
      primaryAction={{
        content: "Create Registry",
        icon: PlusIcon,
        url: "/admin/registries/new",
        accessibilityLabel: "Create a new gift registry for customers"
      }}
      secondaryActions={[
        { content: "View Analytics", url: "/admin/analytics", accessibilityLabel: "View detailed analytics and performance metrics" },
        { content: "Settings", url: "/admin/settings", accessibilityLabel: "Configure WishCraft app settings and preferences" }
      ]}
    >
      <BlockStack gap="500">
        {/* Key Statistics */}
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" style={srOnlyStyles}>Key Statistics</h2>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="headingSm" as="h3" id="total-registries-heading">Total Registries</Text>
                  <Icon source={OrderIcon} tone="base" accessibilityLabel="Registry icon" />
                </InlineStack>
                <Text variant="heading2xl" as="p" aria-labelledby="total-registries-heading">
                  {stats.totalRegistries}
                </Text>
                <InlineStack gap="200" align="start">
                  <Badge tone="success" role="status" aria-label={`Growth rate: ${stats.monthlyGrowth}% increase`}>
                    +{stats.monthlyGrowth}%
                  </Badge>
                  <Text variant="bodySm" tone="subdued">vs last month</Text>
                </InlineStack>
              </BlockStack>
            </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3" id="active-registries-heading">Active Registries</Text>
                <Icon source={PersonIcon} tone="base" accessibilityLabel="Active users icon" />
              </InlineStack>
              <Text variant="heading2xl" as="p" aria-labelledby="active-registries-heading">
                {stats.activeRegistries}
              </Text>
              <Box>
                <Text variant="bodySm" tone="subdued">
                  {stats.conversionRate.toFixed(1)}% conversion rate
                </Text>
                <ProgressBar 
                  progress={stats.conversionRate} 
                  size="small"
                  aria-label={`Conversion rate: ${stats.conversionRate.toFixed(1)}% out of 100%`}
                  role="progressbar"
                  aria-valuenow={stats.conversionRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </Box>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3" id="registry-items-heading">Registry Items</Text>
                <Icon source={ProductIcon} tone="base" accessibilityLabel="Products icon" />
              </InlineStack>
              <Text variant="heading2xl" as="p" aria-labelledby="registry-items-heading">
                {stats.totalItems}
              </Text>
              <Text variant="bodySm" tone="subdued">
                Across all registries
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3" id="total-value-heading">Total Value</Text>
                <Icon source={ChartVerticalIcon} tone="base" accessibilityLabel="Chart icon" />
              </InlineStack>
              <Text variant="heading2xl" as="p" aria-labelledby="total-value-heading">
                ${stats.totalValue.toLocaleString()}
              </Text>
              <Text variant="bodySm" tone="subdued">
                Potential revenue
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>
        </section>

        {/* Quick Actions */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" id="quick-actions-heading">Quick Actions</Text>
            <nav aria-labelledby="quick-actions-heading">
              <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
                {quickActions.map((action, index) => (
                  <Box key={index}>
                    <InlineStack gap="300" align="start">
                      <Box>
                        <Icon source={action.icon} tone="base" accessibilityLabel={`${action.title} icon`} />
                      </Box>
                      <BlockStack gap="100">
                        <InlineStack gap="200" align="start">
                          <Link 
                            url={action.action} 
                            removeUnderline
                            accessibilityLabel={`${action.title}: ${action.description}`}
                          >
                            <Text variant="headingSm" as="h3">{action.title}</Text>
                          </Link>
                          {action.badge && (
                            <Badge tone="info" size="small" role="status" aria-label={`${action.badge} feature`}>
                              {action.badge}
                            </Badge>
                          )}
                        </InlineStack>
                        <Text variant="bodySm" tone="subdued">
                          {action.description}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </Box>
                ))}
              </InlineGrid>
            </nav>
          </BlockStack>
        </Card>

        {/* Recent Registries */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2" id="recent-registries-heading">Recent Registries</Text>
              <Button 
                url="/admin/registries" 
                variant="plain"
                accessibilityLabel="View all registries"
              >
                View all
              </Button>
            </InlineStack>
            
            <section aria-labelledby="recent-registries-heading">
              <BlockStack gap="300">
                {recentRegistries.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {recentRegistries.map((registry, index) => (
                      <li key={registry.id}>
                        <Box>
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="300" align="start">
                              <Thumbnail
                                source="/api/placeholder/40/40"
                                alt={`Registry thumbnail for ${registry.title}`}
                                size="small"
                              />
                              <BlockStack gap="100">
                                <Link 
                                  url={`/admin/registries/${registry.id}`} 
                                  removeUnderline
                                  accessibilityLabel={`View registry: ${registry.title} by ${registry.customerName}`}
                                >
                                  <Text variant="bodyMd" fontWeight="semibold">
                                    {registry.title}
                                  </Text>
                                </Link>
                                <Text variant="bodySm" tone="subdued">
                                  {registry.customerName} • {registry.itemCount} items
                                </Text>
                              </BlockStack>
                            </InlineStack>
                            
                            <InlineStack gap="200" align="end">
                              <BlockStack gap="100">
                                <Text variant="bodySm" alignment="end">
                                  ${registry.totalValue.toLocaleString()}
                                </Text>
                                <Badge 
                                  tone={registry.status === 'active' ? 'success' : 'info'}
                                  size="small"
                                  role="status"
                                  aria-label={`Registry status: ${registry.status}`}
                                >
                                  {registry.status}
                                </Badge>
                              </BlockStack>
                            </InlineStack>
                          </InlineStack>
                          {index < recentRegistries.length - 1 && <Divider />}
                        </Box>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Box padding="400">
                    <BlockStack gap="200" inlineAlign="center">
                      <Icon source={OrderIcon} tone="subdued" accessibilityLabel="No registries" />
                      <Text variant="bodyMd" tone="subdued" alignment="center">
                        No registries created yet
                      </Text>
                      <Button 
                        url="/admin/registries/new" 
                        variant="primary"
                        accessibilityLabel="Create your first gift registry"
                      >
                        Create your first registry
                      </Button>
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </section>
          </BlockStack>
        </Card>

        {/* Getting Started */}
        {stats.totalRegistries === 0 && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" id="getting-started-heading">Get Started with WishCraft</Text>
              <Text variant="bodyMd" tone="subdued">
                Welcome to WishCraft! Here's how to get the most out of your gift registry app:
              </Text>
              
              <section aria-labelledby="getting-started-heading">
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li>
                    <BlockStack gap="300">
                      <InlineStack gap="200" align="start">
                        <Badge tone="info" role="text" aria-label="Step 1">1</Badge>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold">
                            Configure your settings
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            Set up your app preferences, colors, and feature toggles.
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </BlockStack>
                  </li>
                  
                  <li>
                    <BlockStack gap="300">
                      <InlineStack gap="200" align="start">
                        <Badge tone="info" role="text" aria-label="Step 2">2</Badge>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold">
                            Create a test registry
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            Try creating a registry to see how your customers will experience it.
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </BlockStack>
                  </li>
                  
                  <li>
                    <BlockStack gap="300">
                      <InlineStack gap="200" align="start">
                        <Badge tone="info" role="text" aria-label="Step 3">3</Badge>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold">
                            Enable storefront integration
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            Add the registry widget to your storefront theme.
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </BlockStack>
                  </li>
                </ol>
              </section>
              
              <InlineStack gap="200">
                <Button 
                  url="/admin/settings" 
                  variant="primary"
                  accessibilityLabel="Configure WishCraft settings and preferences"
                >
                  Configure Settings
                </Button>
                <Button 
                  url="/admin/registries/new" 
                  variant="secondary"
                  accessibilityLabel="Create a test registry to preview customer experience"
                >
                  Create Test Registry
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}