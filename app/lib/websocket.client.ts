import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================================
// WEBSOCKET CLIENT HOOK
// ============================================================================

interface UseWebSocketOptions {
  registryId?: string;
  userId?: string;
  sessionId?: string;
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionId?: string;
  error?: string;
  reconnectAttempts: number;
}

export function useWebSocket({
  registryId,
  userId,
  sessionId,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  autoReconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setState(prev => ({ ...prev, isConnecting: true, error: undefined }));

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = new URL(`${protocol}//${window.location.host}/ws`);
      
      if (registryId) wsUrl.searchParams.set('registryId', registryId);
      if (userId) wsUrl.searchParams.set('userId', userId);
      if (sessionId) wsUrl.searchParams.set('sessionId', sessionId);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          reconnectAttempts: 0,
          error: undefined
        }));

        // Start heartbeat
        startHeartbeat();
        
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle system messages
          if (message.type === 'connection_established') {
            setState(prev => ({
              ...prev,
              connectionId: message.data.connectionId
            }));
          } else if (message.type === 'heartbeat') {
            // Respond to heartbeat
            sendMessage({ type: 'heartbeat' });
          }
          
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));

        stopHeartbeat();
        onDisconnect?.();

        // Auto-reconnect if enabled
        if (autoReconnect && state.reconnectAttempts < maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: 'Connection failed'
        }));

        onError?.(error);
      };

    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to create WebSocket connection'
      }));
    }
  }, [registryId, userId, sessionId, onConnect, onMessage, onDisconnect, onError, autoReconnect, maxReconnectAttempts, reconnectInterval, state.reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState({
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0
    });
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(() => {
      sendMessage({ type: 'heartbeat' });
    }, 30000); // Send heartbeat every 30 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // Connect on mount and when dependencies change
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage
  };
}

// ============================================================================
// REGISTRY-SPECIFIC HOOKS
// ============================================================================

export function useRegistryRealtimeUpdates(registryId: string, userId?: string) {
  const [viewers, setViewers] = useState<any[]>([]);
  const [inventoryUpdates, setInventoryUpdates] = useState<any[]>([]);
  const [purchaseNotifications, setPurchaseNotifications] = useState<any[]>([]);
  const [groupGiftUpdates, setGroupGiftUpdates] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'registry_viewers':
        setViewers(message.data.activeViewers || []);
        break;
        
      case 'viewer_joined':
        setViewers(prev => [...prev, message.data]);
        break;
        
      case 'viewer_left':
        setViewers(prev => prev.filter(v => v.connectionId !== message.data.connectionId));
        break;
        
      case 'inventory_update':
        setInventoryUpdates(prev => [message.data, ...prev.slice(0, 9)]); // Keep last 10
        break;
        
      case 'purchase_notification':
        setPurchaseNotifications(prev => [message.data, ...prev.slice(0, 9)]);
        break;
        
      case 'group_gift_update':
        setGroupGiftUpdates(prev => [message.data, ...prev.slice(0, 9)]);
        break;
        
      case 'registry_activity':
        setRecentActivity(prev => [message.data, ...prev.slice(0, 19)]); // Keep last 20
        break;
        
      default:
        break;
    }
  }, []);

  const { isConnected, sendMessage } = useWebSocket({
    registryId,
    userId,
    onMessage: handleMessage
  });

  const joinRegistry = useCallback(() => {
    sendMessage({
      type: 'join_registry',
      data: { registryId, userId }
    });
  }, [sendMessage, registryId, userId]);

  const leaveRegistry = useCallback(() => {
    sendMessage({
      type: 'leave_registry',
      data: { registryId }
    });
  }, [sendMessage, registryId]);

  const broadcastActivity = useCallback((activity: any) => {
    sendMessage({
      type: 'registry_activity',
      data: activity
    });
  }, [sendMessage]);

  const updatePresence = useCallback((presence: any) => {
    sendMessage({
      type: 'user_presence',
      data: presence
    });
  }, [sendMessage]);

  // Join registry when connected
  useEffect(() => {
    if (isConnected && registryId) {
      joinRegistry();
    }
  }, [isConnected, registryId, joinRegistry]);

  return {
    isConnected,
    viewers,
    inventoryUpdates,
    purchaseNotifications,
    groupGiftUpdates,
    recentActivity,
    joinRegistry,
    leaveRegistry,
    broadcastActivity,
    updatePresence
  };
}

// ============================================================================
// PRESENCE TRACKING HOOK
// ============================================================================

export function useUserPresence(registryId: string, userId?: string) {
  const [currentPage, setCurrentPage] = useState<string>('');
  const [viewingItem, setViewingItem] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const { updatePresence } = useRegistryRealtimeUpdates(registryId, userId);

  // Track page changes
  useEffect(() => {
    const page = window.location.pathname;
    setCurrentPage(page);
    
    updatePresence({
      currentPage: page,
      viewingItem,
      isActive,
      lastActivity: new Date().toISOString()
    });
  }, [updatePresence, viewingItem, isActive]);

  // Track user activity
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      setIsActive(true);
      clearTimeout(inactivityTimer);
      
      inactivityTimer = setTimeout(() => {
        setIsActive(false);
        updatePresence({
          currentPage,
          viewingItem,
          isActive: false,
          lastActivity: new Date().toISOString()
        });
      }, 300000); // 5 minutes of inactivity
    };

    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Listen for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Initial timer
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [updatePresence, currentPage, viewingItem]);

  return {
    currentPage,
    viewingItem,
    isActive,
    setViewingItem,
    setCurrentPage
  };
}

// ============================================================================
// NOTIFICATION HOOK
// ============================================================================

export function useRealtimeNotifications(registryId: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { purchaseNotifications, groupGiftUpdates, inventoryUpdates } = useRegistryRealtimeUpdates(registryId);

  // Combine all updates into notifications
  useEffect(() => {
    const allNotifications = [
      ...purchaseNotifications.map(n => ({ ...n, type: 'purchase', id: `purchase_${n.timestamp}` })),
      ...groupGiftUpdates.map(n => ({ ...n, type: 'group_gift', id: `group_gift_${n.timestamp}` })),
      ...inventoryUpdates.map(n => ({ ...n, type: 'inventory', id: `inventory_${n.timestamp}` }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setNotifications(allNotifications);
    setUnreadCount(allNotifications.length);
  }, [purchaseNotifications, groupGiftUpdates, inventoryUpdates]);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications
  };
}