/**
 * Client-side GraphQL Subscriptions Hook
 * WebSocket-based real-time updates for React components
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { SubscriptionEvent, type SubscriptionPayload } from '~/lib/graphql-subscriptions.server';

// WebSocket connection states
enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

// Subscription configuration
interface SubscriptionConfig {
  registryId?: string;
  events?: SubscriptionEvent[];
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

// Subscription hook return type
interface UseSubscriptionReturn {
  connectionState: ConnectionState;
  isConnected: boolean;
  lastMessage: SubscriptionPayload | null;
  error: string | null;
  subscribe: (config: SubscriptionConfig) => void;
  unsubscribe: (registryId?: string) => void;
  sendMessage: (message: any) => void;
  reconnect: () => void;
}

// Message types for WebSocket communication
interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  payload?: any;
}

interface WebSocketResponse {
  type: 'connection_established' | 'subscription_confirmed' | 'unsubscription_confirmed' | 'subscription_data' | 'pong';
  payload?: SubscriptionPayload;
  registryId?: string;
  events?: SubscriptionEvent[];
  shopId?: string;
  userId?: string;
  timestamp?: string;
}

/**
 * Hook for managing WebSocket subscriptions
 */
export function useSubscriptions(): UseSubscriptionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState<SubscriptionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = useRef(5);
  const reconnectDelay = useRef(1000);
  const autoReconnect = useRef(true);
  const subscriptions = useRef<Map<string, SubscriptionConfig>>(new Map());

  // WebSocket URL - adjust based on your environment
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }, []);

  // Send message to WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Handle WebSocket connection
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionState(ConnectionState.CONNECTING);
    setError(null);

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState(ConnectionState.CONNECTED);
        reconnectAttempts.current = 0;
        
        // Start ping/pong heartbeat
        pingIntervalRef.current = setInterval(() => {
          sendMessage({ type: 'ping' });
        }, 30000); // Every 30 seconds
        
        // Resubscribe to existing subscriptions
        subscriptions.current.forEach((config, key) => {
          sendMessage({
            type: 'subscribe',
            payload: config,
          });
        });
      };

      ws.onmessage = (event) => {
        try {
          const response: WebSocketResponse = JSON.parse(event.data);
          
          switch (response.type) {
            case 'connection_established':
              console.log('WebSocket connection established');
              break;
              
            case 'subscription_confirmed':
              console.log('Subscription confirmed for:', response.registryId);
              break;
              
            case 'unsubscription_confirmed':
              console.log('Unsubscription confirmed for:', response.registryId);
              break;
              
            case 'subscription_data':
              if (response.payload) {
                setLastMessage(response.payload);
              }
              break;
              
            case 'pong':
              // Heartbeat response
              break;
              
            default:
              console.warn('Unknown message type:', response.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        setConnectionState(ConnectionState.DISCONNECTED);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Attempt reconnection if enabled
        if (autoReconnect.current && reconnectAttempts.current < maxReconnectAttempts.current) {
          setConnectionState(ConnectionState.RECONNECTING);
          reconnectAttempts.current++;
          
          const delay = reconnectDelay.current * Math.pow(2, reconnectAttempts.current - 1);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setConnectionState(ConnectionState.ERROR);
      };

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
      setConnectionState(ConnectionState.ERROR);
    }
  }, [getWebSocketUrl, sendMessage]);

  // Subscribe to events
  const subscribe = useCallback((config: SubscriptionConfig) => {
    const key = config.registryId || 'global';
    subscriptions.current.set(key, config);
    
    if (connectionState === ConnectionState.CONNECTED) {
      sendMessage({
        type: 'subscribe',
        payload: config,
      });
    }
  }, [connectionState, sendMessage]);

  // Unsubscribe from events
  const unsubscribe = useCallback((registryId?: string) => {
    const key = registryId || 'global';
    subscriptions.current.delete(key);
    
    if (connectionState === ConnectionState.CONNECTED) {
      sendMessage({
        type: 'unsubscribe',
        payload: { registryId },
      });
    }
  }, [connectionState, sendMessage]);

  // Reconnect manually
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  // Initialize connection on mount
  useEffect(() => {
    connect();
    
    return () => {
      autoReconnect.current = false;
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connect]);

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    lastMessage,
    error,
    subscribe,
    unsubscribe,
    sendMessage,
    reconnect,
  };
}

