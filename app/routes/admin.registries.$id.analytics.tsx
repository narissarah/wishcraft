import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  Select,
  Button,
  InlineStack,
  Box,
  DataTable,
  Badge,
  Banner,
  Tabs,
  EmptyState,
  ProgressBar,
  Tooltip,
  Icon,
  List
} from "@shopify/polaris";
import {
  ChartVerticalIcon,
  ViewIcon,
  CartIcon,
  CashDollarIcon,
  ShareIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExportIcon,
  CalendarIcon,
  PersonIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
import { createRegistryServiceFromRequest } from "~/lib/registry.server";
import { 
  createRegistryAnalyticsService, 
  type RegistryAnalytics,
  formatNumber,
  formatCurrency,
  calculatePercentageChange,
  getTrendDirection
} from "~/lib/registry-analytics.server";

interface LoaderData {
  registry: {
    id: string;
    title: string;
    slug: string;
    createdAt: string;
  };
  analytics: RegistryAnalytics;
  dateRange: string;
}

/**
 * Registry Analytics Dashboard
 * Comprehensive analytics and insights for registry performance
 */
export const loader = withAdminAuth(async ({ request, params }, { admin, session, shop }) => {
  const registryId = params.id;
  if (!registryId) {
    throw new Response("Registry ID required", { status: 400 });
  }

  const url = new URL(request.url);
  const dateRange = url.searchParams.get("dateRange") || "month";

  try {
    // Get registry details
    const registryService = await createRegistryServiceFromRequest(request, shop.id);
    const registry = await registryService.getRegistryById(registryId);

    if (!registry) {
      throw new Response("Registry not found", { status: 404 });
    }

    // Get analytics
    const analyticsService = createRegistryAnalyticsService(shop.id);
    const analytics = await analyticsService.getRegistryAnalytics(registryId, {
      dateRange: dateRange as any
    });

    return json<LoaderData>({
      registry: {
        id: registry.id,
        title: registry.title,
        slug: registry.slug,
        createdAt: registry.createdAt.toString()
      },
      analytics,
      dateRange
    });
  } catch (error) {
    console.error("Error loading analytics:", error);
    throw new Response("Failed to load analytics", { status: 500 });
  }
});

export default function RegistryAnalytics() {
  const { registry, analytics, dateRange: initialDateRange } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [exportFormat, setExportFormat] = useState('csv');

  const isLoading = fetcher.state === "loading";

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    const params = new URLSearchParams();
    params.set("dateRange", value);
    fetcher.load(`/admin/registries/${registry.id}/analytics?${params}`);
  };

  const handleExport = () => {
    // In a real implementation, this would trigger a download
    console.log(`Exporting analytics as ${exportFormat}`);
  };

  const tabs = [
    {
      id: 'overview',
      content: 'Overview',
      badge: undefined,
      panelID: 'overview-panel'
    },
    {
      id: 'products',
      content: 'Products',
      badge: analytics.topItems.length.toString(),
      panelID: 'products-panel'
    },
    {
      id: 'traffic',
      content: 'Traffic Sources',
      badge: analytics.sources.length.toString(),
      panelID: 'traffic-panel'
    },
    {
      id: 'purchasers',
      content: 'Gift Givers',
      badge: analytics.purchasers.length.toString(),
      panelID: 'purchasers-panel'
    }
  ];

  const metricCards = [
    {
      title: 'Total Views',
      value: formatNumber(analytics.overview.totalViews),
      icon: ViewIcon,
      tone: 'base' as const,
      helpText: `${analytics.overview.uniqueVisitors} unique visitors`
    },
    {
      title: 'Completion Rate',
      value: `${analytics.overview.completionRate}%`,
      icon: ArrowUpIcon,
      tone: analytics.overview.completionRate > 50 ? 'success' : 'attention' as const,
      helpText: `${analytics.overview.itemsPurchased} of ${analytics.overview.totalItems} items`
    },
    {
      title: 'Total Value',
      value: formatCurrency(analytics.overview.totalValue),
      icon: CashDollarIcon,
      tone: 'base' as const,
      helpText: `${formatCurrency(analytics.overview.purchasedValue)} purchased`
    },
    {
      title: 'Shares',
      value: formatNumber(analytics.engagement.shareCount),
      icon: ShareIcon,
      tone: 'base' as const,
      helpText: `${analytics.engagement.collaboratorCount} collaborators`
    }
  ];

  // Calculate days since registry created
  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(registry.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Page
      title={`Analytics for ${registry.title}`}
      subtitle={`Registry created ${daysSinceCreated} days ago`}
      backAction={{
        content: 'Back to Registry',
        url: `/admin/registries/${registry.id}`
      }}
      primaryAction={{
        content: 'Export Report',
        onAction: handleExport,
        icon: ExportIcon
      }}
      secondaryActions={[
        {
          content: 'View Registry',
          url: `/registry/${registry.slug}`,
          external: true,
          icon: ViewIcon
        }
      ]}
    >
      <BlockStack gap="500">
        {/* Date Range Selector */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Analytics Period</Text>
            <Box maxWidth="200px">
              <Select
                label=""
                options={[
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 days', value: 'week' },
                  { label: 'Last 30 days', value: 'month' },
                  { label: 'Last 3 months', value: '3months' },
                  { label: 'Last year', value: 'year' },
                  { label: 'All time', value: 'all' }
                ]}
                value={dateRange}
                onChange={handleDateRangeChange}
              />
            </Box>
          </InlineStack>
        </Card>

        {/* Key Metrics */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          {metricCards.map((metric, index) => (
            <Card key={index}>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Icon source={metric.icon} />
                  <Badge tone={metric.tone}>{metric.title}</Badge>
                </InlineStack>
                <Text variant="heading2xl" as="h3">{metric.value}</Text>
                <Text variant="bodySm" tone="subdued">{metric.helpText}</Text>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>

        {/* Detailed Analytics Tabs */}
        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            {/* Overview Tab */}
            {selectedTab === 0 && (
              <BlockStack gap="500">
                {/* Engagement Metrics */}
                <Box>
                  <Text variant="headingLg" as="h3">Engagement Metrics</Text>
                  <Box paddingBlockStart="400">
                    <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
                      <Card>
                        <BlockStack gap="200">
                          <Text variant="headingMd">Conversion Rate</Text>
                          <Text variant="heading2xl">{analytics.engagement.conversionRate}%</Text>
                          <Text variant="bodySm" tone="subdued">
                            Visitors who made a purchase
                          </Text>
                        </BlockStack>
                      </Card>
                      <Card>
                        <BlockStack gap="200">
                          <Text variant="headingMd">Avg. Time on Page</Text>
                          <Text variant="heading2xl">{Math.floor(analytics.engagement.averageTimeOnPage / 60)}m</Text>
                          <Text variant="bodySm" tone="subdued">
                            {analytics.engagement.averageTimeOnPage}s average
                          </Text>
                        </BlockStack>
                      </Card>
                      <Card>
                        <BlockStack gap="200">
                          <Text variant="headingMd">Bounce Rate</Text>
                          <Text variant="heading2xl">{analytics.engagement.bounceRate}%</Text>
                          <Text variant="bodySm" tone="subdued">
                            Left without interaction
                          </Text>
                        </BlockStack>
                      </Card>
                    </InlineGrid>
                  </Box>
                </Box>

                {/* Timeline Chart Placeholder */}
                <Box>
                  <Text variant="headingLg" as="h3">Activity Timeline</Text>
                  <Box paddingBlockStart="400">
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="bodyMd" tone="subdued">
                          Views, Purchases, and Shares over time
                        </Text>
                        {/* In a real implementation, this would be a chart component */}
                        <Box padding="800" background="bg-surface-secondary">
                          <Text variant="bodyMd" alignment="center" tone="subdued">
                            [Chart visualization would go here]
                          </Text>
                        </Box>
                      </BlockStack>
                    </Card>
                  </Box>
                </Box>

                {/* Quick Stats */}
                <Box>
                  <Text variant="headingLg" as="h3">Registry Performance</Text>
                  <Box paddingBlockStart="400">
                    <List type="bullet">
                      <List.Item>
                        <Text variant="bodyMd">
                          <strong>{formatNumber(analytics.overview.totalViews)}</strong> total views with{' '}
                          <strong>{formatNumber(analytics.overview.uniqueVisitors)}</strong> unique visitors
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text variant="bodyMd">
                          <strong>{analytics.overview.completionRate}%</strong> of items have been purchased
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text variant="bodyMd">
                          <strong>{formatCurrency(analytics.overview.purchasedValue)}</strong> of{' '}
                          <strong>{formatCurrency(analytics.overview.totalValue)}</strong> total value purchased
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text variant="bodyMd">
                          Registry shared <strong>{analytics.engagement.shareCount}</strong> times
                        </Text>
                      </List.Item>
                    </List>
                  </Box>
                </Box>
              </BlockStack>
            )}

            {/* Products Tab */}
            {selectedTab === 1 && (
              <BlockStack gap="500">
                <Text variant="headingLg" as="h3">Top Products</Text>
                
                {analytics.topItems.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric']}
                    headings={['Product', 'Views', 'Purchases', 'In Registries', 'Conversion']}
                    rows={analytics.topItems.map(item => [
                      <Text variant="bodyMd" fontWeight="medium" key={item.itemId}>
                        {item.productTitle}
                      </Text>,
                      formatNumber(item.views),
                      item.purchases > 0 ? (
                        <Badge tone="success">{item.purchases}</Badge>
                      ) : (
                        <Text variant="bodyMd" tone="subdued">0</Text>
                      ),
                      formatNumber(item.wishlists),
                      <Badge 
                        key={item.itemId}
                        tone={item.conversionRate > 20 ? 'success' : item.conversionRate > 10 ? 'attention' : 'base'}
                      >
                        {item.conversionRate}%
                      </Badge>
                    ])}
                  />
                ) : (
                  <EmptyState
                    heading="No product data yet"
                    image="/api/placeholder/400/300"
                  >
                    <Text variant="bodyMd" tone="subdued">
                      Product analytics will appear here as people view and purchase items.
                    </Text>
                  </EmptyState>
                )}
              </BlockStack>
            )}

            {/* Traffic Sources Tab */}
            {selectedTab === 2 && (
              <BlockStack gap="500">
                <Text variant="headingLg" as="h3">Traffic Sources</Text>
                
                {analytics.sources.length > 0 ? (
                  <Box>
                    <BlockStack gap="400">
                      {analytics.sources.map((source, index) => (
                        <Card key={index}>
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold">
                                {source.source}
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                {formatNumber(source.visits)} visits • {source.conversions} conversions
                              </Text>
                            </BlockStack>
                            <InlineStack gap="300" align="end">
                              <Box minWidth="100px">
                                <ProgressBar 
                                  progress={source.percentage} 
                                  size="small"
                                  tone="primary"
                                />
                              </Box>
                              <Badge>{source.percentage}%</Badge>
                            </InlineStack>
                          </InlineStack>
                        </Card>
                      ))}
                    </BlockStack>
                  </Box>
                ) : (
                  <EmptyState
                    heading="No traffic data yet"
                    image="/api/placeholder/400/300"
                  >
                    <Text variant="bodyMd" tone="subdued">
                      Traffic source data will appear here as people visit your registry.
                    </Text>
                  </EmptyState>
                )}
              </BlockStack>
            )}

            {/* Purchasers Tab */}
            {selectedTab === 3 && (
              <BlockStack gap="500">
                <Text variant="headingLg" as="h3">Gift Givers</Text>
                
                {analytics.purchasers.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'numeric', 'numeric', 'text']}
                    headings={['Name', 'Email', 'Items', 'Total Spent', 'Last Purchase']}
                    rows={analytics.purchasers.map(purchaser => [
                      <InlineStack gap="200" align="start" key={purchaser.email}>
                        <Icon source={PersonIcon} />
                        <Text variant="bodyMd" fontWeight="medium">
                          {purchaser.name}
                        </Text>
                      </InlineStack>,
                      purchaser.email,
                      purchaser.itemCount,
                      <Badge tone="success" key={purchaser.email}>
                        {formatCurrency(purchaser.totalSpent)}
                      </Badge>,
                      new Date(purchaser.lastPurchase).toLocaleDateString()
                    ])}
                  />
                ) : (
                  <EmptyState
                    heading="No purchases yet"
                    action={{
                      content: 'Share Registry',
                      url: `/admin/registries/${registry.id}/share`
                    }}
                    image="/api/placeholder/400/300"
                  >
                    <Text variant="bodyMd" tone="subdued">
                      Gift giver information will appear here when people purchase items.
                    </Text>
                  </EmptyState>
                )}
              </BlockStack>
            )}
          </Tabs>
        </Card>

        {/* Export Options */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Export Analytics</Text>
            <InlineStack gap="300" align="start">
              <Box minWidth="150px">
                <Select
                  label=""
                  options={[
                    { label: 'CSV', value: 'csv' },
                    { label: 'JSON', value: 'json' },
                    { label: 'PDF Report', value: 'pdf' }
                  ]}
                  value={exportFormat}
                  onChange={setExportFormat}
                />
              </Box>
              <Button onClick={handleExport} icon={ExportIcon}>
                Export {exportFormat.toUpperCase()}
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}