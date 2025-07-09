import { useState, useCallback } from 'react';
import {
  ButtonGroup,
  Button,
  Popover,
  ActionList,
  InlineStack,
  Text,
  Box,
  Icon,
  Tooltip
} from '@shopify/polaris';
import {
  ShareIcon,
  EmailIcon,
  LinkIcon,
  ExternalIcon,
  DuplicateIcon
} from '@shopify/polaris-icons';

export interface SocialShareButtonsProps {
  registryUrl: string;
  registryTitle: string;
  registryDescription?: string;
  onShare?: (platform: string) => void;
  onCopy?: () => void;
  compact?: boolean;
  showLabels?: boolean;
}

export interface SocialPlatform {
  key: string;
  name: string;
  icon: any;
  color: string;
  url: string;
}

export function SocialShareButtons({
  registryUrl,
  registryTitle,
  registryDescription,
  onShare,
  onCopy,
  compact = false,
  showLabels = true
}: SocialShareButtonsProps) {
  const [sharePopoverActive, setSharePopoverActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = encodeURIComponent(registryTitle);
  const description = encodeURIComponent(registryDescription || `Check out ${registryTitle}!`);
  const url = encodeURIComponent(registryUrl);

  const socialPlatforms: SocialPlatform[] = [
    {
      key: 'facebook',
      name: 'Facebook',
      icon: ExternalIcon, // In real app, use Facebook icon
      color: '#1877F2',
      url: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${description}`
    },
    {
      key: 'twitter',
      name: 'Twitter',
      icon: ExternalIcon, // In real app, use Twitter icon
      color: '#1DA1F2',
      url: `https://twitter.com/intent/tweet?url=${url}&text=${title}&hashtags=GiftRegistry,Wishlist`
    },
    {
      key: 'linkedin',
      name: 'LinkedIn',
      icon: ExternalIcon, // In real app, use LinkedIn icon
      color: '#0A66C2',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${description}`
    },
    {
      key: 'pinterest',
      name: 'Pinterest',
      icon: ExternalIcon, // In real app, use Pinterest icon
      color: '#E60023',
      url: `https://pinterest.com/pin/create/button/?url=${url}&description=${title}`
    },
    {
      key: 'whatsapp',
      name: 'WhatsApp',
      icon: ExternalIcon, // In real app, use WhatsApp icon
      color: '#25D366',
      url: `https://api.whatsapp.com/send?text=${title}%20${url}`
    },
    {
      key: 'email',
      name: 'Email',
      icon: EmailIcon,
      color: '#666',
      url: `mailto:?subject=${title}&body=${description}%0A%0A${url}`
    }
  ];

  const handleSocialShare = useCallback((platform: SocialPlatform) => {
    // Track the share if callback provided
    if (onShare) {
      onShare(platform.key);
    }

    // Open share URL
    window.open(platform.url, '_blank', 'width=600,height=400');
    setSharePopoverActive(false);
  }, [onShare]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(registryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (onCopy) {
        onCopy();
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }, [registryUrl, onCopy]);

  const shareActionItems = socialPlatforms.map(platform => ({
    content: platform.name,
    prefix: <Icon source={platform.icon} />,
    onAction: () => handleSocialShare(platform)
  }));

  if (compact) {
    return (
      <InlineStack gap="200">
        <Popover
          active={sharePopoverActive}
          activator={
            <Button
              icon={ShareIcon}
              onClick={() => setSharePopoverActive(!sharePopoverActive)}
              accessibilityLabel="Share registry"
            >
              {showLabels ? 'Share' : ''}
            </Button>
          }
          onClose={() => setSharePopoverActive(false)}
        >
          <ActionList items={shareActionItems} />
        </Popover>
        
        <Tooltip content={copied ? 'Copied!' : 'Copy link'}>
          <Button
            icon={copied ? LinkIcon : DuplicateIcon}
            onClick={handleCopyLink}
            accessibilityLabel="Copy registry link"
          >
            {showLabels ? (copied ? 'Copied!' : 'Copy Link') : ''}
          </Button>
        </Tooltip>
      </InlineStack>
    );
  }

  return (
    <Box>
      <InlineStack gap="300" align="start" wrap={false}>
        <ButtonGroup>
          {socialPlatforms.slice(0, 4).map(platform => (
            <Tooltip key={platform.key} content={`Share on ${platform.name}`}>
              <Button
                icon={platform.icon}
                onClick={() => handleSocialShare(platform)}
                accessibilityLabel={`Share on ${platform.name}`}
              >
                {showLabels ? platform.name : ''}
              </Button>
            </Tooltip>
          ))}
        </ButtonGroup>

        <Popover
          active={sharePopoverActive}
          activator={
            <Button
              icon={ShareIcon}
              onClick={() => setSharePopoverActive(!sharePopoverActive)}
              accessibilityLabel="More sharing options"
            >
              {showLabels ? 'More' : ''}
            </Button>
          }
          onClose={() => setSharePopoverActive(false)}
        >
          <ActionList items={[
            ...socialPlatforms.slice(4).map(platform => ({
              content: platform.name,
              prefix: <Icon source={platform.icon} />,
              onAction: () => handleSocialShare(platform)
            })),
            {
              content: copied ? 'Copied!' : 'Copy Link',
              prefix: <Icon source={copied ? LinkIcon : DuplicateIcon} />,
              onAction: handleCopyLink
            }
          ]} />
        </Popover>
      </InlineStack>
    </Box>
  );
}

export default SocialShareButtons;