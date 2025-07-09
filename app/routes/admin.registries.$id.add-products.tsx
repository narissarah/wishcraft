import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useSearchParams, useNavigation } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  TextField,
  Select,
  Button,
  ButtonGroup,
  InlineStack,
  Box,
  IndexTable,
  Thumbnail,
  Badge,
  Modal,
  Form,
  FormLayout,
  Checkbox,
  RadioButton,
  RangeSlider,
  EmptyState,
  Spinner,
  Banner,
  ChoiceList,
  Collapsible,
  Filters,
  Pagination,
  Icon,
  Link,
  Tooltip
} from "@shopify/polaris";
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  ProductIcon,
  ImageIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InfoIcon,
  CheckIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
import { createShopifyAPI, type ShopifyProduct } from "~/lib/shopify-api.server";
import { createRegistryServiceFromRequest } from "~/lib/registry.server";

interface LoaderData {
  registry: {
    id: string;
    title: string;
    slug: string;
  };
  products: ShopifyProduct[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  filters: {
    productTypes: string[];
    vendors: string[];
    tags: string[];
    collections: Array<{ id: string; title: string }>;
  };
  searchParams: {
    query: string;
    productType: string;
    vendor: string;
    minPrice: number;
    maxPrice: number;
    inStock: boolean;
    cursor: string;
  };
}

/**
 * Product Selection Interface
 * Browse and add products from Shopify catalog to registry
 */
export const loader = withAdminAuth(async ({ request, params }, { admin, session, shop }) => {
  const registryId = params.id;
  if (!registryId) {
    throw new Response("Registry ID required", { status: 400 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";
  const productType = url.searchParams.get("productType") || "";
  const vendor = url.searchParams.get("vendor") || "";
  const minPrice = parseFloat(url.searchParams.get("minPrice") || "0");
  const maxPrice = parseFloat(url.searchParams.get("maxPrice") || "1000");
  const inStock = url.searchParams.get("inStock") === "true";
  const cursor = url.searchParams.get("cursor") || "";

  try {
    // Get registry details
    const registryService = await createRegistryServiceFromRequest(request, shop.id);
    const registry = await registryService.getRegistryById(registryId);

    if (!registry) {
      throw new Response("Registry not found", { status: 404 });
    }

    // Get Shopify API
    const shopifyAPI = await createShopifyAPI(request);

    // Build search query
    let searchQuery = "";
    const queryParts: string[] = [];

    if (query) {
      queryParts.push(`title:*${query}* OR vendor:*${query}* OR product_type:*${query}* OR tag:*${query}*`);
    }

    if (productType) {
      queryParts.push(`product_type:${productType}`);
    }

    if (vendor) {
      queryParts.push(`vendor:${vendor}`);
    }

    if (inStock) {
      queryParts.push(`inventory_quantity:>0`);
    }

    if (minPrice > 0 || maxPrice < 1000) {
      queryParts.push(`variants.price:>=${minPrice} AND variants.price:<=${maxPrice}`);
    }

    searchQuery = queryParts.join(" AND ");

    // Get products
    const { products, pageInfo } = await shopifyAPI.getProducts({
      first: 20,
      after: cursor || undefined,
      query: searchQuery || undefined,
      sortKey: "CREATED_AT"
    });

    // Get filter options from recent products
    const allProducts = await shopifyAPI.getProducts({ first: 250 });
    const productTypes = [...new Set(allProducts.products.map(p => p.productType).filter(Boolean))];
    const vendors = [...new Set(allProducts.products.map(p => p.vendor).filter(Boolean))];
    const allTags = allProducts.products.flatMap(p => p.tags);
    const tags = [...new Set(allTags)].slice(0, 20); // Limit to top 20 tags

    return json<LoaderData>({
      registry: {
        id: registry.id,
        title: registry.title,
        slug: registry.slug
      },
      products,
      pageInfo,
      filters: {
        productTypes: productTypes.sort(),
        vendors: vendors.sort(),
        tags: tags.sort(),
        collections: [] // TODO: Fetch collections if needed
      },
      searchParams: {
        query,
        productType,
        vendor,
        minPrice,
        maxPrice,
        inStock,
        cursor
      }
    });
  } catch (error) {
    console.error("Error loading products:", error);
    throw new Response("Failed to load products", { status: 500 });
  }
});

export const action = withAdminAuth(async ({ request, params }, { admin, session, shop }) => {
  const registryId = params.id;
  if (!registryId) {
    throw new Response("Registry ID required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    const registryService = await createRegistryServiceFromRequest(request, shop.id);

    switch (intent) {
      case "add_product": {
        const productId = formData.get("productId") as string;
        const variantId = formData.get("variantId") as string;
        const quantity = parseInt(formData.get("quantity") as string) || 1;
        const priority = formData.get("priority") as string || "medium";
        const notes = formData.get("notes") as string || "";
        const allowGroupGifting = formData.get("allowGroupGifting") === "on";
        const customPrice = formData.get("customPrice") ? parseFloat(formData.get("customPrice") as string) : undefined;

        await registryService.addItemToRegistry({
          registryId,
          productId,
          variantId: variantId || undefined,
          quantity,
          priority: priority as 'low' | 'medium' | 'high',
          notes: notes || undefined,
          allowGroupGifting,
          customPrice
        });

        return json({ success: true, message: "Product added to registry!" });
      }

      case "add_multiple": {
        const selectedProducts = JSON.parse(formData.get("selectedProducts") as string);
        
        for (const productData of selectedProducts) {
          await registryService.addItemToRegistry({
            registryId,
            productId: productData.productId,
            variantId: productData.variantId || undefined,
            quantity: productData.quantity || 1,
            priority: "medium",
            allowGroupGifting: true
          });
        }

        return json({ 
          success: true, 
          message: `${selectedProducts.length} products added to registry!` 
        });
      }

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error adding products:", error);
    return json({ error: "Failed to add products to registry" }, { status: 500 });
  }
});

export default function AddProductsToRegistry() {
  const { registry, products, pageInfo, filters, searchParams } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [urlSearchParams, setSearchParams] = useSearchParams();

  // State management
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.query);
  const [productTypeFilter, setProductTypeFilter] = useState(searchParams.productType);
  const [vendorFilter, setVendorFilter] = useState(searchParams.vendor);
  const [priceRange, setPriceRange] = useState<[number, number]>([searchParams.minPrice, searchParams.maxPrice]);
  const [inStockOnly, setInStockOnly] = useState(searchParams.inStock);

  // Product modal state
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [allowGroupGifting, setAllowGroupGifting] = useState(true);
  const [customPrice, setCustomPrice] = useState("");

  const isLoading = navigation.state === "submitting";

  // Update URL when filters change
  const updateFilters = useCallback(() => {
    const params = new URLSearchParams();
    
    if (searchQuery) params.set("query", searchQuery);
    if (productTypeFilter) params.set("productType", productTypeFilter);
    if (vendorFilter) params.set("vendor", vendorFilter);
    if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
    if (priceRange[1] < 1000) params.set("maxPrice", priceRange[1].toString());
    if (inStockOnly) params.set("inStock", "true");

    setSearchParams(params);
  }, [searchQuery, productTypeFilter, vendorFilter, priceRange, inStockOnly, setSearchParams]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters();
    }, 500);

    return () => clearTimeout(timer);
  }, [updateFilters]);

  const handleProductSelect = useCallback((productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleAddProduct = useCallback((product: ShopifyProduct) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants[0]?.id || "");
    setQuantity(1);
    setPriority("medium");
    setNotes("");
    setAllowGroupGifting(true);
    setCustomPrice("");
    setShowAddModal(true);
  }, []);

  const handleSubmitProduct = useCallback(() => {
    if (!selectedProduct) return;

    const formData = new FormData();
    formData.append("intent", "add_product");
    formData.append("productId", selectedProduct.id);
    if (selectedVariant) formData.append("variantId", selectedVariant);
    formData.append("quantity", quantity.toString());
    formData.append("priority", priority);
    formData.append("notes", notes);
    if (allowGroupGifting) formData.append("allowGroupGifting", "on");
    if (customPrice) formData.append("customPrice", customPrice);

    submit(formData, { method: "post" });
    setShowAddModal(false);
  }, [selectedProduct, selectedVariant, quantity, priority, notes, allowGroupGifting, customPrice, submit]);

  const handleBulkAdd = useCallback(() => {
    const selectedProductData = selectedProducts.map(productId => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        variantId: product?.variants[0]?.id,
        quantity: 1
      };
    });

    const formData = new FormData();
    formData.append("intent", "add_multiple");
    formData.append("selectedProducts", JSON.stringify(selectedProductData));

    submit(formData, { method: "post" });
    setSelectedProducts([]);
  }, [selectedProducts, products, submit]);

