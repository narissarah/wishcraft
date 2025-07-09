import { useState, useEffect } from 'react';
import { 
  Card, 
  Text, 
  Badge, 
  BlockStack, 
  InlineStack, 
  Icon,
  Button,
  Modal,
  Toast,
  Frame,
  Avatar,
  Banner,
  Tooltip
} from '@shopify/polaris';
import { 
  ViewIcon, 
  NotificationIcon, 
  PackageIcon, 
  GiftCardIcon,
  MoneyIcon,
  AlertTriangleIcon
} from '@shopify/polaris-icons';
import { useRegistryRealtimeUpdates, useRealtimeNotifications, useUserPresence } from '~/lib/websocket.client';

// ============================================================================
// LIVE REGISTRY VIEWERS COMPONENT
// ============================================================================

interface LiveViewersProps {
  registryId: string;
  currentUserId?: string;
  showDetails?: boolean;
}

export function LiveViewers({ registryId, currentUserId, showDetails = false }: LiveViewersProps) {
  const { viewers, isConnected } = useRegistryRealtimeUpdates(registryId, currentUserId);
  const [showViewerModal, setShowViewerModal] = useState(false);

  // Filter out current user
  const otherViewers = viewers.filter(v => v.userId !== currentUserId);
  const viewerCount = otherViewers.length;

  if (!isConnected) {
    return (
      <Card>
        <InlineStack gap="200" blockAlign="center">
          <Icon source={ViewIcon} tone="subdued" />
          <Text variant="bodySm" tone="subdued">Connecting...</Text>
        </InlineStack>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <InlineStack gap="300" blockAlign="center">
          <div style={{ position: 'relative' }}>
            <Icon source={ViewIcon} tone={viewerCount > 0 ? "success" : "subdued"} />
            {viewerCount > 0 && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#00a047',
                color: 'white',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {viewerCount}
              </div>
            )}
          </div>
          
          <BlockStack gap="100">
            <Text variant="bodySm" fontWeight="medium">
              {viewerCount === 0 ? 'No one else viewing' : 
               viewerCount === 1 ? '1 person viewing' : 
               `${viewerCount} people viewing`}
            </Text>
            
            {isConnected && (
              <InlineStack gap="100" blockAlign="center">
                <div style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#00a047',
                  borderRadius: '50%'
                }} />
                <Text variant="bodySm" tone="subdued">Live</Text>
              </InlineStack>
            )}
          </BlockStack>

          {showDetails && viewerCount > 0 && (
            <Button 
              variant="plain" 
              size="micro"
              onClick={() => setShowViewerModal(true)}
            >
              View details
            </Button>
          )}
        </InlineStack>

        {!showDetails && viewerCount > 0 && (
          <div style={{ marginTop: '12px' }}>
            <InlineStack gap="200">
              {otherViewers.slice(0, 3).map((viewer, index) => (
                <Tooltip 
                  key={viewer.connectionId} 
                  content={viewer.userId || `Anonymous viewer`}
                >
                  <Avatar 
                    size="extraSmall" 
                    name={viewer.userId || 'Anonymous'} 
                  />
                </Tooltip>
              ))}
              {viewerCount > 3 && (
                <Text variant="bodySm" tone="subdued">
                  +{viewerCount - 3} more
                </Text>
              )}
            </InlineStack>
          </div>
        )}
      </Card>

      {showViewerModal && (
        <Modal
          open={showViewerModal}
          onClose={() => setShowViewerModal(false)}
          title="Current Viewers"
          size="small"
        >
          <Modal.Section>
            <BlockStack gap="300">
              {otherViewers.map(viewer => (
                <InlineStack key={viewer.connectionId} gap="300" blockAlign="center">
                  <Avatar 
                    size="small" 
                    name={viewer.userId || 'Anonymous'} 
                  />
                  
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="medium">
                      {viewer.userId || 'Anonymous Viewer'}
                    </Text>
                    
                    {viewer.metadata?.currentPage && (
                      <Text variant="bodySm" tone="subdued">
                        Viewing: {viewer.metadata.currentPage.split('/').pop() || 'Registry'}
                      </Text>
                    )}
                    
                    {viewer.metadata?.isActive !== undefined && (
                      <Badge tone={viewer.metadata.isActive ? "success" : "subdued"}>
                        {viewer.metadata.isActive ? 'Active' : 'Away'}
                      </Badge>
                    )}
                  </BlockStack>
                </InlineStack>
              ))}
              
              {otherViewers.length === 0 && (
                <Text variant="bodyMd" tone="subdued" alignment="center">
                  No other viewers at the moment
                </Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
}

// ============================================================================
// REAL-TIME NOTIFICATIONS COMPONENT
// ============================================================================

interface RealtimeNotificationsProps {
  registryId: string;
  position?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
}

export function RealtimeNotifications({ registryId, position = 'bottom-right' }: RealtimeNotificationsProps) {
  const { notifications, unreadCount, markAsRead } = useRealtimeNotifications(registryId);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // Show toast notifications for new updates
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      
      // Create toast for new notification
      const toast = {
        id: latestNotification.id,
        content: getNotificationMessage(latestNotification),
        duration: 5000,
        onDismiss: () => {
          setToasts(prev => prev.filter(t => t.id !== latestNotification.id));
        }
      };
      
      setToasts(prev => [toast, ...prev.slice(0, 2)]); // Keep max 3 toasts
    }
  }, [notifications]);

  const getNotificationMessage = (notification: any) => {
    switch (notification.type) {
      case 'purchase':
        return `🎉 ${notification.productTitle} was just purchased!`;
      case 'group_gift':
        return `💝 New contribution to group gift: ${notification.title}`;
      case 'inventory':
        return `📦 Inventory updated for ${notification.productTitle}`;
      default:
        return 'New registry activity';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return MoneyIcon;
      case 'group_gift':
        return GiftCardIcon;
      case 'inventory':
        return PackageIcon;
      default:
        return NotificationIcon;
    }
  };

  return (
    <>
      {/* Notification Button */}
      <div style={{
        position: 'fixed',
        [position.includes('bottom') ? 'bottom' : 'top']: '20px',
        [position.includes('right') ? 'right' : 'left']: '20px',
        zIndex: 1000
      }}>
        <Button
          onClick={() => {
            setShowNotifications(true);
            markAsRead();
          }}
          icon={NotificationIcon}
          variant="primary"
          size="large"
        >
          {unreadCount > 0 && (
            <Badge tone="critical">{unreadCount}</Badge>
          )}
        </Button>
      </div>

      {/* Notifications Modal */}
      <Modal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        title="Live Updates"
        size="medium"
      >
        <Modal.Section>
          <BlockStack gap="300">
            {notifications.length > 0 ? (
              notifications.map(notification => (
                <Card key={notification.id}>
                  <InlineStack gap="300" blockAlign="center">
                    <Icon 
                      source={getNotificationIcon(notification.type)} 
                      tone={notification.type === 'purchase' ? 'success' : 'primary'}
                    />
                    
                    <BlockStack gap="100">
                      <Text variant="bodyMd" fontWeight="medium">
                        {getNotificationMessage(notification)}
                      </Text>
                      
                      <Text variant="bodySm" tone="subdued">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
              ))
            ) : (
              <Text variant="bodyMd" tone="subdued" alignment="center">
                No recent updates
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Toast Notifications */}
      <Frame>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            content={toast.content}
            duration={toast.duration}
            onDismiss={toast.onDismiss}
          />
        ))}
      </Frame>
    </>
  );
}

