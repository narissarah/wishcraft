import { useState } from 'react';
import { Card, Text, Button, Modal, TextField, Badge, Icon, ButtonGroup, Tooltip, Box, InlineStack, BlockStack } from '@shopify/polaris';
import { EmailIcon, EditIcon, DeleteIcon, ViewIcon, LockIcon } from '@shopify/polaris-icons';
import { useFetcher } from '@remix-run/react';
import type { RegistryPurchase } from '@prisma/client';

interface GiftMessageDisplayProps {
  purchase: RegistryPurchase & {
    giftMessage?: string | null;
  };
  readonly?: boolean;
}

export function GiftMessageDisplay({ purchase, readonly = false }: GiftMessageDisplayProps) {
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState(purchase.giftMessage || '');
  const fetcher = useFetcher();

  const hasGiftMessage = purchase.giftMessage && purchase.giftMessage.trim() !== '';
  const isSubmitting = fetcher.state === 'submitting';

  const handleSaveMessage = () => {
    fetcher.submit(
      {
        purchaseId: purchase.id,
        giftMessage: editMessage,
        purchaserEmail: purchase.purchaserEmail || '',
      },
      {
        method: 'POST',
        action: '/api/gift-messages',
      }
    );
    setIsEditing(false);
    setShowModal(false);
  };

  const handleDeleteMessage = () => {
    fetcher.submit(
      {},
      {
        method: 'DELETE',
        action: `/api/gift-messages?purchaseId=${purchase.id}`,
      }
    );
    setShowModal(false);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditMessage(purchase.giftMessage || '');
    setShowModal(true);
  };

  const handleViewClick = () => {
    setIsEditing(false);
    setShowModal(true);
  };

  if (!hasGiftMessage && readonly) {
    return (
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="200" align="center">
            <Icon source={EmailIcon} tone="base" />
            <Text as="h3" variant="headingSm">Gift Message</Text>
          </InlineStack>
          <Text as="p" variant="bodyMd" tone="subdued">
            No gift message provided
          </Text>
        </BlockStack>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="400" align="space-between">
            <InlineStack gap="200" align="center">
              <Icon source={EmailIcon} tone="base" />
              <Text as="h3" variant="headingSm">Gift Message</Text>
              {hasGiftMessage && (
                <Badge tone="info" size="small">
                  Encrypted
                </Badge>
              )}
            </InlineStack>
            
            {!readonly && (
              <ButtonGroup>
                {hasGiftMessage && (
                  <Tooltip content="View gift message">
                    <Button
                      variant="plain"
                      icon={ViewIcon}
                      onClick={handleViewClick}
                      loading={isSubmitting}
                    />
                  </Tooltip>
                )}
                <Tooltip content="Edit gift message">
                  <Button
                    variant="plain"
                    icon={EditIcon}
                    onClick={handleEditClick}
                    loading={isSubmitting}
                  />
                </Tooltip>
                {hasGiftMessage && (
                  <Tooltip content="Delete gift message">
                    <Button
                      variant="plain"
                      icon={DeleteIcon}
                      onClick={handleDeleteMessage}
                      loading={isSubmitting}
                      tone="critical"
                    />
                  </Tooltip>
                )}
              </ButtonGroup>
            )}
          </InlineStack>
          
          <Box>
            {hasGiftMessage ? (
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd" tone="subdued">
                  From: {purchase.purchaserName || 'Anonymous'}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {purchase.purchaserEmail}
                </Text>
                <Box paddingBlockStart="200">
                  <Text as="p" variant="bodyMd">
                    {purchase.giftMessage!.length > 100
                      ? `${purchase.giftMessage!.substring(0, 100)}...`
                      : purchase.giftMessage}
                  </Text>
                </Box>
              </BlockStack>
            ) : (
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd" tone="subdued">
                  No gift message provided
                </Text>
              </BlockStack>
            )}
          </Box>
        </BlockStack>
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? "Edit Gift Message" : "Gift Message"}
        primaryAction={
          isEditing
            ? {
                content: 'Save',
                onAction: handleSaveMessage,
                loading: isSubmitting,
                disabled: !editMessage.trim(),
              }
            : undefined
        }
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">From:</Text>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  {purchase.purchaserName || 'Anonymous'}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {purchase.purchaserEmail}
                </Text>
              </BlockStack>
            </BlockStack>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Order:</Text>
              <Text as="p" variant="bodyMd">
                {purchase.orderName || purchase.orderId}
              </Text>
            </BlockStack>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Message:</Text>
              {isEditing ? (
                <TextField
                  label="Gift Message"
                  value={editMessage}
                  onChange={setEditMessage}
                  multiline={4}
                  placeholder="Enter a personal gift message..."
                  autoComplete="off"
                  maxLength={2000}
                  showCharacterCount
                  helpText="Gift messages are encrypted and stored securely."
                />
              ) : (
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodyMd">
                    {purchase.giftMessage || 'No gift message provided'}
                  </Text>
                </Box>
              )}
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}