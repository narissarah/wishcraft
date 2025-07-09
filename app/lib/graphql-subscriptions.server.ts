/**
 * GraphQL Subscriptions for Real-Time Updates
 * WebSocket-based real-time communication for collaborative features
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { shopify } from '~/shopify.server';
import { db } from '~/lib/db.server';
import { authenticateWebSocket } from '~/lib/auth.server';

// Event types for real-time updates
export enum SubscriptionEvent {
  REGISTRY_UPDATED = 'REGISTRY_UPDATED',
  ITEM_ADDED = 'ITEM_ADDED',
  ITEM_REMOVED = 'ITEM_REMOVED',
  ITEM_PURCHASED = 'ITEM_PURCHASED',
  CUSTOMER_JOINED = 'CUSTOMER_JOINED',
  CUSTOMER_LEFT = 'CUSTOMER_LEFT',
  ANALYTICS_UPDATED = 'ANALYTICS_UPDATED',
  SHOP_SETTINGS_UPDATED = 'SHOP_SETTINGS_UPDATED',
  INVENTORY_UPDATED = 'INVENTORY_UPDATED',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
}

// Subscription payload interfaces
interface BaseSubscriptionPayload {
  timestamp: string;
  shopId: string;
  eventType: SubscriptionEvent;
}

interface RegistryUpdatedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.REGISTRY_UPDATED;
  registry: {
    id: string;
    title: string;
    status: string;
    itemCount: number;
    totalValue: number;
    lastUpdated: string;
  };
}

interface ItemAddedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.ITEM_ADDED;
  registryId: string;
  item: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    productId: string;
    variantId: string;
    imageUrl?: string;
  };
}

interface ItemRemovedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.ITEM_REMOVED;
  registryId: string;
  itemId: string;
}

interface ItemPurchasedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.ITEM_PURCHASED;
  registryId: string;
  itemId: string;
  quantity: number;
  purchasedBy: string;
  orderId?: string;
}

interface CustomerJoinedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.CUSTOMER_JOINED;
  registryId: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
}

interface CustomerLeftPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.CUSTOMER_LEFT;
  registryId: string;
  customerId: string;
}

interface AnalyticsUpdatedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.ANALYTICS_UPDATED;
  analytics: {
    totalRegistries: number;
    activeRegistries: number;
    totalItems: number;
    totalValue: number;
    conversionRate: number;
    recentActivity: Array<{
      type: string;
      timestamp: string;
      description: string;
    }>;
  };
}

interface ShopSettingsUpdatedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.SHOP_SETTINGS_UPDATED;
  settings: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    enablePasswordProtection: boolean;
    enableGiftMessages: boolean;
    enableSocialSharing: boolean;
    enableGroupGifting: boolean;
    enableAnalytics: boolean;
  };
}

interface InventoryUpdatedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.INVENTORY_UPDATED;
  productId: string;
  variantId: string;
  quantity: number;
  available: boolean;
}

interface OrderCreatedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.ORDER_CREATED;
  order: {
    id: string;
    name: string;
    totalPrice: number;
    lineItems: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      price: number;
    }>;
    customer: {
      id: string;
      name: string;
      email: string;
    };
  };
}

interface OrderUpdatedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.ORDER_UPDATED;
  orderId: string;
  status: string;
  fulfillmentStatus?: string;
  paymentStatus?: string;
}

interface WebhookReceivedPayload extends BaseSubscriptionPayload {
  eventType: SubscriptionEvent.WEBHOOK_RECEIVED;
  webhook: {
    topic: string;
    data: any;
  };
}

type SubscriptionPayload = 
  | RegistryUpdatedPayload
  | ItemAddedPayload
  | ItemRemovedPayload
  | ItemPurchasedPayload
  | CustomerJoinedPayload
  | CustomerLeftPayload
  | AnalyticsUpdatedPayload
  | ShopSettingsUpdatedPayload
  | InventoryUpdatedPayload
  | OrderCreatedPayload
  | OrderUpdatedPayload
  | WebhookReceivedPayload;

// WebSocket connection management
interface WebSocketConnection {
  ws: WebSocket;
  shopId: string;
  userId: string;
  subscriptions: Set<string>;
  lastActivity: Date;
  isAuthenticated: boolean;
}

// Subscription manager class
class SubscriptionManager {
  private eventEmitter: EventEmitter;
  private connections: Map<string, WebSocketConnection>;
  private subscriptionsByShop: Map<string, Set<string>>;
  private subscriptionsByRegistry: Map<string, Set<string>>;
  private heartbeatInterval: NodeJS.Timeout;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.connections = new Map();
    this.subscriptionsByShop = new Map();
    this.subscriptionsByRegistry = new Map();
    
    // Set up heartbeat to clean up stale connections
    this.heartbeatInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000); // Every 30 seconds
  }

  /**
   * Add a new WebSocket connection
   */
  async addConnection(ws: WebSocket, connectionId: string, request: any): Promise<void> {
    try {
      // Authenticate the WebSocket connection
      const auth = await authenticateWebSocket(request);
      
      if (!auth.isAuthenticated) {
        ws.close(1008, 'Authentication required');
        return;
      }

      const connection: WebSocketConnection = {
        ws,
        shopId: auth.shopId,
        userId: auth.userId,
        subscriptions: new Set(),
        lastActivity: new Date(),
        isAuthenticated: true,
      };

      this.connections.set(connectionId, connection);

      // Add to shop subscriptions
      if (!this.subscriptionsByShop.has(auth.shopId)) {
        this.subscriptionsByShop.set(auth.shopId, new Set());
      }
      this.subscriptionsByShop.get(auth.shopId)!.add(connectionId);

      // Set up message handling
      ws.on('message', (data) => {
        this.handleMessage(connectionId, data);
      });

      ws.on('close', () => {
        this.removeConnection(connectionId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeConnection(connectionId);
      });

      // Send welcome message
      this.sendToConnection(connectionId, {
        type: 'connection_established',
        shopId: auth.shopId,
        userId: auth.userId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error adding WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Remove a WebSocket connection
   */
  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from shop subscriptions
    const shopConnections = this.subscriptionsByShop.get(connection.shopId);
    if (shopConnections) {
      shopConnections.delete(connectionId);
      if (shopConnections.size === 0) {
        this.subscriptionsByShop.delete(connection.shopId);
      }
    }

    // Remove from registry subscriptions
    connection.subscriptions.forEach(registryId => {
      const registryConnections = this.subscriptionsByRegistry.get(registryId);
      if (registryConnections) {
        registryConnections.delete(connectionId);
        if (registryConnections.size === 0) {
          this.subscriptionsByRegistry.delete(registryId);
        }
      }
    });

    this.connections.delete(connectionId);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(connectionId: string, data: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(connectionId, message.payload);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, message.payload);
          break;
        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong' });
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(connectionId: string, payload: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { registryId, events } = payload;

    if (registryId) {
      // Subscribe to registry-specific events
      connection.subscriptions.add(registryId);
      
      if (!this.subscriptionsByRegistry.has(registryId)) {
        this.subscriptionsByRegistry.set(registryId, new Set());
      }
      this.subscriptionsByRegistry.get(registryId)!.add(connectionId);
    }

    this.sendToConnection(connectionId, {
      type: 'subscription_confirmed',
      registryId,
      events,
    });
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscribe(connectionId: string, payload: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { registryId } = payload;

    if (registryId) {
      connection.subscriptions.delete(registryId);
      
      const registryConnections = this.subscriptionsByRegistry.get(registryId);
      if (registryConnections) {
        registryConnections.delete(connectionId);
        if (registryConnections.size === 0) {
          this.subscriptionsByRegistry.delete(registryId);
        }
      }
    }

    this.sendToConnection(connectionId, {
      type: 'unsubscription_confirmed',
      registryId,
    });
  }

  /**
   * Send message to a specific connection
   */
  private sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message to connection:', error);
      this.removeConnection(connectionId);
    }
  }

  /**
   * Broadcast to all connections for a shop
   */
  private broadcastToShop(shopId: string, payload: SubscriptionPayload): void {
    const connections = this.subscriptionsByShop.get(shopId);
    if (!connections) return;

    connections.forEach(connectionId => {
      this.sendToConnection(connectionId, {
        type: 'subscription_data',
        payload,
      });
    });
  }

  /**
   * Broadcast to all connections for a registry
   */
  private broadcastToRegistry(registryId: string, payload: SubscriptionPayload): void {
    const connections = this.subscriptionsByRegistry.get(registryId);
    if (!connections) return;

    connections.forEach(connectionId => {
      this.sendToConnection(connectionId, {
        type: 'subscription_data',
        payload,
      });
    });
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const now = new Date();
    const staleTimeout = 5 * 60 * 1000; // 5 minutes

    this.connections.forEach((connection, connectionId) => {
      if (now.getTime() - connection.lastActivity.getTime() > staleTimeout) {
        console.log('Cleaning up stale connection:', connectionId);
        this.removeConnection(connectionId);
      }
    });
  }

  /**
   * Publish events to subscribers
   */
  public publish(payload: SubscriptionPayload): void {
    // Broadcast to all shop connections
    this.broadcastToShop(payload.shopId, payload);

    // If event is registry-specific, also broadcast to registry subscribers
    if ('registryId' in payload && payload.registryId) {
      this.broadcastToRegistry(payload.registryId, payload);
    }

    // Emit event for server-side listeners
    this.eventEmitter.emit(payload.eventType, payload);
  }

  /**
   * Subscribe to events (server-side)
   */
  public subscribe(event: SubscriptionEvent, handler: (payload: SubscriptionPayload) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from events (server-side)
   */
  public unsubscribe(event: SubscriptionEvent, handler: (payload: SubscriptionPayload) => void): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number;
    connectionsByShop: Record<string, number>;
    registrySubscriptions: Record<string, number>;
  } {
    const connectionsByShop: Record<string, number> = {};
    const registrySubscriptions: Record<string, number> = {};

    this.subscriptionsByShop.forEach((connections, shopId) => {
      connectionsByShop[shopId] = connections.size;
    });

    this.subscriptionsByRegistry.forEach((connections, registryId) => {
      registrySubscriptions[registryId] = connections.size;
    });

    return {
      totalConnections: this.connections.size,
      connectionsByShop,
      registrySubscriptions,
    };
  }

  /**
   * Shutdown the subscription manager
   */
  public shutdown(): void {
    clearInterval(this.heartbeatInterval);
    
    this.connections.forEach((connection) => {
      connection.ws.close(1001, 'Server shutting down');
    });
    
    this.connections.clear();
    this.subscriptionsByShop.clear();
    this.subscriptionsByRegistry.clear();
    this.eventEmitter.removeAllListeners();
  }
}

// Create singleton instance
export const subscriptionManager = new SubscriptionManager();

// Helper functions for publishing specific events
export const publishRegistryUpdated = (shopId: string, registry: any): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.REGISTRY_UPDATED,
    registry: {
      id: registry.id,
      title: registry.title,
      status: registry.status,
      itemCount: registry._count?.items || 0,
      totalValue: registry.items?.reduce((sum: number, item: any) => sum + (item.price || 0), 0) || 0,
      lastUpdated: registry.updatedAt.toISOString(),
    },
  });
};