/**
 * Hook for registry-specific subscriptions
 */
export function useRegistrySubscription(registryId: string) {
  const { isConnected, lastMessage, subscribe, unsubscribe } = useSubscriptions();
  const [registryData, setRegistryData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  // Subscribe to registry events
  useEffect(() => {
    if (isConnected && registryId) {
      subscribe({
        registryId,
        events: [
          SubscriptionEvent.REGISTRY_UPDATED,
          SubscriptionEvent.ITEM_ADDED,
          SubscriptionEvent.ITEM_REMOVED,
          SubscriptionEvent.ITEM_PURCHASED,
          SubscriptionEvent.CUSTOMER_JOINED,
          SubscriptionEvent.CUSTOMER_LEFT,
        ],
      });
    }
    
    return () => {
      unsubscribe(registryId);
    };
  }, [isConnected, registryId, subscribe, unsubscribe]);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage || !('registryId' in lastMessage) || lastMessage.registryId !== registryId) {
      return;
    }

    switch (lastMessage.eventType) {
      case SubscriptionEvent.REGISTRY_UPDATED:
        setRegistryData(lastMessage.registry);
        setActivity(prev => [{
          type: 'registry_updated',
          timestamp: lastMessage.timestamp,
          description: `Registry "${lastMessage.registry.title}" was updated`,
        }, ...prev.slice(0, 19)]);
        break;
        
      case SubscriptionEvent.ITEM_ADDED:
        setItems(prev => [...prev, lastMessage.item]);
        setActivity(prev => [{
          type: 'item_added',
          timestamp: lastMessage.timestamp,
          description: `Item "${lastMessage.item.name}" was added`,
        }, ...prev.slice(0, 19)]);
        break;
        
      case SubscriptionEvent.ITEM_REMOVED:
        setItems(prev => prev.filter(item => item.id !== lastMessage.itemId));
        setActivity(prev => [{
          type: 'item_removed',
          timestamp: lastMessage.timestamp,
          description: `Item was removed from registry`,
        }, ...prev.slice(0, 19)]);
        break;
        
      case SubscriptionEvent.ITEM_PURCHASED:
        setItems(prev => prev.map(item => 
          item.id === lastMessage.itemId 
            ? { ...item, quantity: item.quantity - lastMessage.quantity }
            : item
        ));
        setActivity(prev => [{
          type: 'item_purchased',
          timestamp: lastMessage.timestamp,
          description: `${lastMessage.quantity} item(s) purchased by ${lastMessage.purchasedBy}`,
        }, ...prev.slice(0, 19)]);
        break;
        
      case SubscriptionEvent.CUSTOMER_JOINED:
        setCustomers(prev => [...prev, lastMessage.customer]);
        setActivity(prev => [{
          type: 'customer_joined',
          timestamp: lastMessage.timestamp,
          description: `${lastMessage.customer.name} joined the registry`,
        }, ...prev.slice(0, 19)]);
        break;
        
      case SubscriptionEvent.CUSTOMER_LEFT:
        setCustomers(prev => prev.filter(customer => customer.id !== lastMessage.customerId));
        setActivity(prev => [{
          type: 'customer_left',
          timestamp: lastMessage.timestamp,
          description: `Customer left the registry`,
        }, ...prev.slice(0, 19)]);
        break;
    }
  }, [lastMessage, registryId]);

  return {
    registryData,
    items,
    customers,
    activity,
    isConnected,
  };
}

