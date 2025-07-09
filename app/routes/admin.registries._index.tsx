import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  ButtonGroup,
  InlineStack,
  Box,
  EmptyState,
  IndexFilters,
  ChoiceList,
  RangeSlider,
  Tabs,
  useBreakpoints,
  Pagination,
  Icon,
  Tooltip,
  Link
} from "@shopify/polaris";
import {
  PlusIcon,
  ExportIcon,
  ImportIcon,
  ViewIcon,
  EditIcon,
  DeleteIcon,
  PersonIcon,
  OrderIcon,
  SearchIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
import { db } from "~/lib/db.server";

interface LoaderData {
  registries: Array<{
    id: string;
    title: string;
    slug: string;
    customerName: string;
    customerEmail: string;
    status: string;
    visibility: string;
    eventType: string;
    eventDate: string | null;
    itemCount: number;
    totalValue: number;
    createdAt: string;
    lastActivity: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    status: string[];
    visibility: string[];
    eventType: string[];
    dateRange: string[];
  };
}

/**
 * Registry Management Dashboard
 * Complete registry management interface with filtering, sorting, and bulk actions
 */
export const loader = withAdminAuth(async ({ request }, { admin, session, shop }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "25");
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";
  const search = url.searchParams.get("search") || "";
  
  // Filter parameters
  const statusFilter = url.searchParams.getAll("status");
  const visibilityFilter = url.searchParams.getAll("visibility");
  const eventTypeFilter = url.searchParams.getAll("eventType");
  const minValue = parseFloat(url.searchParams.get("minValue") || "0");
  const maxValue = parseFloat(url.searchParams.get("maxValue") || "10000");

  // Build where clause
  const where: any = { shopId: shop.id };
  
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { customerEmail: { contains: search, mode: 'insensitive' } },
      { customerFirstName: { contains: search, mode: 'insensitive' } },
      { customerLastName: { contains: search, mode: 'insensitive' } }
    ];
  }
  
  if (statusFilter.length > 0) {
    where.status = { in: statusFilter };
  }
  
  if (visibilityFilter.length > 0) {
    where.visibility = { in: visibilityFilter };
  }
  
  if (eventTypeFilter.length > 0) {
    where.eventType = { in: eventTypeFilter };
  }

  // Get total count for pagination
  const total = await db.registry.count({ where });

  // Get registries with items for value calculation
  const registries = await db.registry.findMany({
    where,
    include: {
      items: {
        select: { price: true }
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true }
      },
      _count: { select: { items: true } }
    },
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit
  });

  // Format registries data
  const formattedRegistries = registries
    .map(registry => {
      const totalValue = registry.items.reduce((sum, item) => sum + (item.price || 0), 0);
      
      // Filter by value range
      if (totalValue < minValue || totalValue > maxValue) {
        return null;
      }
      
      return {
        id: registry.id,
        title: registry.title,
        slug: registry.slug,
        customerName: registry.customerFirstName && registry.customerLastName 
          ? `${registry.customerFirstName} ${registry.customerLastName}`
          : 'Guest',
        customerEmail: registry.customerEmail || '',
        status: registry.status,
        visibility: registry.visibility,
        eventType: registry.eventType || 'other',
        eventDate: registry.eventDate?.toISOString() || null,
        itemCount: registry._count.items,
        totalValue,
        createdAt: registry.createdAt.toISOString(),
        lastActivity: registry.activities[0]?.createdAt.toISOString() || registry.createdAt.toISOString()
      };
    })
    .filter(Boolean);

  const pagination = {
    total,
    page,
    limit,
    hasNext: page * limit < total,
    hasPrev: page > 1
  };

  const filters = {
    status: ['active', 'draft', 'archived', 'completed'],
    visibility: ['public', 'private', 'friends', 'password'],
    eventType: ['wedding', 'baby', 'birthday', 'holiday', 'graduation', 'other'],
    dateRange: ['today', 'week', 'month', 'quarter', 'year']
  };

  return json<LoaderData>({
    registries: formattedRegistries,
    pagination,
    filters
  });
});

