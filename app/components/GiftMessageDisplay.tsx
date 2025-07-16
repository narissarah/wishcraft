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
    setEditMessage(purchase.giftMessage || '');
    setIsEditing(true);
    setShowModal(true);
  };

  const handleViewClick = () => {
    setIsEditing(false);
    setShowModal(true);
  };

  if (!hasGiftMessage && readonly) {
    return (
      <Card>
        <TextContainer>
          <Text variant="bodyMd" tone="subdued">
            No gift message
          </Text>
        </TextContainer>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Stack spacing="tight">
          <Stack distribution="equalSpacing" alignment="center">
            <Stack spacing="tight" alignment="center">
              <Icon source={EmailIcon} tone="base" />
              <Text variant="headingSm">Gift Message</Text>
              {hasGiftMessage && (
                <Badge tone="info" size="small">
                  <Stack spacing="extraTight" alignment="center">
                    <Icon source={LockIcon} tone="base" />
                    <span>Encrypted</span>
                  </Stack>
                </Badge>
              )}
            </Stack>
            
            {!readonly && (
              <ButtonGroup>
                {hasGiftMessage && (
                  <Tooltip content="View gift message">
                    <Button
                      plain
                      icon={ViewIcon}
                      onClick={handleViewClick}
                      loading={isSubmitting}
                    />
                  </Tooltip>
                )}
                
                <Tooltip content={hasGiftMessage ? "Edit gift message" : "Add gift message"}>
                  <Button
                    plain
                    icon={EditIcon}
                    onClick={handleEditClick}
                    loading={isSubmitting}
                  />
                </Tooltip>
                
                {hasGiftMessage && (
                  <Tooltip content="Delete gift message">
                    <Button
                      plain
                      icon={DeleteIcon}
                      onClick={handleDeleteMessage}
                      loading={isSubmitting}
                      destructive
                    />
                  </Tooltip>
                )}
              </ButtonGroup>
            )}
          </Stack>
          
          <Box>
            {hasGiftMessage ? (
              <TextContainer>
                <Text variant="bodyMd" tone="subdued">
                  From: {purchase.purchaserName || 'Anonymous'}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {purchase.purchaserEmail}
                </Text>
                <Box paddingBlockStart="200">
                  <Text variant="bodyMd">
                    {purchase.giftMessage!.length > 100
                      ? `${purchase.giftMessage!.substring(0, 100)}...`
                      : purchase.giftMessage}
                  </Text>
                </Box>
              </TextContainer>
            ) : (
              <TextContainer>
                <Text variant="bodyMd" tone="subdued">
                  No gift message provided
                </Text>
              </TextContainer>
            )}
          </Box>
        </Stack>
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
          <Stack vertical spacing="loose">
            <Stack spacing="tight">
              <Text variant="headingSm">From:</Text>
              <Stack vertical spacing="extraTight">
                <Text variant="bodyMd">
                  {purchase.purchaserName || 'Anonymous'}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {purchase.purchaserEmail}
                </Text>
              </Stack>
            </Stack>

            <Stack spacing="tight">
              <Text variant="headingSm">Order:</Text>
              <Text variant="bodyMd">
                {purchase.orderName || purchase.orderId}
              </Text>
            </Stack>

            <Stack spacing="tight">
              <Text variant="headingSm">Message:</Text>
              {isEditing ? (
                <TextField
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
                  <Text variant="bodyMd">
                    {purchase.giftMessage || 'No gift message provided'}
                  </Text>
                </Box>
              )}
            </Stack>
          </Stack>
        </Modal.Section>
      </Modal>
    </>
  );
}

/**
 * Compact version for displaying in lists
 */
export function GiftMessagePreview({ purchase }: { purchase: RegistryPurchase & { giftMessage?: string | null } }) {
  const hasGiftMessage = purchase.giftMessage && purchase.giftMessage.trim() !== '';
  
  if (!hasGiftMessage) {
    return (
      <Text variant="bodySm" tone="subdued">
        No gift message
      </Text>
    );
  }

  return (
    <Stack spacing="tight" alignment="center">
      <Icon source={EmailIcon} tone="base" />
      <Text variant="bodySm">
        {purchase.giftMessage!.length > 50
          ? `${purchase.giftMessage!.substring(0, 50)}...`
          : purchase.giftMessage}
      </Text>
      <Badge tone="info" size="small">
        <Stack spacing="extraTight" alignment="center">
          <Icon source={LockIcon} tone="base" />
          <span>Encrypted</span>
        </Stack>
      </Badge>
    </Stack>
  );
}

/**
 * Gift message statistics component
 */
export function GiftMessageStats({ 
  purchases 
}: { 
  purchases: Array<RegistryPurchase & { giftMessage?: string | null }> 
}) {
  const totalPurchases = purchases.length;
  const purchasesWithMessages = purchases.filter(p => p.giftMessage && p.giftMessage.trim() !== '').length;
  const percentage = totalPurchases > 0 ? Math.round((purchasesWithMessages / totalPurchases) * 100) : 0;

  return (
    <Card>
      <TextContainer>
        <Text variant="headingSm">Gift Messages</Text>
        <Stack spacing="tight">
          <Text variant="bodyMd">
            {purchasesWithMessages} of {totalPurchases} purchases include gift messages
          </Text>
          <Badge tone={percentage > 50 ? 'success' : 'attention'}>
            {percentage}%
          </Badge>
        </Stack>
      </TextContainer>
    </Card>
  );
}