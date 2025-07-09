import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  Badge,
  Button,
  ButtonGroup,
  InlineStack,
  Box,
  ProgressBar,
  Divider,
  Select,
  DataTable,
  Tabs,
  Icon,
  Link,
  Tooltip
} from "@shopify/polaris";
import {
  ChartVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PersonIcon,
  OrderIcon,
  ProductIcon,
  CalendarIcon,
  ExportIcon,
  InfoIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
import { db } from "~/lib/db.server";

interface AnalyticsData {
  overview: {
    totalRegistries: number;
    activeRegistries: number;
    totalCustomers: number;
    totalRevenue: number;
    conversionRate: number;
    averageOrderValue: number;
    trendsData: {
      registriesGrowth: number;
      revenueGrowth: number;
      customersGrowth: number;
      conversionGrowth: number;
    };
  };
  timeSeriesData: {
    registryCreations: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
    customers: Array<{ date: string; value: number }>;
  };
  topPerformers: {
    registries: Array<{
      id: string;
      title: string;
      customer: string;
      revenue: number;
      items: number;
      conversionRate: number;
    }>;
    products: Array<{
      id: string;
      title: string;
      timesAdded: number;
      revenue: number;
      conversionRate: number;
    }>;
    customers: Array<{
      id: string;
      name: string;
      email: string;
      registries: number;
      totalValue: number;
    }>;
  };
  insights: {
    popularEventTypes: Array<{ type: string; count: number; percentage: number }>;
    averageRegistrySize: number;
    averageTimeToComplete: number;
    mostPopularItems: Array<{ title: string; count: number }>;
    seasonalTrends: Array<{ month: string; registries: number; revenue: number }>;
  };
}

interface LoaderData {
  analytics: AnalyticsData;
  dateRange: string;
  shop: {
    id: string;
    name: string;
    currencyCode: string;
  };
}

/**
 * Analytics & Reporting Dashboard
 * Comprehensive analytics interface with data visualization and insights
 */
export const loader = withAdminAuth(async ({ request }, { admin, session, shop }) => {
  const url = new URL(request.url);
  const dateRange = url.searchParams.get("range") || "30d";
  
  // Calculate date range
  const now = new Date();
  const startDate = new Date();
  
  switch (dateRange) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  // Get basic metrics
  const [totalRegistries, activeRegistries, totalCustomers] = await Promise.all([
    db.registry.count({ 
      where: { 
        shopId: shop.id,
        createdAt: { gte: startDate }
      } 
    }),
    db.registry.count({ 
      where: { 
        shopId: shop.id, 
        status: { in: ['active', 'public'] },
        createdAt: { gte: startDate }
      } 
    }),
    db.registry.count({
      where: {
        shopId: shop.id,
        customerId: { not: null },
        createdAt: { gte: startDate }
      },
      distinct: ['customerId']
    })
  ]);

  // Get registry purchases for revenue calculation
  const purchases = await db.registryPurchase.findMany({
    where: {
      registryItem: {
        registry: { shopId: shop.id }
      },
      createdAt: { gte: startDate }
    },
    include: {
      registryItem: {
        select: { price: true }
      }
    }
  });

  const totalRevenue = purchases.reduce((sum, purchase) => 
    sum + (purchase.registryItem.price * purchase.quantity), 0
  );

  const conversionRate = totalRegistries > 0 ? (purchases.length / totalRegistries) * 100 : 0;
  const averageOrderValue = purchases.length > 0 ? totalRevenue / purchases.length : 0;

  // Mock trend data (in production, calculate from historical data)
  const trendsData = {
    registriesGrowth: 12.5,
    revenueGrowth: 8.3,
    customersGrowth: 15.2,
    conversionGrowth: -2.1
  };

  // Generate time series data (mock for demo)
  const generateTimeSeriesData = (baseValue: number, days: number) => {
    const data = [];
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const variation = Math.random() * 0.3 + 0.85; // 85-115% variation
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.floor(baseValue * variation * (1 + Math.random() * 0.2))
      });
    }
    return data;
  };

  const timeSeriesData = {
    registryCreations: generateTimeSeriesData(3, 30),
    revenue: generateTimeSeriesData(totalRevenue / 30, 30),
    customers: generateTimeSeriesData(2, 30)
  };

  // Get top performing registries
  const topRegistries = await db.registry.findMany({
    where: { 
      shopId: shop.id,
      createdAt: { gte: startDate }
    },
    include: {
      items: {
        include: {
          purchases: true
        }
      }
    },
    take: 10
  });

  const topPerformingRegistries = topRegistries
    .map(registry => {
      const revenue = registry.items.reduce((sum, item) => 
        sum + item.purchases.reduce((itemSum, purchase) => 
          itemSum + (item.price * purchase.quantity), 0
        ), 0
      );
      const totalItems = registry.items.length;
      const purchasedItems = registry.items.filter(item => item.purchases.length > 0).length;
      const conversionRate = totalItems > 0 ? (purchasedItems / totalItems) * 100 : 0;

      return {
        id: registry.id,
        title: registry.title,
        customer: registry.customerFirstName && registry.customerLastName 
          ? `${registry.customerFirstName} ${registry.customerLastName}`
          : registry.customerEmail || 'Guest',
        revenue,
        items: totalItems,
        conversionRate
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Get top products (mock data for now)
  const topProducts = [
    { id: '1', title: 'Vitamix Professional Blender', timesAdded: 45, revenue: 18000, conversionRate: 78 },
    { id: '2', title: 'KitchenAid Stand Mixer', timesAdded: 38, revenue: 15200, conversionRate: 82 },
    { id: '3', title: 'Dyson V15 Vacuum', timesAdded: 32, revenue: 19200, conversionRate: 65 },
    { id: '4', title: 'Instant Pot Duo Plus', timesAdded: 28, revenue: 4200, conversionRate: 90 },
    { id: '5', title: 'Ninja Foodi Grill', timesAdded: 25, revenue: 6250, conversionRate: 72 }
  ];

  // Get customer insights (mock data)
  const topCustomers = [
    { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com', registries: 3, totalValue: 2400 },
    { id: '2', name: 'Mike Chen', email: 'mike@example.com', registries: 2, totalValue: 1800 },
    { id: '3', name: 'Emma Davis', email: 'emma@example.com', registries: 2, totalValue: 1650 },
    { id: '4', name: 'Alex Thompson', email: 'alex@example.com', registries: 1, totalValue: 1200 },
    { id: '5', name: 'Lisa Rodriguez', email: 'lisa@example.com', registries: 1, totalValue: 950 }
  ];

  // Generate insights
  const eventTypes = await db.registry.groupBy({
    by: ['eventType'],
    where: { 
      shopId: shop.id,
      createdAt: { gte: startDate }
    },
    _count: { eventType: true }
  });

  const popularEventTypes = eventTypes.map(event => ({
    type: event.eventType || 'other',
    count: event._count.eventType,
    percentage: totalRegistries > 0 ? (event._count.eventType / totalRegistries) * 100 : 0
  }));

  const insights = {
    popularEventTypes,
    averageRegistrySize: totalRegistries > 0 ? 
      topRegistries.reduce((sum, r) => sum + r.items.length, 0) / totalRegistries : 0,
    averageTimeToComplete: 14, // Mock data
    mostPopularItems: [
      { title: 'Kitchen Appliances', count: 156 },
      { title: 'Home Decor', count: 143 },
      { title: 'Bedding & Bath', count: 128 },
      { title: 'Electronics', count: 95 },
      { title: 'Outdoor & Garden', count: 87 }
    ],
    seasonalTrends: generateTimeSeriesData(15, 12).map((item, index) => ({
      month: new Date(0, index).toLocaleDateString('en-US', { month: 'short' }),
      registries: item.value,
      revenue: item.value * 150
    }))
  };

  const analytics: AnalyticsData = {
    overview: {
      totalRegistries,
      activeRegistries,
      totalCustomers,
      totalRevenue,
      conversionRate,
      averageOrderValue,
      trendsData
    },
    timeSeriesData,
    topPerformers: {
      registries: topPerformingRegistries,
      products: topProducts,
      customers: topCustomers
    },
    insights
  };

  return json<LoaderData>({
    analytics,
    dateRange,
    shop: {
      id: shop.id,
      name: shop.name,
      currencyCode: shop.currencyCode
    }
  });
});

export default function Analytics() {
  const { analytics, dateRange, shop } = useLoaderData<LoaderData>();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedDateRange, setSelectedDateRange] = useState(dateRange);

  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const handleDateRangeChange = useCallback((value: string) => {
    setSelectedDateRange(value);
    // In a real app, you'd update the URL and refetch data
    window.location.href = `/admin/analytics?range=${value}`;
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: shop.currencyCode
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    return value >= 0 ? ArrowUpIcon : ArrowDownIcon;
  };

  const getTrendTone = (value: number) => {
    return value >= 0 ? 'success' : 'critical';
  };

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'registries', content: 'Registries' },
    { id: 'products', content: 'Products' },
    { id: 'customers', content: 'Customers' },
    { id: 'insights', content: 'Insights' }
  ];

  const dateRangeOptions = [
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'Last year', value: '1y' }
  ];

  const overviewMetrics = [
    {
      title: 'Total Registries',
      value: analytics.overview.totalRegistries.toString(),
      trend: analytics.overview.trendsData.registriesGrowth,
      icon: OrderIcon
    },
    {
      title: 'Active Registries',
      value: analytics.overview.activeRegistries.toString(),
      trend: analytics.overview.trendsData.registriesGrowth * 0.8,
      icon: ChartVerticalIcon
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(analytics.overview.totalRevenue),
      trend: analytics.overview.trendsData.revenueGrowth,
      icon: ArrowUpIcon
    },
    {
      title: 'Customers',
      value: analytics.overview.totalCustomers.toString(),
      trend: analytics.overview.trendsData.customersGrowth,
      icon: PersonIcon
    },
    {
      title: 'Conversion Rate',
      value: formatPercentage(analytics.overview.conversionRate),
      trend: analytics.overview.trendsData.conversionGrowth,
      icon: ChartVerticalIcon
    },
    {
      title: 'Avg Order Value',
      value: formatCurrency(analytics.overview.averageOrderValue),
      trend: 5.2,
      icon: ProductIcon
    }
  ];

  const topRegistriesRows = analytics.topPerformers.registries.map(registry => [
    <Link url={`/admin/registries/${registry.id}`} removeUnderline>
      <Text variant="bodyMd" fontWeight="medium">{registry.title}</Text>
    </Link>,
    registry.customer,
    formatCurrency(registry.revenue),
    registry.items.toString(),
    formatPercentage(registry.conversionRate)
  ]);

  const topProductsRows = analytics.topPerformers.products.map(product => [
    product.title,
    product.timesAdded.toString(),
    formatCurrency(product.revenue),
    formatPercentage(product.conversionRate)
  ]);

  const topCustomersRows = analytics.topPerformers.customers.map(customer => [
    customer.name,
    customer.email,
    customer.registries.toString(),
    formatCurrency(customer.totalValue)
  ]);

  return (
    <Page
      title="Analytics & Insights"
      subtitle="Track your gift registry performance and customer behavior"
      secondaryActions={[
        {
          content: 'Export Report',
          icon: ExportIcon,
          accessibilityLabel: 'Export analytics report'
        }
      ]}
    >
      <BlockStack gap="500">
        {/* Date Range Selector */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Performance Overview</Text>
            <Box minWidth="200px">
              <Select
                label="Date range"
                labelHidden
                options={dateRangeOptions}
                value={selectedDateRange}
                onChange={handleDateRangeChange}
              />
            </Box>
          </InlineStack>
        </Card>

        {/* Key Metrics */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
          {overviewMetrics.map((metric, index) => (
            <Card key={index}>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="headingSm" as="h3">{metric.title}</Text>
                  <Icon source={metric.icon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="p">{metric.value}</Text>
                <InlineStack gap="200" align="start">
                  <Badge tone={getTrendTone(metric.trend)}>
                    <InlineStack gap="100" align="center">
                      <Icon source={getTrendIcon(metric.trend)} />
                      {formatPercentage(Math.abs(metric.trend))}
                    </InlineStack>
                  </Badge>
                  <Text variant="bodySm" tone="subdued">vs previous period</Text>
                </InlineStack>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>

        {/* Detailed Analytics Tabs */}
        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box padding="400">
              {selectedTab === 0 && (
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">Registry Performance Overview</Text>
                  
                  <InlineGrid columns={{ xs: 1, lg: 2 }} gap="400">
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Event Types Distribution</Text>
                        {analytics.insights.popularEventTypes.map((event, index) => (
                          <Box key={index}>
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="bodyMd">
                                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                              </Text>
                              <Text variant="bodyMd" fontWeight="medium">
                                {event.count} ({formatPercentage(event.percentage)})
                              </Text>
                            </InlineStack>
                            <ProgressBar progress={event.percentage} size="small" />
                          </Box>
                        ))}
                      </BlockStack>
                    </Card>

                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Key Insights</Text>
                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={InfoIcon} tone="info" />
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="medium">
                                Average Registry Size
                              </Text>
                              <Text variant="bodyMd">
                                {analytics.insights.averageRegistrySize.toFixed(1)} items per registry
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                        
                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={CalendarIcon} tone="info" />
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="medium">
                                Time to Complete
                              </Text>
                              <Text variant="bodyMd">
                                {analytics.insights.averageTimeToComplete} days average
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Card>
                  </InlineGrid>
                </BlockStack>
              )}

              {selectedTab === 1 && (
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">Top Performing Registries</Text>
                  <DataTable
                    columnContentTypes={['text', 'text', 'numeric', 'numeric', 'numeric']}
                    headings={['Registry', 'Customer', 'Revenue', 'Items', 'Conversion Rate']}
                    rows={topRegistriesRows}
                  />
                </BlockStack>
              )}

              {selectedTab === 2 && (
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">Product Performance</Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                    headings={['Product', 'Times Added', 'Revenue', 'Conversion Rate']}
                    rows={topProductsRows}
                  />
                </BlockStack>
              )}

              {selectedTab === 3 && (
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">Customer Insights</Text>
                  <DataTable
                    columnContentTypes={['text', 'text', 'numeric', 'numeric']}
                    headings={['Customer', 'Email', 'Registries', 'Total Value']}
                    rows={topCustomersRows}
                  />
                </BlockStack>
              )}

              {selectedTab === 4 && (
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">Business Insights</Text>
                  
                  <InlineGrid columns={{ xs: 1, lg: 2 }} gap="400">
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Popular Categories</Text>
                        {analytics.insights.mostPopularItems.map((item, index) => (
                          <InlineStack key={index} align="space-between">
                            <Text variant="bodyMd">{item.title}</Text>
                            <Badge>{item.count}</Badge>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Card>

                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Recommendations</Text>
                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={ArrowUpIcon} tone="success" />
                            <Text variant="bodyMd">
                              Wedding registries show highest conversion rates
                            </Text>
                          </InlineStack>
                        </Box>
                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={ProductIcon} tone="info" />
                            <Text variant="bodyMd">
                              Kitchen appliances are the most popular category
                            </Text>
                          </InlineStack>
                        </Box>
                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={PersonIcon} tone="attention" />
                            <Text variant="bodyMd">
                              Consider promoting group gifting for higher-value items
                            </Text>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Card>
                  </InlineGrid>
                </BlockStack>
              )}
            </Box>
          </Tabs>
        </Card>
      </BlockStack>
    </Page>
  );
}