// ============================================================================
// INVENTORY STATUS INDICATOR
// ============================================================================

interface InventoryStatusProps {
  registryId: string;
  productId: string;
  initialInventory?: number;
  lowStockThreshold?: number;
}

export function InventoryStatus({ 
  registryId, 
  productId, 
  initialInventory, 
  lowStockThreshold = 5 
}: InventoryStatusProps) {
  const { inventoryUpdates } = useRegistryRealtimeUpdates(registryId);
  const [currentInventory, setCurrentInventory] = useState(initialInventory || 0);

  // Update inventory from real-time updates
  useEffect(() => {
    const relevantUpdate = inventoryUpdates.find(update => update.productId === productId);
    if (relevantUpdate) {
      setCurrentInventory(relevantUpdate.available);
    }
  }, [inventoryUpdates, productId]);

  const getInventoryStatus = () => {
    if (currentInventory === 0) {
      return { tone: 'critical', text: 'Out of stock', icon: AlertTriangleIcon };
    } else if (currentInventory <= lowStockThreshold) {
      return { tone: 'warning', text: `Only ${currentInventory} left`, icon: AlertTriangleIcon };
    } else {
      return { tone: 'success', text: 'In stock', icon: PackageIcon };
    }
  };

  const status = getInventoryStatus();

  return (
    <InlineStack gap="200" blockAlign="center">
      <Icon source={status.icon} tone={status.tone as any} />
      <Badge tone={status.tone as any}>
        {status.text}
      </Badge>
    </InlineStack>
  );
}

