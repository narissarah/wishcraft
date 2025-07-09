import { LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Button, 
  TextField, 
  Select, 
  Checkbox,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  Banner,
  RadioButton,
  Box,
  Icon
} from "@shopify/polaris";
import { PackageIcon, LocationIcon, CalendarIcon } from '@shopify/polaris-icons';
import { 
  splitOrderByShippingAddress, 
  createMultiAddressOrders,
  coordinateDeliveries,
  sendShippingNotifications,
  type ShippingGroup,
  type ShippingAddress
} from "~/lib/multi-address-shipping.server";
import { getRegistryBySlugWithItems } from "~/lib/registry.server";
import { validateCustomerAccess } from "~/lib/customer-auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  
  if (!slug) {
    throw new Response("Registry not found", { status: 404 });
  }

  try {
    // SECURITY FIX: Use secure slug-based lookup
    const registry = await getRegistryBySlugWithItems(slug);
    
    if (!registry) {
      throw new Response("Registry not found", { status: 404 });
    }
    
    // Check access with proper shop validation
    const { hasAccess, customer } = await validateCustomerAccess(request, registry.id);

    // Get cart items from session or query params
    const url = new URL(request.url);
    const itemIds = url.searchParams.get('items')?.split(',') || [];
    
    const checkoutItems = registry.items.filter(item => 
      itemIds.includes(item.id) && item.status === 'available'
    );

    if (checkoutItems.length === 0) {
      throw new Response("No items to checkout", { status: 400 });
    }

    return json({
      registry,
      checkoutItems,
      customer,
      hasAccess
    });
  } catch (error) {
    throw new Response("Registry not found", { status: 404 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { slug } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "calculate_shipping") {
    try {
      const registryId = formData.get("registryId") as string;
      const itemIds = JSON.parse(formData.get("itemIds") as string);
      const registryOwnerAddress = JSON.parse(formData.get("registryOwnerAddress") as string);
      const buyerAddress = JSON.parse(formData.get("buyerAddress") as string);
      
      // Get items with shipping preferences
      const items = JSON.parse(formData.get("items") as string);
      
      const shippingGroups = await splitOrderByShippingAddress(
        registryId,
        items,
        registryOwnerAddress,
        buyerAddress
      );

      return json({ shippingGroups });
    } catch (error) {
      return json({ 
        error: error instanceof Error ? error.message : "Failed to calculate shipping" 
      }, { status: 400 });
    }
  }

  if (intent === "place_order") {
    try {
      const registryId = formData.get("registryId") as string;
      const shippingGroups = JSON.parse(formData.get("shippingGroups") as string);
      const buyerInfo = JSON.parse(formData.get("buyerInfo") as string);
      const paymentInfo = JSON.parse(formData.get("paymentInfo") as string);
      const coordinationPrefs = JSON.parse(formData.get("coordinationPrefs") as string);

      const { orders, trackingInfo } = await createMultiAddressOrders(
        registryId,
        shippingGroups,
        buyerInfo,
        paymentInfo
      );

      // Coordinate deliveries if requested
      if (coordinationPrefs.synchronizeDelivery) {
        await coordinateDeliveries({ orders, trackingInfo }, coordinationPrefs);
      }

      // Send notifications
      const recipientEmails = shippingGroups
        .map((group: ShippingGroup) => group.address.email)
        .filter(Boolean);
      
      await sendShippingNotifications(registryId, orders, trackingInfo, recipientEmails);

      return json({ 
        success: true, 
        orders,
        trackingInfo,
        message: "Orders placed successfully!" 
      });
    } catch (error) {
      return json({ 
        error: error instanceof Error ? error.message : "Failed to place orders" 
      }, { status: 400 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function CheckoutPage() {
  const { registry, checkoutItems, customer, hasAccess } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();

  const [step, setStep] = useState(1);
  const [shippingGroups, setShippingGroups] = useState<ShippingGroup[]>([]);
  const [buyerAddress, setBuyerAddress] = useState<ShippingAddress>({
    firstName: customer?.firstName || '',
    lastName: customer?.lastName || '',
    address1: '',
    city: '',
    province: '',
    zip: '',
    country: 'US'
  });

  const [coordinationPrefs, setCoordinationPrefs] = useState({
    synchronizeDelivery: false,
    preferredDeliveryDate: null,
    specialInstructions: ''
  });

  // Handle shipping preference changes for items
  const [itemShippingPrefs, setItemShippingPrefs] = useState<Record<string, any>>(
    checkoutItems.reduce((acc, item) => ({
      ...acc,
      [item.id]: {
        shippingPreference: 'recipient',
        giftMessage: '',
        giftWrap: false
      }
    }), {})
  );

  const calculateShipping = async () => {
    const items = checkoutItems.map(item => ({
      ...item,
      ...itemShippingPrefs[item.id],
      requiresShipping: true,
      weight: 1.0 // Default weight
    }));

    fetcher.submit({
      intent: 'calculate_shipping',
      registryId: registry.id,
      itemIds: JSON.stringify(checkoutItems.map(item => item.id)),
      registryOwnerAddress: JSON.stringify({
        firstName: registry.customerFirstName,
        lastName: registry.customerLastName,
        address1: registry.shippingAddress?.address1 || '',
        city: registry.shippingAddress?.city || '',
        province: registry.shippingAddress?.province || '',
        zip: registry.shippingAddress?.zip || '',
        country: registry.shippingAddress?.country || 'US',
        email: registry.customerEmail
      }),
      buyerAddress: JSON.stringify(buyerAddress),
      items: JSON.stringify(items)
    }, { method: 'post' });
  };

  const totalAmount = checkoutItems.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const totalShipping = shippingGroups.reduce((sum, group) => 
    sum + (group.selectedShippingRate?.price || 0), 0
  );

  if (!hasAccess) {
    return (
      <Page title="Access Denied">
        <Layout>
          <Layout.Section>
            <Card>
              <Text>You don't have access to purchase from this registry.</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page 
      title="Checkout"
      subtitle={`${checkoutItems.length} item${checkoutItems.length !== 1 ? 's' : ''} from ${registry.title}`}
      backAction={{
        content: 'Back to Registry',
        url: `/registry/${registry.slug}`
      }}
    >
      <Layout>
        <Layout.Section variant="oneThird">
          {/* Progress Steps */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Checkout Steps</Text>
              
              <BlockStack gap="200">
                <InlineStack gap="300" blockAlign="center">
                  <Badge tone={step >= 1 ? "success" : "subdued"}>1</Badge>
                  <Text variant="bodyMd" tone={step >= 1 ? undefined : "subdued"}>
                    Shipping Preferences
                  </Text>
                </InlineStack>
                
                <InlineStack gap="300" blockAlign="center">
                  <Badge tone={step >= 2 ? "success" : "subdued"}>2</Badge>
                  <Text variant="bodyMd" tone={step >= 2 ? undefined : "subdued"}>
                    Review Shipping
                  </Text>
                </InlineStack>
                
                <InlineStack gap="300" blockAlign="center">
                  <Badge tone={step >= 3 ? "success" : "subdued"}>3</Badge>
                  <Text variant="bodyMd" tone={step >= 3 ? undefined : "subdued"}>
                    Payment
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          {/* Order Summary */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Order Summary</Text>
              
              <BlockStack gap="200">
                {checkoutItems.map(item => (
                  <InlineStack key={item.id} align="space-between">
                    <BlockStack gap="100">
                      <Text variant="bodyMd">{item.productTitle}</Text>
                      {item.productVariantTitle && (
                        <Text variant="bodySm" tone="subdued">
                          {item.productVariantTitle}
                        </Text>
                      )}
                    </BlockStack>
                    <Text variant="bodyMd">${item.price.toFixed(2)}</Text>
                  </InlineStack>
                ))}
                
                <Divider />
                
                <InlineStack align="space-between">
                  <Text variant="bodyMd">Subtotal</Text>
                  <Text variant="bodyMd">${totalAmount.toFixed(2)}</Text>
                </InlineStack>
                
                {totalShipping > 0 && (
                  <InlineStack align="space-between">
                    <Text variant="bodyMd">Shipping</Text>
                    <Text variant="bodyMd">${totalShipping.toFixed(2)}</Text>
                  </InlineStack>
                )}
                
                <Divider />
                
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h3">Total</Text>
                  <Text variant="headingMd" as="h3">
                    ${(totalAmount + totalShipping).toFixed(2)}
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="twoThirds">
          {step === 1 && (
            <Card>
              <BlockStack gap="500">
                <Text variant="headingLg" as="h2">Shipping Preferences</Text>
                
                {actionData?.error && (
                  <Banner tone="critical">
                    <Text>{actionData.error}</Text>
                  </Banner>
                )}

                {/* Buyer Address */}
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Your Address</Text>
                  
                  <InlineStack gap="400">
                    <TextField
                      label="First Name"
                      value={buyerAddress.firstName}
                      onChange={(value) => setBuyerAddress({...buyerAddress, firstName: value})}
                      autoComplete="given-name"
                    />
                    <TextField
                      label="Last Name"
                      value={buyerAddress.lastName}
                      onChange={(value) => setBuyerAddress({...buyerAddress, lastName: value})}
                      autoComplete="family-name"
                    />
                  </InlineStack>
                  
                  <TextField
                    label="Address"
                    value={buyerAddress.address1}
                    onChange={(value) => setBuyerAddress({...buyerAddress, address1: value})}
                    autoComplete="address-line1"
                  />
                  
                  <InlineStack gap="400">
                    <TextField
                      label="City"
                      value={buyerAddress.city}
                      onChange={(value) => setBuyerAddress({...buyerAddress, city: value})}
                      autoComplete="address-level2"
                    />
                    <TextField
                      label="State/Province"
                      value={buyerAddress.province}
                      onChange={(value) => setBuyerAddress({...buyerAddress, province: value})}
                      autoComplete="address-level1"
                    />
                    <TextField
                      label="ZIP/Postal Code"
                      value={buyerAddress.zip}
                      onChange={(value) => setBuyerAddress({...buyerAddress, zip: value})}
                      autoComplete="postal-code"
                    />
                  </InlineStack>
                </BlockStack>

                <Divider />

                {/* Item Shipping Preferences */}
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Where should each item be shipped?</Text>
                  
                  {checkoutItems.map(item => (
                    <Card key={item.id}>
                      <BlockStack gap="300">
                        <InlineStack gap="300" blockAlign="center">
                          <Icon source={PackageIcon} />
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="medium">
                              {item.productTitle}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              ${item.price.toFixed(2)}
                            </Text>
                          </BlockStack>
                        </InlineStack>
                        
                        <BlockStack gap="200">
                          <Text variant="bodyMd" fontWeight="medium">Ship to:</Text>
                          
                          <RadioButton
                            label={`Registry owner (${registry.customerFirstName} ${registry.customerLastName})`}
                            checked={itemShippingPrefs[item.id].shippingPreference === 'recipient'}
                            id={`${item.id}-recipient`}
                            name={`${item.id}-shipping`}
                            onChange={() => setItemShippingPrefs({
                              ...itemShippingPrefs,
                              [item.id]: { ...itemShippingPrefs[item.id], shippingPreference: 'recipient' }
                            })}
                          />
                          
                          <RadioButton
                            label="Me (gift giver)"
                            checked={itemShippingPrefs[item.id].shippingPreference === 'giver'}
                            id={`${item.id}-giver`}
                            name={`${item.id}-shipping`}
                            onChange={() => setItemShippingPrefs({
                              ...itemShippingPrefs,
                              [item.id]: { ...itemShippingPrefs[item.id], shippingPreference: 'giver' }
                            })}
                          />
                          
                          <RadioButton
                            label="Custom address"
                            checked={itemShippingPrefs[item.id].shippingPreference === 'custom'}
                            id={`${item.id}-custom`}
                            name={`${item.id}-shipping`}
                            onChange={() => setItemShippingPrefs({
                              ...itemShippingPrefs,
                              [item.id]: { ...itemShippingPrefs[item.id], shippingPreference: 'custom' }
                            })}
                          />
                        </BlockStack>

                        <TextField
                          label="Gift Message (Optional)"
                          value={itemShippingPrefs[item.id].giftMessage}
                          onChange={(value) => setItemShippingPrefs({
                            ...itemShippingPrefs,
                            [item.id]: { ...itemShippingPrefs[item.id], giftMessage: value }
                          })}
                          multiline={2}
                          placeholder="Add a personal message for this gift..."
                        />

                        <Checkbox
                          label="Gift wrap this item (+$4.99)"
                          checked={itemShippingPrefs[item.id].giftWrap}
                          onChange={(checked) => setItemShippingPrefs({
                            ...itemShippingPrefs,
                            [item.id]: { ...itemShippingPrefs[item.id], giftWrap: checked }
                          })}
                        />
                      </BlockStack>
                    </Card>
                  ))}
                </BlockStack>

                <Button 
                  variant="primary" 
                  size="large"
                  onClick={() => {
                    calculateShipping();
                    setStep(2);
                  }}
                  loading={fetcher.state === "submitting"}
                >
                  Calculate Shipping
                </Button>
              </BlockStack>
            </Card>
          )}

          {step === 2 && fetcher.data?.shippingGroups && (
            <Card>
              <BlockStack gap="500">
                <Text variant="headingLg" as="h2">Review Shipping Groups</Text>
                
                <Text variant="bodyMd" tone="subdued">
                  Your order has been split into {fetcher.data.shippingGroups.length} shipment{fetcher.data.shippingGroups.length !== 1 ? 's' : ''} based on shipping addresses.
                </Text>

                {fetcher.data.shippingGroups.map((group: ShippingGroup, index: number) => (
                  <Card key={group.id}>
                    <BlockStack gap="400">
                      <InlineStack gap="300" blockAlign="center">
                        <Icon source={LocationIcon} />
                        <Text variant="headingMd" as="h3">
                          Shipment {index + 1}
                        </Text>
                      </InlineStack>
                      
                      {/* Shipping Address */}
                      <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                        <BlockStack gap="200">
                          <Text variant="bodyMd" fontWeight="medium">Shipping to:</Text>
                          <Text variant="bodyMd">
                            {group.address.firstName} {group.address.lastName}
                          </Text>
                          <Text variant="bodyMd">
                            {group.address.address1}
                            {group.address.address2 && `, ${group.address.address2}`}
                          </Text>
                          <Text variant="bodyMd">
                            {group.address.city}, {group.address.province} {group.address.zip}
                          </Text>
                        </BlockStack>
                      </Box>
                      
                      {/* Items in this shipment */}
                      <BlockStack gap="200">
                        <Text variant="bodyMd" fontWeight="medium">Items:</Text>
                        {group.items.map(item => (
                          <InlineStack key={item.id} align="space-between">
                            <Text variant="bodyMd">{item.productTitle}</Text>
                            <Text variant="bodyMd">${item.price.toFixed(2)}</Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                      
                      {/* Shipping options */}
                      <BlockStack gap="200">
                        <Text variant="bodyMd" fontWeight="medium">Shipping Method:</Text>
                        {group.shippingRates.map(rate => (
                          <RadioButton
                            key={rate.id}
                            label={`${rate.title} - $${rate.price.toFixed(2)} ${rate.estimatedDelivery ? `(Arrives ${rate.estimatedDelivery.toLocaleDateString()})` : ''}`}
                            checked={group.selectedShippingRate?.id === rate.id}
                            id={`${group.id}-${rate.id}`}
                            name={`${group.id}-shipping-rate`}
                            onChange={() => {
                              // Update selected shipping rate
                              const updatedGroups = fetcher.data.shippingGroups.map((g: ShippingGroup) =>
                                g.id === group.id ? { ...g, selectedShippingRate: rate } : g
                              );
                              setShippingGroups(updatedGroups);
                            }}
                          />
                        ))}
                      </BlockStack>
                    </BlockStack>
                  </Card>
                ))}

                {/* Delivery Coordination */}
                <Card>
                  <BlockStack gap="400">
                    <InlineStack gap="300" blockAlign="center">
                      <Icon source={CalendarIcon} />
                      <Text variant="headingMd" as="h3">Delivery Coordination</Text>
                    </InlineStack>
                    
                    <Checkbox
                      label="Synchronize all deliveries to arrive on the same day"
                      checked={coordinationPrefs.synchronizeDelivery}
                      onChange={(checked) => setCoordinationPrefs({
                        ...coordinationPrefs,
                        synchronizeDelivery: checked
                      })}
                      helpText="This may delay some shipments to coordinate arrival times"
                    />
                    
                    <TextField
                      label="Special Delivery Instructions"
                      value={coordinationPrefs.specialInstructions}
                      onChange={(value) => setCoordinationPrefs({
                        ...coordinationPrefs,
                        specialInstructions: value
                      })}
                      multiline={2}
                      placeholder="Any special instructions for delivery coordination..."
                    />
                  </BlockStack>
                </Card>

                <InlineStack gap="300">
                  <Button onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => setStep(3)}
                  >
                    Continue to Payment
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Payment</Text>
                
                <Banner tone="info">
                  <Text>
                    In a production environment, this would integrate with Shopify's checkout system
                    or a payment processor like Stripe for secure payment processing.
                  </Text>
                </Banner>

                <InlineStack gap="300">
                  <Button onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button variant="primary" size="large">
                    Complete Purchase - ${(totalAmount + totalShipping).toFixed(2)}
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}