export const publishItemAdded = (shopId: string, registryId: string, item: any): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.ITEM_ADDED,
    registryId,
    item: {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      productId: item.productId,
      variantId: item.variantId,
      imageUrl: item.imageUrl,
    },
  });
};

export const publishItemRemoved = (shopId: string, registryId: string, itemId: string): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.ITEM_REMOVED,
    registryId,
    itemId,
  });
};

export const publishItemPurchased = (
  shopId: string, 
  registryId: string, 
  itemId: string, 
  quantity: number, 
  purchasedBy: string, 
  orderId?: string
): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.ITEM_PURCHASED,
    registryId,
    itemId,
    quantity,
    purchasedBy,
    orderId,
  });
};

export const publishCustomerJoined = (shopId: string, registryId: string, customer: any): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.CUSTOMER_JOINED,
    registryId,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
    },
  });
};

export const publishCustomerLeft = (shopId: string, registryId: string, customerId: string): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.CUSTOMER_LEFT,
    registryId,
    customerId,
  });
};

export const publishAnalyticsUpdated = (shopId: string, analytics: any): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.ANALYTICS_UPDATED,
    analytics,
  });
};

export const publishShopSettingsUpdated = (shopId: string, settings: any): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.SHOP_SETTINGS_UPDATED,
    settings,
  });
};