// ============================================================================
// PURCHASE NOTIFICATIONS BANNER
// ============================================================================

interface PurchaseNotificationsBannerProps {
  registryId: string;
  autoHide?: boolean;
  hideDelay?: number;
}

export function PurchaseNotificationsBanner({ 
  registryId, 
  autoHide = true, 
  hideDelay = 10000 
}: PurchaseNotificationsBannerProps) {
  const { purchaseNotifications } = useRegistryRealtimeUpdates(registryId);
  const [visibleNotifications, setVisibleNotifications] = useState<any[]>([]);

  // Show new purchase notifications
  useEffect(() => {
    if (purchaseNotifications.length > 0) {
      const latest = purchaseNotifications[0];
      
      if (!visibleNotifications.find(n => n.id === latest.id)) {
        setVisibleNotifications(prev => [latest, ...prev]);

        if (autoHide) {
          setTimeout(() => {
            setVisibleNotifications(prev => prev.filter(n => n.id !== latest.id));
          }, hideDelay);
        }
      }
    }
  }, [purchaseNotifications, visibleNotifications, autoHide, hideDelay]);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, width: '300px' }}>
      <BlockStack gap="200">
        {visibleNotifications.map(notification => (
          <Banner
            key={notification.id}
            tone="success"
            onDismiss={() => {
              setVisibleNotifications(prev => prev.filter(n => n.id !== notification.id));
            }}
          >
            <Text variant="bodyMd" fontWeight="medium">
              🎉 {notification.productTitle} was just purchased!
            </Text>
            {notification.buyerName && (
              <Text variant="bodySm" tone="subdued">
                by {notification.buyerName}
              </Text>
            )}
          </Banner>
        ))}
      </BlockStack>
    </div>
  );
}

// ============================================================================
// USER PRESENCE INDICATOR
// ============================================================================

interface UserPresenceProps {
  registryId: string;
  userId?: string;
  itemId?: string;
}

export function UserPresence({ registryId, userId, itemId }: UserPresenceProps) {
  const { setViewingItem } = useUserPresence(registryId, userId);

  // Update viewing item when component mounts/unmounts
  useEffect(() => {
    if (itemId) {
      setViewingItem(itemId);
      return () => setViewingItem(null);
    }
  }, [itemId, setViewingItem]);

  return null; // This component only tracks presence, doesn't render
}

// ============================================================================
// COLLABORATIVE ACTIVITY FEED
// ============================================================================

interface ActivityFeedProps {
  registryId: string;
  maxItems?: number;
  showTimestamps?: boolean;
}

export function ActivityFeed({ registryId, maxItems = 10, showTimestamps = true }: ActivityFeedProps) {
  const { recentActivity, isConnected } = useRegistryRealtimeUpdates(registryId);

  const displayedActivity = recentActivity.slice(0, maxItems);

  if (!isConnected) {
    return (
      <Card>
        <Text variant="bodyMd" tone="subdued">Connecting to live updates...</Text>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Icon source={NotificationIcon} />
          <Text variant="headingMd" as="h3">Live Activity</Text>
          {isConnected && (
            <Badge tone="success">Live</Badge>
          )}
        </InlineStack>

        <BlockStack gap="300">
          {displayedActivity.length > 0 ? (
            displayedActivity.map((activity, index) => (
              <div key={`${activity.timestamp}-${index}`}>
                <InlineStack gap="200" blockAlign="start">
                  <Avatar size="extraSmall" name={activity.actorName || 'User'} />
                  
                  <BlockStack gap="100">
                    <Text variant="bodyMd">
                      {activity.description}
                    </Text>
                    
                    {showTimestamps && (
                      <Text variant="bodySm" tone="subdued">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </Text>
                    )}
                  </BlockStack>
                </InlineStack>
              </div>
            ))
          ) : (
            <Text variant="bodyMd" tone="subdued" alignment="center">
              No recent activity
            </Text>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}