import { db } from "~/lib/db.server";
import { createShopifyAPI } from "~/lib/shopify-api.server";
import { sendEmail } from "~/lib/email.server";

// ============================================================================
// MULTI-ADDRESS SHIPPING TYPES
// ============================================================================

export interface ShippingAddress {
  id?: string;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShippingGroup {
  id: string;
  address: ShippingAddress;
  items: RegistryItemWithShipping[];
  totalWeight: number;
  totalValue: number;
  shippingRates: ShippingRate[];
  selectedShippingRate?: ShippingRate;
  deliveryInstructions?: string;
  giftMessage?: string;
  estimatedDelivery?: Date;
}

export interface RegistryItemWithShipping {
  id: string;
  productId: string;
  productVariantId: string;
  productTitle: string;
  productVariantTitle?: string;
  quantity: number;
  price: number;
  weight?: number;
  requiresShipping: boolean;
  shippingPreference: 'recipient' | 'giver' | 'custom';
  customShippingAddress?: ShippingAddress;
  deliveryDate?: Date;
  giftWrap?: boolean;
  giftMessage?: string;
}

export interface ShippingRate {
  id: string;
  title: string;
  price: number;
  deliveryDays?: number;
  carrier?: string;
  method?: string;
  estimatedDelivery?: Date;
}

// ============================================================================
// ORDER SPLITTING LOGIC
// ============================================================================

export async function splitOrderByShippingAddress(
  registryId: string,
  items: RegistryItemWithShipping[],
  registryOwnerAddress: ShippingAddress,
  buyerAddress: ShippingAddress
): Promise<ShippingGroup[]> {
  try {
    // Group items by shipping address
    const addressGroups = new Map<string, RegistryItemWithShipping[]>();

    for (const item of items) {
      let targetAddress: ShippingAddress;
      let addressKey: string;

      switch (item.shippingPreference) {
        case 'recipient':
          targetAddress = registryOwnerAddress;
          addressKey = 'recipient';
          break;
        case 'giver':
          targetAddress = buyerAddress;
          addressKey = 'giver';
          break;
        case 'custom':
          if (!item.customShippingAddress) {
            throw new Error(`Custom shipping address required for item ${item.id}`);
          }
          targetAddress = item.customShippingAddress;
          addressKey = `custom_${item.id}`;
          break;
        default:
          targetAddress = registryOwnerAddress;
          addressKey = 'recipient';
      }

      // Create unique key for identical addresses
      const fullAddressKey = `${addressKey}_${JSON.stringify(targetAddress)}`;
      
      if (!addressGroups.has(fullAddressKey)) {
        addressGroups.set(fullAddressKey, []);
      }
      
      addressGroups.get(fullAddressKey)!.push({
        ...item,
        customShippingAddress: targetAddress
      });
    }

    // Create shipping groups with rates
    const shippingGroups: ShippingGroup[] = [];
    let groupIndex = 0;

    for (const [addressKey, groupItems] of addressGroups) {
      const address = groupItems[0].customShippingAddress!;
      
      // Calculate totals
      const totalWeight = groupItems.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
      const totalValue = groupItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Get shipping rates for this group
      const shippingRates = await getShippingRatesForGroup(address, groupItems, totalWeight);

      shippingGroups.push({
        id: `group_${groupIndex++}`,
        address,
        items: groupItems,
        totalWeight,
        totalValue,
        shippingRates,
        selectedShippingRate: shippingRates[0] // Default to first option
      });
    }

    return shippingGroups;
  } catch (error) {
    console.error('Failed to split order by shipping address:', error);
    throw new Error('Failed to process shipping groups');
  }
}

// ============================================================================
// SHOPIFY SHIPPING INTEGRATION
// ============================================================================

export async function getShippingRatesForGroup(
  address: ShippingAddress,
  items: RegistryItemWithShipping[],
  totalWeight: number
): Promise<ShippingRate[]> {
  try {
    // Prepare line items for Shopify shipping calculation
    const lineItems = items.map(item => ({
      variant_id: item.productVariantId,
      quantity: item.quantity,
      grams: (item.weight || 0) * 1000, // Convert to grams
      price: item.price.toFixed(2),
      requires_shipping: item.requiresShipping
    }));

    // Use Shopify's shipping calculation API
    const query = `#graphql
      query GetShippingRates($input: DeliveryProfileLocationGroupInput!) {
        deliveryProfiles(first: 10) {
          edges {
            node {
              id
              name
              locationGroups(first: 10) {
                edges {
                  node {
                    id
                    locations(first: 10) {
                      edges {
                        node {
                          id
                        }
                      }
                    }
                    countries {
                      code
                      provinces {
                        code
                      }
                    }
                    zones(first: 10) {
                      edges {
                        node {
                          id
                          name
                          methodDefinitions(first: 10) {
                            edges {
                              node {
                                id
                                name
                                rateDefinition {
                                  price {
                                    amount
                                    currencyCode
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await shopifyApi.request(query);
    
    // Process shipping rates from Shopify response
    const shippingRates: ShippingRate[] = [];
    
    if (response.data?.deliveryProfiles?.edges) {
      for (const profileEdge of response.data.deliveryProfiles.edges) {
        const profile = profileEdge.node;
        
        for (const locationGroupEdge of profile.locationGroups.edges) {
          const locationGroup = locationGroupEdge.node;
          
          // Check if this location group covers the destination
          const isValidDestination = locationGroup.countries.some((country: any) => 
            country.code === address.country &&
            (!country.provinces.length || country.provinces.some((province: any) => 
              province.code === address.province
            ))
          );

          if (isValidDestination) {
            for (const zoneEdge of locationGroup.zones.edges) {
              const zone = zoneEdge.node;
              
              for (const methodEdge of zone.methodDefinitions.edges) {
                const method = methodEdge.node;
                
                shippingRates.push({
                  id: method.id,
                  title: `${method.name} (${zone.name})`,
                  price: parseFloat(method.rateDefinition.price.amount),
                  carrier: zone.name,
                  method: method.name,
                  estimatedDelivery: calculateEstimatedDelivery(method.name)
                });
              }
            }
          }
        }
      }
    }

    // If no rates found, provide fallback options
    if (shippingRates.length === 0) {
      shippingRates.push(
        {
          id: 'standard',
          title: 'Standard Shipping',
          price: 9.99,
          deliveryDays: 5,
          estimatedDelivery: calculateEstimatedDelivery('Standard')
        },
        {
          id: 'expedited',
          title: 'Expedited Shipping',
          price: 19.99,
          deliveryDays: 2,
          estimatedDelivery: calculateEstimatedDelivery('Expedited')
        }
      );
    }

    return shippingRates.sort((a, b) => a.price - b.price);
  } catch (error) {
    console.error('Failed to get shipping rates:', error);
    
    // Return fallback rates on error
    return [
      {
        id: 'standard',
        title: 'Standard Shipping',
        price: 9.99,
        deliveryDays: 5,
        estimatedDelivery: calculateEstimatedDelivery('Standard')
      }
    ];
  }
}

function calculateEstimatedDelivery(methodName: string): Date {
  const now = new Date();
  let daysToAdd = 5; // Default

  if (methodName.toLowerCase().includes('expedited') || methodName.toLowerCase().includes('express')) {
    daysToAdd = 2;
  } else if (methodName.toLowerCase().includes('overnight') || methodName.toLowerCase().includes('next day')) {
    daysToAdd = 1;
  } else if (methodName.toLowerCase().includes('ground') || methodName.toLowerCase().includes('standard')) {
    daysToAdd = 5;
  }

  // Skip weekends for delivery calculation
  let deliveryDate = new Date(now);
  let daysAdded = 0;
  
  while (daysAdded < daysToAdd) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (deliveryDate.getDay() !== 0 && deliveryDate.getDay() !== 6) {
      daysAdded++;
    }
  }

  return deliveryDate;
}

// ============================================================================
// ORDER CREATION WITH MULTIPLE ADDRESSES
// ============================================================================

export async function createMultiAddressOrders(
  registryId: string,
  shippingGroups: ShippingGroup[],
  buyerInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  },
  paymentInfo: {
    totalAmount: number;
    currency: string;
    paymentMethod: string;
  }
): Promise<{ orders: any[]; trackingInfo: any[] }> {
  try {
    const orders = [];
    const trackingInfo = [];

    for (let i = 0; i < shippingGroups.length; i++) {
      const group = shippingGroups[i];
      
      // Create individual order for each shipping group
      const orderData = {
        email: buyerInfo.email,
        lineItems: group.items.map(item => ({
          variantId: item.productVariantId,
          quantity: item.quantity,
          customAttributes: [
            {
              key: 'registry_id',
              value: registryId
            },
            {
              key: 'shipping_group',
              value: group.id
            },
            {
              key: 'gift_message',
              value: item.giftMessage || ''
            }
          ]
        })),
        shippingAddress: {
          firstName: group.address.firstName,
          lastName: group.address.lastName,
          company: group.address.company,
          address1: group.address.address1,
          address2: group.address.address2,
          city: group.address.city,
          province: group.address.province,
          zip: group.address.zip,
          country: group.address.country,
          phone: group.address.phone
        },
        billingAddress: {
          firstName: buyerInfo.firstName,
          lastName: buyerInfo.lastName,
          address1: group.address.address1, // Use shipping address for now
          city: group.address.city,
          province: group.address.province,
          zip: group.address.zip,
          country: group.address.country
        },
        shippingLine: group.selectedShippingRate ? {
          title: group.selectedShippingRate.title,
          price: group.selectedShippingRate.price.toFixed(2),
          code: group.selectedShippingRate.id
        } : undefined,
        note: `Multi-address order ${i + 1} of ${shippingGroups.length}. ${group.deliveryInstructions || ''}`,
        tags: ['wishcraft', 'multi-address', `group-${i + 1}`],
        metafields: [
          {
            namespace: 'wishcraft',
            key: 'shipping_group_id',
            value: group.id,
            type: 'single_line_text_field'
          },
          {
            namespace: 'wishcraft',
            key: 'multi_address_order',
            value: 'true',
            type: 'boolean'
          }
        ]
      };

      const order = await createShopifyOrder(orderData);
      orders.push(order);

      // Store tracking information
      const tracking = {
        orderId: order.id,
        orderNumber: order.name,
        shippingAddress: group.address,
        items: group.items,
        estimatedDelivery: group.estimatedDelivery,
        trackingNumber: null, // Will be updated when fulfilled
        status: 'pending'
      };

      trackingInfo.push(tracking);

      // Log order creation
      await db.registryActivity.create({
        data: {
          registryId: registryId,
          type: 'multi_address_order_created',
          description: `Order ${order.name} created for ${group.address.firstName} ${group.address.lastName}`,
          actorType: 'buyer',
          actorEmail: buyerInfo.email,
          actorName: `${buyerInfo.firstName} ${buyerInfo.lastName}`,
          metadata: {
            orderId: order.id,
            shippingGroupId: group.id,
            itemCount: group.items.length
          }
        }
      });
    }

    return { orders, trackingInfo };
  } catch (error) {
    console.error('Failed to create multi-address orders:', error);
    throw new Error('Failed to create orders');
  }
}

async function createShopifyOrder(orderData: any) {
  const mutation = `#graphql
    mutation CreateOrder($order: OrderInput!) {
      orderCreate(order: $order) {
        order {
          id
          name
          totalPrice {
            amount
            currencyCode
          }
          customer {
            id
            email
          }
          shippingAddress {
            firstName
            lastName
            address1
            city
            province
            zip
            country
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variant {
                  id
                  product {
                    id
                    title
                  }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await shopifyApi.request(mutation, {
    variables: { order: orderData }
  });

  if (response.data.orderCreate.userErrors.length > 0) {
    throw new Error(`Order creation failed: ${response.data.orderCreate.userErrors[0].message}`);
  }

  return response.data.orderCreate.order;
}

// ============================================================================
// DELIVERY COORDINATION
// ============================================================================

export async function coordinateDeliveries(
  ordersInfo: { orders: any[]; trackingInfo: any[] },
  coordinationPreferences: {
    synchronizeDelivery?: boolean;
    preferredDeliveryDate?: Date;
    deliveryWindow?: string;
    specialInstructions?: string;
  }
) {
  try {
    if (coordinationPreferences.synchronizeDelivery) {
      // Find the latest estimated delivery among all orders
      const latestDelivery = ordersInfo.trackingInfo.reduce((latest, tracking) => {
        const deliveryDate = new Date(tracking.estimatedDelivery);
        return deliveryDate > latest ? deliveryDate : latest;
      }, new Date());

      // Attempt to coordinate all deliveries to the same date
      for (const tracking of ordersInfo.trackingInfo) {
        await updateDeliveryInstructions(tracking.orderId, {
          requestedDeliveryDate: latestDelivery,
          instructions: `Coordinate delivery with other orders. ${coordinationPreferences.specialInstructions || ''}`
        });
      }
    }

    // Send coordination notifications
    await sendDeliveryCoordinationNotifications(ordersInfo, coordinationPreferences);

    return true;
  } catch (error) {
    console.error('Failed to coordinate deliveries:', error);
    throw new Error('Failed to coordinate deliveries');
  }
}

async function updateDeliveryInstructions(orderId: string, instructions: any) {
  // This would typically involve updating the order notes or metafields
  const mutation = `#graphql
    mutation UpdateOrder($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          note
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  await shopifyApi.request(mutation, {
    variables: {
      input: {
        id: orderId,
        note: `Delivery coordination: ${JSON.stringify(instructions)}`
      }
    }
  });
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

export async function sendShippingNotifications(
  registryId: string,
  orders: any[],
  trackingInfo: any[],
  recipientEmails: string[]
) {
  try {
    // Get registry details
    const registry = await db.registry.findUnique({
      where: { id: registryId },
      include: {
        customer: true
      }
    });

    if (!registry) {
      throw new Error('Registry not found');
    }

    // Notify registry owner about multiple shipments
    await sendEmail({
      to: registry.customerEmail,
      subject: 'Your gifts are on the way!',
      template: 'multi-address-shipping-notification',
      data: {
        registryTitle: registry.title,
        orderCount: orders.length,
        orders: trackingInfo.map(tracking => ({
          orderNumber: tracking.orderNumber,
          shippingAddress: tracking.shippingAddress,
          itemCount: tracking.items.length,
          estimatedDelivery: tracking.estimatedDelivery
        }))
      }
    });

    // Notify each recipient about their specific shipment
    for (const tracking of trackingInfo) {
      if (tracking.shippingAddress.email) {
        await sendEmail({
          to: tracking.shippingAddress.email,
          subject: 'Gift delivery notification',
          template: 'individual-shipment-notification',
          data: {
            recipientName: `${tracking.shippingAddress.firstName} ${tracking.shippingAddress.lastName}`,
            orderNumber: tracking.orderNumber,
            items: tracking.items,
            estimatedDelivery: tracking.estimatedDelivery,
            registryTitle: registry.title,
            registryOwner: registry.customerFirstName
          }
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to send shipping notifications:', error);
    throw new Error('Failed to send notifications');
  }
}

async function sendDeliveryCoordinationNotifications(
  ordersInfo: { orders: any[]; trackingInfo: any[] },
  preferences: any
) {
  // Send coordination details to all parties
  for (const tracking of ordersInfo.trackingInfo) {
    if (tracking.shippingAddress.email) {
      await sendEmail({
        to: tracking.shippingAddress.email,
        subject: 'Delivery coordination information',
        template: 'delivery-coordination',
        data: {
          orderNumber: tracking.orderNumber,
          coordinatedDelivery: preferences.synchronizeDelivery,
          estimatedDelivery: tracking.estimatedDelivery,
          specialInstructions: preferences.specialInstructions
        }
      });
    }
  }
}