  const formatPrice = (amount: string, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(parseFloat(amount));
  };

  const getProductAvailability = (product: ShopifyProduct) => {
    const availableVariants = product.variants.filter(v => v.availableForSale && v.inventoryQuantity > 0);
    if (availableVariants.length === 0) return { status: 'out-of-stock', text: 'Out of Stock' };
    if (availableVariants.length < product.variants.length) return { status: 'low-stock', text: 'Limited Stock' };
    return { status: 'in-stock', text: 'In Stock' };
  };

  const getAvailabilityBadge = (availability: { status: string; text: string }) => {
    const tones = {
      'in-stock': 'success' as const,
      'low-stock': 'attention' as const,
      'out-of-stock': 'critical' as const
    };
    
    return <Badge tone={tones[availability.status as keyof typeof tones]}>{availability.text}</Badge>;
  };

  const handlePagination = (cursor: string, direction: 'next' | 'prev') => {
    const params = new URLSearchParams(urlSearchParams);
    params.set("cursor", cursor);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setProductTypeFilter("");
    setVendorFilter("");
    setPriceRange([0, 1000]);
    setInStockOnly(false);
    setSearchParams(new URLSearchParams());
  };

  const productRowMarkup = products.map((product, index) => {
    const availability = getProductAvailability(product);
    const isSelected = selectedProducts.includes(product.id);

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        selected={isSelected}
        position={index}
      >
        <IndexTable.Cell>
          <InlineStack gap="300" align="start">
            <Thumbnail
              source={product.featuredImage?.url || ImageIcon}
              alt={product.title}
              size="small"
            />
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight="semibold">
                {product.title}
              </Text>
              <Text variant="bodySm" tone="subdued">
                {product.vendor} • {product.productType}
              </Text>
              {product.tags.length > 0 && (
                <InlineStack gap="100">
                  {product.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} size="small">{tag}</Badge>
                  ))}
                  {product.tags.length > 3 && (
                    <Text variant="bodySm" tone="subdued">+{product.tags.length - 3}</Text>
                  )}
                </InlineStack>
              )}
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight="medium">
              {formatPrice(product.priceRange.min.amount, product.priceRange.min.currencyCode)}
              {product.priceRange.min.amount !== product.priceRange.max.amount && (
                <Text variant="bodySm" tone="subdued"> - {formatPrice(product.priceRange.max.amount, product.priceRange.max.currencyCode)}</Text>
              )}
            </Text>
            <Text variant="bodySm" tone="subdued">
              {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          {getAvailabilityBadge(availability)}
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd">{product.totalInventory}</Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <ButtonGroup>
            <Button
              size="micro"
              variant="primary"
              onClick={() => handleAddProduct(product)}
              disabled={availability.status === 'out-of-stock'}
            >
              Add to Registry
            </Button>
            <Button
              size="micro"
              variant="plain"
              icon={product.onlineStoreUrl ? undefined : InfoIcon}
              url={product.onlineStoreUrl || undefined}
              external={!!product.onlineStoreUrl}
              disabled={!product.onlineStoreUrl}
            >
              View Product
            </Button>
          </ButtonGroup>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title={`Add Products to ${registry.title}`}
      subtitle="Browse your Shopify catalog and add products to this registry"
      backAction={{
        content: 'Back to Registry',
        url: `/admin/registries/${registry.id}`
      }}
      primaryAction={selectedProducts.length > 0 ? {
        content: `Add ${selectedProducts.length} Selected Product${selectedProducts.length !== 1 ? 's' : ''}`,
        onAction: handleBulkAdd,
        loading: isLoading
      } : undefined}
      secondaryActions={[
        {
          content: 'View Registry',
          url: `/admin/registries/${registry.id}`
        }
      ]}
    >
      <BlockStack gap="500">
        {/* Search and Filters */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Product Catalog</Text>
              <Button
                icon={FilterIcon}
                onClick={() => setShowFilters(!showFilters)}
                pressed={showFilters}
              >
                Filters
              </Button>
            </InlineStack>

            <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="300">
              <TextField
                label="Search products"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by title, vendor, or tag..."
                prefix={<Icon source={SearchIcon} />}
                clearButton
                onClearButtonClick={() => setSearchQuery("")}
                autoComplete="off"
              />
              
              <Select
                label="Product type"
                options={[
                  { label: 'All types', value: '' },
                  ...filters.productTypes.map(type => ({ label: type, value: type }))
                ]}
                value={productTypeFilter}
                onChange={setProductTypeFilter}
              />

              <Select
                label="Vendor"
                options={[
                  { label: 'All vendors', value: '' },
                  ...filters.vendors.map(vendor => ({ label: vendor, value: vendor }))
                ]}
                value={vendorFilter}
                onChange={setVendorFilter}
              />
            </InlineGrid>

            <Collapsible
              open={showFilters}
              id="advanced-filters"
              transition={{ duration: '150ms', timingFunction: 'ease' }}
            >
              <Box paddingBlockStart="400">
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <Box>
                    <Text variant="bodyMd" fontWeight="medium">Price Range</Text>
                    <Box paddingBlockStart="200">
                      <RangeSlider
                        label="Price range"
                        value={priceRange}
                        onChange={setPriceRange}
                        output
                        min={0}
                        max={1000}
                        step={10}
                        prefix="$"
                      />
                    </Box>
                  </Box>

                  <Box>
                    <Text variant="bodyMd" fontWeight="medium">Availability</Text>
                    <Box paddingBlockStart="200">
                      <Checkbox
                        label="Show only products in stock"
                        checked={inStockOnly}
                        onChange={setInStockOnly}
                      />
                    </Box>
                  </Box>
                </InlineGrid>

                <Box paddingBlockStart="400">
                  <Button onClick={clearFilters} variant="plain">
                    Clear all filters
                  </Button>
                </Box>
              </Box>
            </Collapsible>
          </BlockStack>
        </Card>

        {/* Results Summary */}
        {(searchQuery || productTypeFilter || vendorFilter || inStockOnly || priceRange[0] > 0 || priceRange[1] < 1000) && (
          <Banner
            title={`Showing ${products.length} products`}
            status="info"
            action={products.length === 0 ? {
              content: 'Clear filters',
              onAction: clearFilters
            } : undefined}
          >
            {products.length === 0 && (
              <Text variant="bodyMd">
                No products match your current filters. Try adjusting your search criteria.
              </Text>
            )}
          </Banner>
        )}

        {/* Products Table */}
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: 'product', plural: 'products' }}
            itemCount={products.length}
            selectedItemsCount={selectedProducts.length}
            onSelectionChange={(type, toggledId) => {
              if (type === 'all') {
                setSelectedProducts(
                  selectedProducts.length === products.length 
                    ? [] 
                    : products.map(p => p.id)
                );
              } else {
                handleProductSelect(toggledId as string);
              }
            }}
            headings={[
              { title: 'Product' },
              { title: 'Price' },
              { title: 'Availability' },
              { title: 'Inventory' },
              { title: 'Actions' }
            ]}
            loading={isLoading}
            emptyState={
              <EmptyState
                heading="No products found"
                action={{
                  content: 'Clear filters',
                  onAction: clearFilters
                }}
                image="/api/placeholder/400/300"
              >
                <Text variant="bodyMd" tone="subdued">
                  {searchQuery || productTypeFilter || vendorFilter 
                    ? "Try adjusting your search or filter criteria."
                    : "Your product catalog appears to be empty."}
                </Text>
              </EmptyState>
            }
          >
            {productRowMarkup}
          </IndexTable>
        </Card>

        {/* Pagination */}
        {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
          <Box paddingBlockStart="400">
            <InlineStack align="center">
              <Pagination
                hasPrevious={pageInfo.hasPreviousPage}
                onPrevious={() => pageInfo.startCursor && handlePagination(pageInfo.startCursor, 'prev')}
                hasNext={pageInfo.hasNextPage}
                onNext={() => pageInfo.endCursor && handlePagination(pageInfo.endCursor, 'next')}
              />
            </InlineStack>
          </Box>
        )}
      </BlockStack>

      {/* Add Product Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`Add ${selectedProduct?.title} to Registry`}
        primaryAction={{
          content: 'Add to Registry',
          onAction: handleSubmitProduct,
          loading: isLoading
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowAddModal(false)
          }
        ]}
      >
        <Modal.Section>
          {selectedProduct && (
            <Form>
              <FormLayout>
                {selectedProduct.variants.length > 1 && (
                  <Select
                    label="Product variant"
                    options={selectedProduct.variants.map(variant => ({
                      label: `${variant.title} - ${formatPrice(variant.price, selectedProduct.priceRange.min.currencyCode)} ${variant.inventoryQuantity > 0 ? `(${variant.inventoryQuantity} available)` : '(Out of stock)'}`,
                      value: variant.id,
                      disabled: !variant.availableForSale || variant.inventoryQuantity === 0
                    }))}
                    value={selectedVariant}
                    onChange={setSelectedVariant}
                  />
                )}

                <TextField
                  label="Quantity"
                  type="number"
                  value={quantity.toString()}
                  onChange={(value) => setQuantity(parseInt(value) || 1)}
                  min={1}
                  max={100}
                  autoComplete="off"
                />

                <Select
                  label="Priority"
                  options={[
                    { label: 'Low', value: 'low' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'High', value: 'high' }
                  ]}
                  value={priority}
                  onChange={setPriority}
                />

                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChange={setNotes}
                  multiline={3}
                  placeholder="Add any special notes about this item..."
                  autoComplete="off"
                />

                <TextField
                  label="Custom price (optional)"
                  type="number"
                  value={customPrice}
                  onChange={setCustomPrice}
                  placeholder="Override default price"
                  prefix="$"
                  helpText="Leave empty to use the product's default price"
                  autoComplete="off"
                />

                <Checkbox
                  label="Allow group gifting for this item"
                  checked={allowGroupGifting}
                  onChange={setAllowGroupGifting}
                  helpText="Multiple people can contribute to purchasing this item"
                />
              </FormLayout>
            </Form>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}