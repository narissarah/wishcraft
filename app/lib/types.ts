export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  status: string;
  images: {
    edges: Array<{
      node: {
        id: string;
        url: string;
        altText: string;
      };
    }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: string;
        compareAtPrice?: string;
        availableForSale: boolean;
        inventoryQuantity: number;
        sku: string;
        selectedOptions?: Array<{
          name: string;
          value: string;
        }>;
      };
    }>;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  state: string;
  addresses?: Array<{
    id: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    firstName: string;
    lastName: string;
    company?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  email: string;
  totalPrice: string;
  subtotalPrice: string;
  totalTax: string;
  currencyCode: string;
  fulfillmentStatus: string;
  financialStatus: string;
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        quantity: number;
        price: string;
        product: {
          id: string;
          handle: string;
        };
        variant: {
          id: string;
          title: string;
        };
      };
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Registry {
  id: string;
  title: string;
  description?: string;
  eventDate?: string;
  eventType: string;
  isPublic: boolean;
  slug: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  shop: string;
  requiresPassword: boolean;
  password?: string;
  items: RegistryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RegistryItem {
  id: string;
  registryId: string;
  productId: string;
  variantId?: string;
  productTitle: string;
  variantTitle?: string;
  productHandle: string;
  productImage?: string;
  quantity: number;
  purchased: number;
  priority: "high" | "medium" | "low";
  notes?: string;
  price: number;
  compareAtPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  registryItemId: string;
  orderId: string;
  lineItemId: string;
  quantity: number;
  price: number;
  purchaserName?: string;
  purchaserEmail?: string;
  giftMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: string;
  shop: string;
  enableEmailNotifications: boolean;
  fromEmail?: string;
  primaryColor: string;
  accentColor: string;
  enablePasswordProtection: boolean;
  enableGiftMessages: boolean;
  enableSocialSharing: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: Array<string | number>;
  extensions?: {
    code?: string;
    [key: string]: string | number | boolean | null | undefined;
  };
}

export interface PaginationInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface EdgeNode<T> {
  node: T;
  cursor: string;
}

export interface CustomerSession {
  customerId: string;
  accessToken: string;
  shop: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface GraphQLVariables {
  [key: string]: string | number | boolean | null | GraphQLVariables | Array<string | number | boolean | null>;
}

export interface RegistryWithPII {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  eventType: string;
  eventDate: Date | null;
  visibility: string;
  shopId: string;
  customerId: string | null;
  accessCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  registry_collaborators?: Array<{
    id: string;
    email: string | null;
    name?: string | null;
    role?: string | null;
    status?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
}

export interface Connection<T> {
  edges: EdgeNode<T>[];
  pageInfo: PaginationInfo;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}