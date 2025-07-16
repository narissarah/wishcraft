import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from '@remix-run/react';
import { Toast, Frame } from '@shopify/polaris';
import type { Notification, NotificationType, NotificationPriority } from '~/lib/notifications.server';
import { log } from '~/lib/logger.server';

/**
 * Hook for real-time notifications
 */
export function useNotifications(customerId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    const url = new URL('/api/notifications/sse', window.location.origin);
    if (customerId) {
      url.searchParams.set('customerId', customerId);
    }

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    // Connection opened
    eventSource.addEventListener('open', () => {
      setIsConnected(true);
      
      // Clear any reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    // Connection established message
    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
    });

    // Recent notifications
    eventSource.addEventListener('recent', (event) => {
      const recentNotifications = JSON.parse(event.data) as Notification[];
      setNotifications(recentNotifications);
      setUnreadCount(recentNotifications.filter(n => !n.readAt).length);
    });

    // New notification
    eventSource.addEventListener('notification', (event) => {
      const notification = JSON.parse(event.data) as Notification;
      
      // Add to notifications list
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show toast for high priority notifications
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        setActiveToast(notification);
      }
      
      // Play notification sound for urgent notifications
      if (notification.priority === 'urgent') {
        playNotificationSound();
      }
    });

    // Heartbeat
    eventSource.addEventListener('heartbeat', () => {
      // Connection is active
    });

    // Error handling
    eventSource.addEventListener('error', (error) => {
      log.error('Notification stream error', error);
      setIsConnected(false);
      
      // Close the connection
      eventSource.close();
      eventSourceRef.current = null;
      
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    });

    return eventSource;
  }, [customerId]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, readAt: new Date() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        throw new Error(`Failed to mark notification as read: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      log.error('Failed to mark notification as read', error);
      
      // Show user-friendly error message
      if (typeof window !== 'undefined' && window.shopify?.toast) {
        window.shopify.toast.show('Failed to mark notification as read. Please try again.', {
          isError: true,
          duration: 5000
        });
      }
      
      // Retry once after delay
      setTimeout(() => {
        markAsRead(notificationId);
      }, 3000);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, readAt: new Date() }))
        );
        setUnreadCount(0);
        
        // Show success message
        if (typeof window !== 'undefined' && window.shopify?.toast) {
          window.shopify.toast.show('All notifications marked as read', {
            duration: 3000
          });
        }
      } else {
        throw new Error(`Failed to mark all notifications as read: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      log.error('Failed to mark all notifications as read', error);
      
      // Show user-friendly error message
      if (typeof window !== 'undefined' && window.shopify?.toast) {
        window.shopify.toast.show('Failed to mark all notifications as read. Please try again.', {
          isError: true,
          duration: 5000
        });
      }
    }
  }, []);

  // Handle notification action
  const handleAction = useCallback((notification: Notification) => {
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
    markAsRead(notification.id);
  }, [navigate, markAsRead]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(error => {
        // Audio playback failed, likely due to user interaction requirements
        // This is normal behavior and doesn't need user notification
      });
    } catch (error) {
      log.error('Failed to create notification audio', error);
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, disconnect to save resources
        disconnect();
      } else {
        // Page is visible, reconnect
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect, disconnect]);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    handleAction,
    activeToast,
    setActiveToast,
  };
}

/**
 * Notification Toast Component
 */
export function NotificationToast({ 
  notification,
  onDismiss 
}: { 
  notification: Notification | null;
  onDismiss: () => void;
}) {
  if (!notification) return null;

  return (
    <Toast
      content={notification.message}
      action={
        notification.actionLabel
          ? {
              content: notification.actionLabel,
              onAction: () => {
                if (notification.actionUrl) {
                  window.location.href = notification.actionUrl;
                }
                onDismiss();
              },
            }
          : undefined
      }
      onDismiss={onDismiss}
    />
  );
}

/**
 * Notification icon based on type
 */
export function getNotificationIcon(type: string) {
  const icons: Record<string, string> = {
    registry_purchase: '🎁',
    registry_shared: '📤',
    item_added: '➕',
    item_removed: '➖',
    item_purchased: '✅',
    gift_message: '💌',
    price_change: '💰',
    out_of_stock: '⚠️',
    back_in_stock: '✅',
    registry_expiring: '⏰',
    system_announcement: '📢',
  };
  
  return icons[type] || '🔔';
}

/**
 * Notification color based on priority
 */
export function getNotificationColor(priority: string) {
  const colors: Record<string, string> = {
    low: '#637381',
    medium: '#006FBB',
    high: '#FF6900',
    urgent: '#D72C0D',
  };
  
  return colors[priority] || '#637381';
}