const resourceName = {
  singular: 'registry',
  plural: 'registries',
};

export default function RegistriesIndex() {
  const { registries, pagination, filters } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { smUp } = useBreakpoints();

  // Selection state
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter state
  const [queryValue, setQueryValue] = useState(searchParams.get("search") || "");
  const [sortSelected, setSortSelected] = useState(["createdAt desc"]);
  const [statusFilter, setStatusFilter] = useState<string[]>(searchParams.getAll("status"));
  const [visibilityFilter, setVisibilityFilter] = useState<string[]>(searchParams.getAll("visibility"));
  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>(searchParams.getAll("eventType"));
  const [valueRange, setValueRange] = useState<[number, number]>([
    parseFloat(searchParams.get("minValue") || "0"),
    parseFloat(searchParams.get("maxValue") || "10000")
  ]);

  // Tab state
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'all', content: 'All Registries', badge: registries.length.toString() },
    { id: 'active', content: 'Active', badge: registries.filter(r => r.status === 'active').length.toString() },
    { id: 'draft', content: 'Draft', badge: registries.filter(r => r.status === 'draft').length.toString() },
    { id: 'archived', content: 'Archived', badge: registries.filter(r => r.status === 'archived').length.toString() }
  ];

  // Filter handlers
  const handleFiltersQueryChange = useCallback((value: string) => {
    setQueryValue(value);
    updateSearchParams({ search: value });
  }, []);

  const handleQueryValueRemove = useCallback(() => {
    setQueryValue("");
    updateSearchParams({ search: null });
  }, []);

  const handleFiltersClearAll = useCallback(() => {
    setQueryValue("");
    setStatusFilter([]);
    setVisibilityFilter([]);
    setEventTypeFilter([]);
    setValueRange([0, 10000]);
    
    const newParams = new URLSearchParams();
    setSearchParams(newParams);
  }, []);

  const updateSearchParams = useCallback((updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Bulk actions
  const promotedBulkActions = [
    {
      content: 'Activate registries',
      onAction: () => handleBulkAction('activate'),
    },
    {
      content: 'Archive registries',
      onAction: () => handleBulkAction('archive'),
    },
  ];

  const bulkActions = [
    {
      content: 'Export registries',
      onAction: () => handleBulkAction('export'),
    },
    {
      content: 'Delete registries',
      onAction: () => handleBulkAction('delete'),
    },
  ];

  const handleBulkAction = useCallback(async (action: string) => {
    setIsLoading(true);
    // Implement bulk actions
    console.log(`Bulk ${action} for:`, selectedResources);
    setIsLoading(false);
    setSelectedResources([]);
  }, [selectedResources]);

  // Table row selection
  const handleSelectionChange = useCallback(
    (selectionType: any, toggledId: boolean | string) => {
      if (selectionType === 'all') {
        setSelectedResources(selectedResources.length === registries.length ? [] : registries.map(r => r.id));
      } else {
        setSelectedResources(prev => 
          prev.includes(toggledId as string)
            ? prev.filter(id => id !== toggledId)
            : [...prev, toggledId as string]
        );
      }
    },
    [selectedResources, registries]
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Status badge tone
  const getStatusBadgeTone = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'attention';
      case 'archived': return 'info';
      case 'completed': return 'success';
      default: return 'new';
    }
  };

  // Visibility badge tone
  const getVisibilityBadgeTone = (visibility: string) => {
    switch (visibility) {
      case 'public': return 'success';
      case 'private': return 'critical';
      case 'friends': return 'attention';
      case 'password': return 'warning';
      default: return 'new';
    }
  };

  // Row actions
  const getRowActions = (registry: any) => [
    {
      content: 'View',
      icon: ViewIcon,
      url: `/admin/registries/${registry.id}`,
    },
    {
      content: 'Edit',
      icon: EditIcon,
      url: `/admin/registries/${registry.id}/edit`,
    },
    {
      content: 'View on storefront',
      icon: PersonIcon,
      url: `/registries/${registry.slug}`,
      external: true,
    },
  ];

  // Filters
  const filterMarkup = (
    <IndexFilters
      sortOptions={[
        { label: 'Created (newest first)', value: 'createdAt desc' },
        { label: 'Created (oldest first)', value: 'createdAt asc' },
        { label: 'Title A-Z', value: 'title asc' },
        { label: 'Title Z-A', value: 'title desc' },
        { label: 'Value (highest first)', value: 'value desc' },
        { label: 'Value (lowest first)', value: 'value asc' },
      ]}
      sortSelected={sortSelected}
      queryValue={queryValue}
      queryPlaceholder="Search registries..."
      onQueryChange={handleFiltersQueryChange}
      onQueryClear={handleQueryValueRemove}
      onSort={setSortSelected}
      filters={[
        {
          key: 'status',
          label: 'Status',
          filter: (
            <ChoiceList
              title="Status"
              titleHidden
              choices={filters.status.map(status => ({
                label: status.charAt(0).toUpperCase() + status.slice(1),
                value: status
              }))}
              selected={statusFilter}
              onChange={setStatusFilter}
              allowMultiple
            />
          ),
          shortcut: true,
        },
        {
          key: 'visibility',
          label: 'Visibility',
          filter: (
            <ChoiceList
              title="Visibility"
              titleHidden
              choices={filters.visibility.map(visibility => ({
                label: visibility.charAt(0).toUpperCase() + visibility.slice(1),
                value: visibility
              }))}
              selected={visibilityFilter}
              onChange={setVisibilityFilter}
              allowMultiple
            />
          ),
        },
        {
          key: 'eventType',
          label: 'Event Type',
          filter: (
            <ChoiceList
              title="Event Type"
              titleHidden
              choices={filters.eventType.map(type => ({
                label: type.charAt(0).toUpperCase() + type.slice(1),
                value: type
              }))}
              selected={eventTypeFilter}
              onChange={setEventTypeFilter}
              allowMultiple
            />
          ),
        },
        {
          key: 'value',
          label: 'Registry Value',
          filter: (
            <RangeSlider
              label="Registry value range"
              value={valueRange}
              onChange={setValueRange}
              output
              min={0}
              max={10000}
              step={100}
              prefix="$"
            />
          ),
        },
      ]}
      appliedFilters={[
        ...(queryValue ? [{ key: 'search', label: `Search: ${queryValue}`, onRemove: handleQueryValueRemove }] : []),
        ...statusFilter.map(status => ({
          key: `status:${status}`,
          label: `Status: ${status}`,
          onRemove: () => setStatusFilter(prev => prev.filter(s => s !== status))
        })),
        ...visibilityFilter.map(visibility => ({
          key: `visibility:${visibility}`,
          label: `Visibility: ${visibility}`,
          onRemove: () => setVisibilityFilter(prev => prev.filter(v => v !== visibility))
        })),
        ...eventTypeFilter.map(type => ({
          key: `eventType:${type}`,
          label: `Event: ${type}`,
          onRemove: () => setEventTypeFilter(prev => prev.filter(t => t !== type))
        })),
        ...(valueRange[0] > 0 || valueRange[1] < 10000 ? [{
          key: 'value',
          label: `Value: $${valueRange[0]} - $${valueRange[1]}`,
          onRemove: () => setValueRange([0, 10000])
        }] : [])
      ]}
      onClearAll={handleFiltersClearAll}
      loading={isLoading}
      hideFilters={!smUp}
      tabs={tabs}
      selected={selectedTab}
      onSelect={setSelectedTab}
    />
  );

  const rowMarkup = registries.map((registry, index) => (
    <IndexTable.Row
      id={registry.id}
      key={registry.id}
      selected={selectedResources.includes(registry.id)}
      position={index}
      onClick={() => navigate(`/admin/registries/${registry.id}`)}
    >
      <IndexTable.Cell>
        <InlineStack gap="300" align="start">
          <Box>
            <Link url={`/admin/registries/${registry.id}`} removeUnderline>
              <Text variant="bodyMd" fontWeight="semibold">
                {registry.title}
              </Text>
            </Link>
            <Text variant="bodySm" tone="subdued">
              {registry.slug}
            </Text>
          </Box>
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200" align="start">
          <Box>
            <Text variant="bodyMd">{registry.customerName}</Text>
            <Text variant="bodySm" tone="subdued">
              {registry.customerEmail}
            </Text>
          </Box>
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Badge tone={getStatusBadgeTone(registry.status)}>
            {registry.status}
          </Badge>
          <Badge tone={getVisibilityBadgeTone(registry.visibility)}>
            {registry.visibility}
          </Badge>
        </InlineStack>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="medium">
          {registry.eventType.charAt(0).toUpperCase() + registry.eventType.slice(1)}
        </Text>
        {registry.eventDate && (
          <Text variant="bodySm" tone="subdued">
            {formatDate(registry.eventDate)}
          </Text>
        )}
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd">{registry.itemCount}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="medium">
          {formatCurrency(registry.totalValue)}
        </Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodySm">{formatDate(registry.createdAt)}</Text>
      </IndexTable.Cell>
      
      <IndexTable.Cell>
        <Text variant="bodySm">{formatDate(registry.lastActivity)}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first registry"
      action={{
        content: 'Create registry',
        url: '/admin/registries/new',
      }}
      secondaryAction={{
        content: 'Learn more',
        url: '/admin/help/registries',
      }}
      image="/api/placeholder/400/300"
    >
      <Text variant="bodyMd" tone="subdued">
        Get started by creating a registry to see how your customers will experience gift giving.
      </Text>
    </EmptyState>
  );

  return (
    <Page
      title="Registries"
      subtitle={`${pagination.total} ${pagination.total === 1 ? 'registry' : 'registries'}`}
      primaryAction={{
        content: 'Create registry',
        icon: PlusIcon,
        url: '/admin/registries/new',
      }}
      secondaryActions={[
        {
          content: 'Export',
          icon: ExportIcon,
          accessibilityLabel: 'Export registries',
          onAction: () => handleBulkAction('export'),
        },
        {
          content: 'Import',
          icon: ImportIcon,
          accessibilityLabel: 'Import registries',
          url: '/admin/registries/import',
        },
      ]}
    >
      <Card padding="0">
        <IndexTable
          resourceName={resourceName}
          itemCount={registries.length}
          selectedItemsCount={selectedResources.length}
          onSelectionChange={handleSelectionChange}
          bulkActions={bulkActions}
          promotedBulkActions={promotedBulkActions}
          loading={isLoading}
          emptyState={emptyStateMarkup}
          filterControl={filterMarkup}
          headings={[
            { title: 'Registry' },
            { title: 'Customer' },
            { title: 'Status' },
            { title: 'Event' },
            { title: 'Items' },
            { title: 'Value' },
            { title: 'Created' },
            { title: 'Last Activity' },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
      
      {pagination.total > pagination.limit && (
        <Box paddingBlockStart="400">
          <Pagination
            hasPrevious={pagination.hasPrev}
            onPrevious={() => {
              updateSearchParams({ page: (pagination.page - 1).toString() });
            }}
            hasNext={pagination.hasNext}
            onNext={() => {
              updateSearchParams({ page: (pagination.page + 1).toString() });
            }}
            label={`Page ${pagination.page} of ${Math.ceil(pagination.total / pagination.limit)}`}
          />
        </Box>
      )}
    </Page>
  );
}