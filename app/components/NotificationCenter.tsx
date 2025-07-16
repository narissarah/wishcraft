import { useState, useCallback } from 'react';
import { Popover, Button, Badge, Stack, Scrollable, EmptyState, Card, TextContainer, Text, Icon, Spinner, Checkbox } from '@shopify/polaris';
import { NotificationIcon, CircleTickMajor } from '@shopify/polaris-icons';
import { useNotifications, getNotificationIcon, getNotificationColor } from '~/hooks/useNotifications';
import type { Notification } from '~/lib/notifications.server';

/**
 * Notification Center Component
 * Displays real-time notifications with badge count
 */
export function NotificationCenter({ customerId }: { customerId?: string }) {
  const [popoverActive, setPopoverActive] = useState(false);
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    handleAction,
  } = useNotifications(customerId);

  const togglePopoverActive = useCallback(
    () => setPopoverActive((active) => !active),
    []
  );

  const activator = (
    <Button
      onClick={togglePopoverActive}
      disclosure
      icon={NotificationIcon}
    >
      Notifications
      {unreadCount > 0 && (
        <Badge tone="attention" progress="complete">
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      onClose={togglePopoverActive}
      ariaHaspopup
      sectioned
      preferredAlignment="right"
      preferredPosition="below"
    >
      <div style={{ width: '400px', maxWidth: '90vw' }}>
        <Card>
          <div style={{ padding: '16px 16px 8px' }}>
            <Stack vertical spacing="tight">
              <Stack distribution="equalSpacing" alignment="center">
                <Text variant="headingMd" as="h2">
                  Notifications
                </Text>
                <Stack spacing="tight">
                  {!isConnected && (
                    <Badge tone="warning">Offline</Badge>
                  )}
                  {unreadCount > 0 && (
                    <Button
                      plain
                      onClick={markAllAsRead}
                      icon={CircleTickMajor}
                    >
                      Mark all read
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Stack>
          </div>

          <Scrollable style={{ height: '400px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px' }}>
                <EmptyState
                  heading="No notifications yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>You'll see notifications here when there's activity on your registries.</p>
                </EmptyState>
              </div>
            ) : (
              <Stack vertical spacing="none">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markAsRead(notification.id)}
                    onAction={() => handleAction(notification)}
                  />
                ))}
              </Stack>
            )}
          </Scrollable>

          {!isConnected && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e1e3e5' }}>
              <Stack spacing="tight" alignment="center">
                <Spinner size="small" />
                <Text tone="subdued" variant="bodySm">
                  Reconnecting...
                </Text>
              </Stack>
            </div>
          )}
        </Card>
      </div>
    </Popover>
  );
}

/**
 * Individual notification item
 */
function NotificationItem({
  notification,
  onRead,
  onAction,
}: {
  notification: Notification;
  onRead: () => void;
  onAction: () => void;
}) {
  const isUnread = !notification.readAt;
  const icon = getNotificationIcon(notification.type);
  const color = getNotificationColor(notification.priority);

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: isUnread ? '#f6f6f7' : 'transparent',
        borderBottom: '1px solid #e1e3e5',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
      onClick={() => {
        if (isUnread) onRead();
        if (notification.actionUrl) onAction();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f2f2f3';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isUnread ? '#f6f6f7' : 'transparent';
      }}
    >
      <Stack spacing="tight">
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        
        <Stack vertical spacing="extraTight" distribution="leading">
          <Text variant="bodyMd" fontWeight="semibold">
            {notification.title}
          </Text>
          <Text variant="bodySm" tone="subdued">
            {notification.message}
          </Text>
          <Stack spacing="extraTight">
            <Text variant="bodySm" tone="subdued">
              {formatTime(notification.createdAt)}
            </Text>
            {notification.actionLabel && (
              <>
                <Text variant="bodySm" tone="subdued">•</Text>
                <Text variant="bodySm" tone="info">
                  {notification.actionLabel}
                </Text>
              </>
            )}
          </Stack>
        </Stack>

        {isUnread && (
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: color,
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          />
        )}
      </Stack>
    </div>
  );
}

/**
 * Format notification time
 */
function formatTime(date: Date | string): string {
  const now = new Date();
  const notificationDate = new Date(date);
  const diffMs = now.getTime() - notificationDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return notificationDate.toLocaleDateString();
}

/**
 * Notification preferences component
 */
export function NotificationPreferences() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  return (
    <Card title="Notification Preferences">
      <Stack vertical>
        <Checkbox
          label="Email notifications"
          checked={emailEnabled}
          onChange={setEmailEnabled}
          helpText="Receive notifications via email"
        />
        <Checkbox
          label="Push notifications"
          checked={pushEnabled}
          onChange={setPushEnabled}
          helpText="Receive notifications in your browser"
        />
        <Checkbox
          label="SMS notifications"
          checked={smsEnabled}
          onChange={setSmsEnabled}
          helpText="Receive notifications via SMS (additional charges may apply)"
        />
      </Stack>
    </Card>
  );
}