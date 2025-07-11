import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
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
  TextField,
  Select,
  Checkbox,
  Collapsible,
  IndexTable,
  EmptyState,
  Modal,
  Form,
  FormLayout,
  ChoiceList,
  RangeSlider,
  Thumbnail,
  Tooltip,
  Icon,
  Link,
  Banner,
  Tabs,
  ProgressBar
} from "@shopify/polaris";
import {
  ProductIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  SearchIcon,
  FilterIcon,
  AutomationIcon,
  ChartVerticalIcon,
  MagicIcon,
  StarFilledIcon,
  InfoIcon
} from "@shopify/polaris-icons";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";

interface Product {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  image?: string;
  status: string;
  createdAt: string;
  popularity: number;
  registryCount: number;
  conversionRate: number;
}

interface SuggestionRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  conditions: {
    eventTypes: string[];
    priceRange: [number, number];
    productTypes: string[];
    tags: string[];
    vendor?: string;
  };
  actions: {
    autoAdd: boolean;
    suggestionWeight: number;
    displayOrder: number;
  };
  performance: {
    timesTriggered: number;
    conversionRate: number;
    revenue: number;
  };
}

interface LoaderData {
  products: Product[];
  suggestionRules: SuggestionRule[];
  productTypes: string[];
  vendors: string[];
  tags: string[];
  stats: {
    totalProducts: number;
    activeRules: number;
    avgConversionRate: number;
    totalRevenue: number;
  };
}