/**
 * Hook for shop-wide subscriptions
 */
export function useShopSubscription() {
  const { isConnected, lastMessage, subscribe, unsubscribe } = useSubscriptions();
  const [analytics, setAnalytics] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<Record<string, any>>({});

  // Subscribe to shop events
  useEffect(() => {
    if (isConnected) {
      subscribe({
        events: [
          SubscriptionEvent.ANALYTICS_UPDATED,
          SubscriptionEvent.SHOP_SETTINGS_UPDATED,
          SubscriptionEvent.ORDER_CREATED,
          SubscriptionEvent.ORDER_UPDATED,
          SubscriptionEvent.INVENTORY_UPDATED,
          SubscriptionEvent.WEBHOOK_RECEIVED,
        ],
      });
    }
    
    return () => {
      unsubscribe();
    };
  }, [isConnected, subscribe, unsubscribe]);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.eventType) {
      case SubscriptionEvent.ANALYTICS_UPDATED:
        setAnalytics(lastMessage.analytics);
        break;
        
      case SubscriptionEvent.SHOP_SETTINGS_UPDATED:
        setSettings(lastMessage.settings);
        break;
        
      case SubscriptionEvent.ORDER_CREATED:
        setOrders(prev => [lastMessage.order, ...prev.slice(0, 49)]);
        break;
        
      case SubscriptionEvent.ORDER_UPDATED:
        setOrders(prev => prev.map(order => 
          order.id === lastMessage.orderId 
            ? { ...order, status: lastMessage.status }
            : order
        ));
        break;
        
      case SubscriptionEvent.INVENTORY_UPDATED:
        setInventory(prev => ({
          ...prev,
          [lastMessage.variantId]: {
            quantity: lastMessage.quantity,
            available: lastMessage.available,
          },
        }));
        break;
        
      case SubscriptionEvent.WEBHOOK_RECEIVED:
        console.log('Webhook received:', lastMessage.webhook);
        break;
    }
  }, [lastMessage]);

  return {
    analytics,
    settings,
    orders,
    inventory,
    isConnected,
  };
}

/**
 * Hook for real-time notifications
 */
export function useNotifications() {
  const { lastMessage } = useSubscriptions();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!lastMessage) return;

    // Create notification based on event type
    let notification = null;
    
    switch (lastMessage.eventType) {
      case SubscriptionEvent.ITEM_PURCHASED:
        notification = {
          id: `purchase-${Date.now()}`,
          type: 'success',
          title: 'Item Purchased',
          message: `${lastMessage.quantity} item(s) purchased by ${lastMessage.purchasedBy}`,
          timestamp: lastMessage.timestamp,
        };
        break;
        
      case SubscriptionEvent.CUSTOMER_JOINED:
        notification = {
          id: `join-${Date.now()}`,
          type: 'info',
          title: 'New Customer',
          message: `${lastMessage.customer.name} joined a registry`,
          timestamp: lastMessage.timestamp,
        };
        break;
        
      case SubscriptionEvent.ORDER_CREATED:
        notification = {
          id: `order-${Date.now()}`,
          type: 'success',
          title: 'New Order',
          message: `Order ${lastMessage.order.name} created`,
          timestamp: lastMessage.timestamp,
        };
        break;
        
      case SubscriptionEvent.INVENTORY_UPDATED:
        if (!lastMessage.available) {
          notification = {
            id: `inventory-${Date.now()}`,
            type: 'warning',
            title: 'Low Inventory',
            message: `Product variant ${lastMessage.variantId} is out of stock`,
            timestamp: lastMessage.timestamp,
          };
        }
        break;
    }

    if (notification) {
      setNotifications(prev => [notification, ...prev.slice(0, 19)]);
      
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    }
  }, [lastMessage]);

  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  return {
    notifications,
    dismissNotification,
  };
}

export default useSubscriptions;