export const publishInventoryUpdated = (
  shopId: string, 
  productId: string, 
  variantId: string, 
  quantity: number, 
  available: boolean
): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.INVENTORY_UPDATED,
    productId,
    variantId,
    quantity,
    available,
  });
};

export const publishOrderCreated = (shopId: string, order: any): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.ORDER_CREATED,
    order: {
      id: order.id,
      name: order.name,
      totalPrice: order.totalPrice,
      lineItems: order.lineItems.map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        price: item.price,
      })),
      customer: {
        id: order.customer.id,
        name: order.customer.name,
        email: order.customer.email,
      },
    },
  });
};

export const publishOrderUpdated = (
  shopId: string, 
  orderId: string, 
  status: string, 
  fulfillmentStatus?: string, 
  paymentStatus?: string
): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.ORDER_UPDATED,
    orderId,
    status,
    fulfillmentStatus,
    paymentStatus,
  });
};

export const publishWebhookReceived = (shopId: string, webhook: { topic: string; data: any }): void => {
  subscriptionManager.publish({
    timestamp: new Date().toISOString(),
    shopId,
    eventType: SubscriptionEvent.WEBHOOK_RECEIVED,
    webhook,
  });
};

// Export types for use in other modules
export type {
  SubscriptionPayload,
  RegistryUpdatedPayload,
  ItemAddedPayload,
  ItemRemovedPayload,
  ItemPurchasedPayload,
  CustomerJoinedPayload,
  CustomerLeftPayload,
  AnalyticsUpdatedPayload,
  ShopSettingsUpdatedPayload,
  InventoryUpdatedPayload,
  OrderCreatedPayload,
  OrderUpdatedPayload,
  WebhookReceivedPayload,
};

// Default export
export default subscriptionManager;