/**
 * Product Suggestion System
 * AI-powered product recommendations and manual curation tools
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await db.shop.findUnique({
    where: { id: session.shop },
    include: { settings: true }
  });
  
  if (!shop) {
    throw new Error(`Shop ${session.shop} not found`);
  }
  // Mock data for demo - in production, fetch from Shopify GraphQL API
  const products: Product[] = [
    {
      id: '1',
      title: 'KitchenAid Professional Stand Mixer',
      handle: 'kitchenaid-professional-mixer',
      vendor: 'KitchenAid',
      productType: 'Kitchen Appliances',
      tags: ['wedding', 'cooking', 'premium', 'popular'],
      price: 399.99,
      compareAtPrice: 499.99,
      image: '/api/placeholder/80/80',
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
      popularity: 92,
      registryCount: 45,
      conversionRate: 78.5
    },
    {
      id: '2',
      title: 'Instant Pot Duo 7-in-1 Pressure Cooker',
      handle: 'instant-pot-duo-7in1',
      vendor: 'Instant Pot',
      productType: 'Kitchen Appliances',
      tags: ['cooking', 'convenience', 'bestseller'],
      price: 89.99,
      compareAtPrice: 119.99,
      image: '/api/placeholder/80/80',
      status: 'active',
      createdAt: '2024-01-20T14:30:00Z',
      popularity: 88,
      registryCount: 52,
      conversionRate: 85.2
    },
    {
      id: '3',
      title: 'Vitamix A3500 Ascent Series Blender',
      handle: 'vitamix-a3500-blender',
      vendor: 'Vitamix',
      productType: 'Kitchen Appliances',
      tags: ['health', 'premium', 'wedding'],
      price: 549.99,
      image: '/api/placeholder/80/80',
      status: 'active',
      createdAt: '2024-02-01T09:15:00Z',
      popularity: 85,
      registryCount: 28,
      conversionRate: 72.1
    },
    {
      id: '4',
      title: 'Dyson V15 Detect Absolute Vacuum',
      handle: 'dyson-v15-detect-vacuum',
      vendor: 'Dyson',
      productType: 'Home & Garden',
      tags: ['cleaning', 'technology', 'premium'],
      price: 749.99,
      image: '/api/placeholder/80/80',
      status: 'active',
      createdAt: '2024-02-10T16:45:00Z',
      popularity: 79,
      registryCount: 18,
      conversionRate: 65.3
    },
    {
      id: '5',
      title: 'Nespresso VertuoPlus Coffee Maker',
      handle: 'nespresso-vertuoplus',
      vendor: 'Nespresso',
      productType: 'Kitchen Appliances',
      tags: ['coffee', 'convenience', 'luxury'],
      price: 199.99,
      image: '/api/placeholder/80/80',
      status: 'active',
      createdAt: '2024-02-15T11:20:00Z',
      popularity: 82,
      registryCount: 31,
      conversionRate: 79.6
    }
  ];

  const suggestionRules: SuggestionRule[] = [
    {
      id: '1',
      name: 'Wedding Registry Essentials',
      description: 'Automatically suggest essential kitchen items for wedding registries',
      isActive: true,
      priority: 1,
      conditions: {
        eventTypes: ['wedding'],
        priceRange: [50, 500],
        productTypes: ['Kitchen Appliances', 'Cookware'],
        tags: ['wedding', 'essential'],
      },
      actions: {
        autoAdd: false,
        suggestionWeight: 10,
        displayOrder: 1
      },
      performance: {
        timesTriggered: 156,
        conversionRate: 73.2,
        revenue: 12450.80
      }
    },
    {
      id: '2',
      name: 'Baby Shower Must-Haves',
      description: 'Curated list of popular baby products for new parents',
      isActive: true,
      priority: 2,
      conditions: {
        eventTypes: ['baby'],
        priceRange: [25, 300],
        productTypes: ['Baby & Kids'],
        tags: ['baby', 'newborn', 'essential'],
      },
      actions: {
        autoAdd: true,
        suggestionWeight: 9,
        displayOrder: 1
      },
      performance: {
        timesTriggered: 89,
        conversionRate: 82.1,
        revenue: 8920.45
      }
    },
    {
      id: '3',
      name: 'Premium Products Recommendation',
      description: 'Suggest high-value items for customers with larger budgets',
      isActive: true,
      priority: 3,
      conditions: {
        eventTypes: ['wedding', 'graduation'],
        priceRange: [500, 2000],
        productTypes: [],
        tags: ['premium', 'luxury'],
      },
      actions: {
        autoAdd: false,
        suggestionWeight: 8,
        displayOrder: 2
      },
      performance: {
        timesTriggered: 34,
        conversionRate: 45.6,
        revenue: 15680.25
      }
    }
  ];

  const productTypes = ['Kitchen Appliances', 'Home & Garden', 'Baby & Kids', 'Electronics', 'Fashion', 'Sports & Outdoors'];
  const vendors = ['KitchenAid', 'Instant Pot', 'Vitamix', 'Dyson', 'Nespresso', 'Sony', 'Apple'];
  const tags = ['wedding', 'baby', 'cooking', 'premium', 'bestseller', 'essential', 'luxury', 'technology'];

  const stats = {
    totalProducts: products.length,
    activeRules: suggestionRules.filter(rule => rule.isActive).length,
    avgConversionRate: products.reduce((sum, p) => sum + p.conversionRate, 0) / products.length,
    totalRevenue: suggestionRules.reduce((sum, rule) => sum + rule.performance.revenue, 0)
  };

  return json<LoaderData>({
    products,
    suggestionRules,
    productTypes,
    vendors,
    tags,
    stats
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await db.shop.findUnique({
    where: { id: session.shop }
  });
  
  if (!shop) {
    throw new Error(`Shop ${session.shop} not found`);
  }
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "create_rule":
      // Create new suggestion rule
      console.log("Creating suggestion rule");
      break;
    case "update_rule":
      // Update existing rule
      console.log("Updating suggestion rule");
      break;
    case "delete_rule":
      // Delete rule
      console.log("Deleting suggestion rule");
      break;
    case "toggle_rule":
      // Toggle rule active status
      console.log("Toggling rule status");
      break;
  }

  return redirect("/admin/products");
};

export default function ProductSuggestions() {
  const { products, suggestionRules, productTypes, vendors, tags, stats } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  // State management
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SuggestionRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popularity');
  const [filterCollapsed, setFilterCollapsed] = useState(true);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);

  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const handleRuleToggle = useCallback((ruleId: string) => {
    const formData = new FormData();
    formData.append("intent", "toggle_rule");
    formData.append("ruleId", ruleId);
    submit(formData, { method: "post" });
  }, [submit]);

  const handleCreateRule = useCallback(() => {
    setEditingRule(null);
    setShowRuleModal(true);
  }, []);

  const handleEditRule = useCallback((rule: SuggestionRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  }, []);

  const handleDeleteRule = useCallback((ruleId: string) => {
    if (confirm("Are you sure you want to delete this suggestion rule?")) {
      const formData = new FormData();
      formData.append("intent", "delete_rule");
      formData.append("ruleId", ruleId);
      submit(formData, { method: "post" });
    }
  }, [submit]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter.length === 0 || typeFilter.includes(product.productType);
    const matchesVendor = vendorFilter.length === 0 || vendorFilter.includes(product.vendor);
    const matchesTag = tagFilter.length === 0 || tagFilter.some(tag => product.tags.includes(tag));
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];

    return matchesSearch && matchesType && matchesVendor && matchesTag && matchesPrice;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'popularity':
        return b.popularity - a.popularity;
      case 'conversion':
        return b.conversionRate - a.conversionRate;
      case 'registries':
        return b.registryCount - a.registryCount;
      case 'price_low':
        return a.price - b.price;
      case 'price_high':
        return b.price - a.price;
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const tabs = [
    { id: 'products', content: 'Product Catalog', badge: products.length.toString() },
    { id: 'rules', content: 'Suggestion Rules', badge: suggestionRules.length.toString() },
    { id: 'performance', content: 'Performance', badge: stats.activeRules.toString() }
  ];

  const productRowMarkup = sortedProducts.map((product, index) => (
    <IndexTable.Row
      id={product.id}
      key={product.id}
      selected={selectedProducts.includes(product.id)}
      position={index}
    >
      <IndexTable.Cell>
        <InlineStack gap="300" align="start">
          <Thumbnail source={product.image} alt={product.title} size="small" />
          <BlockStack gap="100">
            <Link url={`/admin/products/${product.id}`} removeUnderline>
              <Text variant="bodyMd" fontWeight="semibold">
                {product.title}
              </Text>
            </Link>
            <Text variant="bodySm" tone="subdued">
              {product.vendor} • {product.productType}
            </Text>
          </BlockStack>
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200">
          {product.tags.slice(0, 3).map(tag => (
            <Badge key={tag} size="small">{tag}</Badge>
          ))}
          {product.tags.length > 3 && (
            <Badge size="small">+{product.tags.length - 3}</Badge>
          )}
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="100" align="start">
          <Text variant="bodyMd" fontWeight="medium">
            {formatCurrency(product.price)}
          </Text>
          {product.compareAtPrice && (
            <Text variant="bodySm" tone="subdued" textDecorationLine="line-through">
              {formatCurrency(product.compareAtPrice)}
            </Text>
          )}
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200" align="center">
          <Box width="40px">
            <ProgressBar progress={product.popularity} size="small" />
          </Box>
          <Text variant="bodySm">{product.popularity}%</Text>
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd">{product.registryCount}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd">{formatPercentage(product.conversionRate)}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const ruleRowMarkup = suggestionRules.map((rule, index) => (
    <IndexTable.Row
      id={rule.id}
      key={rule.id}
      position={index}
    >
      <IndexTable.Cell>
        <BlockStack gap="100">
          <InlineStack gap="200" align="start">
            <Text variant="bodyMd" fontWeight="semibold">
              {rule.name}
            </Text>
            <Badge tone={rule.isActive ? 'success' : 'critical'}>
              {rule.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </InlineStack>
          <Text variant="bodySm" tone="subdued">
            {rule.description}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200">
          {rule.conditions.eventTypes.map(type => (
            <Badge key={type} size="small">{type}</Badge>
          ))}
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd">{rule.performance.timesTriggered}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd">{formatPercentage(rule.performance.conversionRate)}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd">{formatCurrency(rule.performance.revenue)}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <ButtonGroup>
          <Button 
            size="micro" 
            variant={rule.isActive ? "secondary" : "primary"}
            onClick={() => handleRuleToggle(rule.id)}
          >
            {rule.isActive ? 'Disable' : 'Enable'}
          </Button>
          <Button size="micro" onClick={() => handleEditRule(rule)}>
            Edit
          </Button>
          <Button 
            size="micro" 
            tone="critical" 
            onClick={() => handleDeleteRule(rule.id)}
          >
            Delete
          </Button>
        </ButtonGroup>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Product Suggestions"
      subtitle="Manage AI-powered product recommendations and curation rules"
      primaryAction={{
        content: 'Create Suggestion Rule',
        icon: PlusIcon,
        onAction: handleCreateRule
      }}
      secondaryActions={[
        {
          content: 'Import Products',
          accessibilityLabel: 'Import products from catalog'
        },
        {
          content: 'Sync Catalog',
          accessibilityLabel: 'Sync with Shopify catalog'
        }
      ]}
    >
      <BlockStack gap="500">
        {/* Key Metrics */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Total Products</Text>
                <Icon source={ProductIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">{stats.totalProducts}</Text>
              <Text variant="bodySm" tone="subdued">In suggestion system</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Active Rules</Text>
                <Icon source={AutomationIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">{stats.activeRules}</Text>
              <Text variant="bodySm" tone="subdued">Automation rules running</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Avg Conversion</Text>
                <Icon source={ChartVerticalIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">{formatPercentage(stats.avgConversionRate)}</Text>
              <Text variant="bodySm" tone="subdued">Suggestion conversion rate</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Revenue Impact</Text>
                <Icon source={MagicIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">{formatCurrency(stats.totalRevenue)}</Text>
              <Text variant="bodySm" tone="subdued">From suggestions</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* AI Insights Banner */}
        <Banner
          title="AI-Powered Insights Available"
          status="info"
          action={{
            content: 'View Insights',
            onAction: () => setSelectedTab(2)
          }}
        >
          <Text variant="bodyMd">
            Machine learning has identified 3 new optimization opportunities to improve your suggestion performance.
          </Text>
        </Banner>

        {/* Main Content Tabs */}
        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box padding="400">
              {selectedTab === 0 && (
                <BlockStack gap="400">
                  {/* Product Filters */}
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text variant="headingMd" as="h3">Product Catalog</Text>
                        <Button
                          icon={FilterIcon}
                          onClick={() => setFilterCollapsed(!filterCollapsed)}
                          ariaExpanded={!filterCollapsed}
                          ariaControls="filters"
                        >
                          Filters
                        </Button>
                      </InlineStack>

                      <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="300">
                        <TextField
                          label="Search products"
                          value={searchQuery}
                          onChange={setSearchQuery}
                          placeholder="Search by title or vendor..."
                          prefix={<Icon source={SearchIcon} />}
                          clearButton
                          onClearButtonClick={() => setSearchQuery('')}
                        />
                        
                        <Select
                          label="Sort by"
                          options={[
                            { label: 'Popularity', value: 'popularity' },
                            { label: 'Conversion Rate', value: 'conversion' },
                            { label: 'Registry Count', value: 'registries' },
                            { label: 'Price: Low to High', value: 'price_low' },
                            { label: 'Price: High to Low', value: 'price_high' },
                            { label: 'Title A-Z', value: 'title' }
                          ]}
                          value={sortBy}
                          onChange={setSortBy}
                        />
                      </InlineGrid>

                      <Collapsible
                        open={!filterCollapsed}
                        id="filters"
                        transition={{ duration: '150ms', timingFunction: 'ease' }}
                      >
                        <Box paddingBlockStart="300">
                          <FormLayout>
                            <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="300">
                              <ChoiceList
                                title="Product Type"
                                choices={productTypes.map(type => ({ label: type, value: type }))}
                                selected={typeFilter}
                                onChange={setTypeFilter}
                                allowMultiple
                              />
                              
                              <ChoiceList
                                title="Vendor"
                                choices={vendors.map(vendor => ({ label: vendor, value: vendor }))}
                                selected={vendorFilter}
                                onChange={setVendorFilter}
                                allowMultiple
                              />
                              
                              <ChoiceList
                                title="Tags"
                                choices={tags.map(tag => ({ label: tag, value: tag }))}
                                selected={tagFilter}
                                onChange={setTagFilter}
                                allowMultiple
                              />
                              
                              <Box>
                                <Text variant="bodyMd" fontWeight="medium">Price Range</Text>
                                <RangeSlider
                                  label="Price range"
                                  value={priceRange}
                                  onChange={setPriceRange}
                                  output
                                  min={0}
                                  max={1000}
                                  step={25}
                                  prefix="$"
                                />
                              </Box>
                            </InlineGrid>
                          </FormLayout>
                        </Box>
                      </Collapsible>
                    </BlockStack>
                  </Card>

                  {/* Products Table */}
                  <Card padding="0">
                    <IndexTable
                      resourceName={{ singular: 'product', plural: 'products' }}
                      itemCount={sortedProducts.length}
                      selectedItemsCount={selectedProducts.length}
                      onSelectionChange={(type, value) => {
                        if (type === 'all') {
                          setSelectedProducts(selectedProducts.length === sortedProducts.length ? [] : sortedProducts.map(p => p.id));
                        } else {
                          setSelectedProducts(prev => 
                            prev.includes(value as string)
                              ? prev.filter(id => id !== value)
                              : [...prev, value as string]
                          );
                        }
                      }}
                      headings={[
                        { title: 'Product' },
                        { title: 'Tags' },
                        { title: 'Price' },
                        { title: 'Popularity' },
                        { title: 'In Registries' },
                        { title: 'Conversion Rate' }
                      ]}
                      emptyState={
                        <EmptyState
                          heading="No products found"
                          action={{ content: 'Clear filters', onAction: () => {
                            setSearchQuery('');
                            setTypeFilter([]);
                            setVendorFilter([]);
                            setTagFilter([]);
                            setPriceRange([0, 1000]);
                          }}}
                          image="/api/placeholder/400/300"
                        >
                          <Text variant="bodyMd" tone="subdued">
                            Try adjusting your search or filter criteria.
                          </Text>
                        </EmptyState>
                      }
                    >
                      {productRowMarkup}
                    </IndexTable>
                  </Card>
                </BlockStack>
              )}

              {selectedTab === 1 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingLg" as="h2">Suggestion Rules</Text>
                    <Button variant="primary" icon={PlusIcon} onClick={handleCreateRule}>
                      Create Rule
                    </Button>
                  </InlineStack>

                  <Card padding="0">
                    <IndexTable
                      resourceName={{ singular: 'rule', plural: 'rules' }}
                      itemCount={suggestionRules.length}
                      headings={[
                        { title: 'Rule' },
                        { title: 'Event Types' },
                        { title: 'Triggered' },
                        { title: 'Conversion' },
                        { title: 'Revenue' },
                        { title: 'Actions' }
                      ]}
                    >
                      {ruleRowMarkup}
                    </IndexTable>
                  </Card>
                </BlockStack>
              )}

              {selectedTab === 2 && (
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">Performance Insights</Text>
                  
                  <InlineGrid columns={{ xs: 1, lg: 2 }} gap="400">
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Top Performing Rules</Text>
                        {suggestionRules
                          .sort((a, b) => b.performance.conversionRate - a.performance.conversionRate)
                          .slice(0, 3)
                          .map((rule, index) => (
                            <Box key={rule.id}>
                              <InlineStack align="space-between">
                                <BlockStack gap="100">
                                  <Text variant="bodyMd" fontWeight="medium">{rule.name}</Text>
                                  <Text variant="bodySm" tone="subdued">
                                    {formatPercentage(rule.performance.conversionRate)} conversion • {formatCurrency(rule.performance.revenue)} revenue
                                  </Text>
                                </BlockStack>
                                <InlineStack gap="100" align="center">
                                  <Icon source={StarFilledIcon} tone="warning" />
                                  <Text variant="bodySm">#{index + 1}</Text>
                                </InlineStack>
                              </InlineStack>
                              {index < 2 && <Divider />}
                            </Box>
                          ))}
                      </BlockStack>
                    </Card>

                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Optimization Opportunities</Text>
                        
                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={InfoIcon} tone="info" />
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="medium">
                                Increase Wedding Registry Coverage
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                Add 15 more kitchen appliances to wedding suggestions (+$2,400 potential revenue)
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>

                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={InfoIcon} tone="attention" />
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="medium">
                                Optimize Price Thresholds
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                Adjust premium product rule to $400-$800 range for better conversion
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>

                        <Box>
                          <InlineStack gap="200" align="start">
                            <Icon source={InfoIcon} tone="success" />
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="medium">
                                Enable Auto-Add for Baby Products
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                Baby shower rule shows 82% conversion - consider auto-adding essentials
                              </Text>
                            </BlockStack>
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

      {/* Create/Edit Rule Modal */}
      <Modal
        open={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title={editingRule ? 'Edit Suggestion Rule' : 'Create Suggestion Rule'}
        primaryAction={{
          content: editingRule ? 'Update Rule' : 'Create Rule',
          onAction: () => {
            // Handle form submission
            setShowRuleModal(false);
          }
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowRuleModal(false)
          }
        ]}
      >
        <Modal.Section>
          <Form>
            <FormLayout>
              <TextField
                label="Rule Name"
                value={editingRule?.name || ''}
                onChange={() => {}}
                placeholder="e.g., Wedding Registry Essentials"
              />
              
              <TextField
                label="Description"
                value={editingRule?.description || ''}
                onChange={() => {}}
                placeholder="Describe when this rule should trigger"
                multiline={3}
              />

              <ChoiceList
                title="Event Types"
                choices={[
                  { label: 'Wedding', value: 'wedding' },
                  { label: 'Baby Shower', value: 'baby' },
                  { label: 'Birthday', value: 'birthday' },
                  { label: 'Holiday', value: 'holiday' },
                  { label: 'Graduation', value: 'graduation' }
                ]}
                selected={editingRule?.conditions.eventTypes || []}
                onChange={() => {}}
                allowMultiple
              />

              <Box>
                <Text variant="bodyMd" fontWeight="medium">Price Range</Text>
                <RangeSlider
                  label="Price range for suggestions"
                  value={editingRule?.conditions.priceRange || [0, 500]}
                  onChange={() => {}}
                  output
                  min={0}
                  max={2000}
                  step={25}
                  prefix="$"
                />
              </Box>

              <Checkbox
                label="Automatically add suggested products to registries"
                checked={editingRule?.actions.autoAdd || false}
                onChange={() => {}}
                helpText="Products will be automatically added based on this rule"
              />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}