import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  TextField,
  Button,
  ButtonGroup,
  InlineStack,
  Box,
  Modal,
  Form,
  FormLayout,
  Checkbox,
  Select,
  Badge,
  Banner,
  List,
  Divider,
  Tooltip,
  Icon,
  Link,
  DataTable,
  Tabs,
  EmptyState,
  Collapsible,
  ChoiceList,
  RangeSlider
} from "@shopify/polaris";
import {
  ShareIcon,
  EmailIcon,
  LinkIcon,
  ExternalIcon,
  DuplicateIcon,
  QrCodeIcon,
  ChartVerticalIcon,
  DeleteIcon,
  EditIcon,
  ViewIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
import { createRegistryServiceFromRequest } from "~/lib/registry.server";
import { createRegistrySharingService, type ShareStats, formatPlatformName } from "~/lib/registry-sharing.server";

interface LoaderData {
  registry: {
    id: string;
    title: string;
    slug: string;
    visibility: string;
    customerFirstName?: string;
    customerLastName?: string;
    customerEmail?: string;
  };
  shareStats: ShareStats;
  socialUrls: Record<string, string>;
  activeLinks: Array<{
    token: string;
    url: string;
    expiresAt: Date | null;
    createdAt: Date;
    useCount: number;
    maxUses: number | null;
  }>;
}

/**
 * Registry Sharing Interface
 * Manage sharing options, generate links, track analytics
 */
export const loader = withAdminAuth(async ({ request, params }, { admin, session, shop }) => {
  const registryId = params.id;
  if (!registryId) {
    throw new Response("Registry ID required", { status: 400 });
  }

  try {
    // Get registry details
    const registryService = await createRegistryServiceFromRequest(request, shop.id);
    const registry = await registryService.getRegistryById(registryId);

    if (!registry) {
      throw new Response("Registry not found", { status: 404 });
    }

    // Get sharing service
    const sharingService = createRegistrySharingService(shop.id);

    // Get sharing statistics
    const shareStats = await sharingService.getShareStats(registryId);

    // Generate social media URLs
    const baseUrl = process.env.SHOPIFY_APP_URL || 'https://your-app.com';
    const socialUrls = await sharingService.generateSocialShareUrls(registryId, baseUrl);

    // Get active shareable links
    const activeLinks = await sharingService.getActiveShareableLinks(registryId);

    return json<LoaderData>({
      registry: {
        id: registry.id,
        title: registry.title,
        slug: registry.slug,
        visibility: registry.visibility,
        customerFirstName: registry.customerFirstName,
        customerLastName: registry.customerLastName,
        customerEmail: registry.customerEmail
      },
      shareStats,
      socialUrls,
      activeLinks
    });
  } catch (error) {
    console.error("Error loading sharing data:", error);
    throw new Response("Failed to load sharing data", { status: 500 });
  }
});

export const action = withAdminAuth(async ({ request, params }, { admin, session, shop }) => {
  const registryId = params.id;
  if (!registryId) {
    throw new Response("Registry ID required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    const sharingService = createRegistrySharingService(shop.id);

    switch (intent) {
      case "generate_link": {
        const expiresIn = parseInt(formData.get("expiresIn") as string) || undefined;
        const maxUses = parseInt(formData.get("maxUses") as string) || undefined;
        const allowGuests = formData.get("allowGuests") === "on";
        const trackViews = formData.get("trackViews") === "on";
        const platform = formData.get("platform") as string || "link";

        const shareLink = await sharingService.generateShareableLink(registryId, {
          platform,
          expiresIn,
          maxUses,
          allowGuests,
          trackViews
        });

        if (shareLink) {
          return json({ 
            success: true, 
            shareLink,
            message: "Shareable link generated successfully!" 
          });
        } else {
          return json({ error: "Failed to generate shareable link" }, { status: 500 });
        }
      }

      case "send_emails": {
        const emails = (formData.get("emails") as string).split(',').map(e => e.trim()).filter(Boolean);
        const senderName = formData.get("senderName") as string;
        const senderEmail = formData.get("senderEmail") as string;
        const personalMessage = formData.get("personalMessage") as string || undefined;
        const includePreview = formData.get("includePreview") === "on";

        const result = await sharingService.sendEmailShares(registryId, {
          recipientEmails: emails,
          senderName,
          senderEmail,
          personalMessage,
          includePreview
        });

        if (result.success) {
          return json({
            success: true,
            message: `Registry shared with ${result.sentEmails.length} recipient${result.sentEmails.length !== 1 ? 's' : ''}!`,
            sentEmails: result.sentEmails,
            failedEmails: result.failedEmails
          });
        } else {
          return json({ error: "Failed to send email shares" }, { status: 500 });
        }
      }

      case "track_share": {
        const platform = formData.get("platform") as string;
        const sharedBy = formData.get("sharedBy") as string || undefined;

        await sharingService.trackShare(registryId, platform, sharedBy);
        
        return json({ success: true, message: "Share tracked successfully!" });
      }

      case "revoke_link": {
        const token = formData.get("token") as string;
        
        const success = await sharingService.revokeShareableLink(registryId, token);
        
        if (success) {
          return json({ success: true, message: "Shareable link revoked successfully!" });
        } else {
          return json({ error: "Failed to revoke shareable link" }, { status: 500 });
        }
      }

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error handling sharing action:", error);
    return json({ error: "Failed to process sharing action" }, { status: 500 });
  }
});

export default function RegistryShare() {
  const { registry, shareStats, socialUrls, activeLinks } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const fetcher = useFetcher();

  // State management
  const [selectedTab, setSelectedTab] = useState(0);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Link generation state
  const [linkExpiresIn, setLinkExpiresIn] = useState<string>("");
  const [linkMaxUses, setLinkMaxUses] = useState<string>("");
  const [linkAllowGuests, setLinkAllowGuests] = useState(true);
  const [linkTrackViews, setLinkTrackViews] = useState(true);
  const [linkPlatform, setLinkPlatform] = useState("link");

  // Email sharing state
  const [emailRecipients, setEmailRecipients] = useState("");
  const [senderName, setSenderName] = useState(
    registry.customerFirstName && registry.customerLastName 
      ? `${registry.customerFirstName} ${registry.customerLastName}`
      : ""
  );
  const [senderEmail, setSenderEmail] = useState(registry.customerEmail || "");
  const [personalMessage, setPersonalMessage] = useState("");
  const [includePreview, setIncludePreview] = useState(true);

  const isLoading = fetcher.state === "submitting";

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(label);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleGenerateLink = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "generate_link");
    formData.append("platform", linkPlatform);
    if (linkExpiresIn) formData.append("expiresIn", linkExpiresIn);
    if (linkMaxUses) formData.append("maxUses", linkMaxUses);
    if (linkAllowGuests) formData.append("allowGuests", "on");
    if (linkTrackViews) formData.append("trackViews", "on");

    fetcher.submit(formData, { method: "post" });
    setShowLinkModal(false);
  }, [linkPlatform, linkExpiresIn, linkMaxUses, linkAllowGuests, linkTrackViews, fetcher]);

  const handleSendEmails = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "send_emails");
    formData.append("emails", emailRecipients);
    formData.append("senderName", senderName);
    formData.append("senderEmail", senderEmail);
    if (personalMessage) formData.append("personalMessage", personalMessage);
    if (includePreview) formData.append("includePreview", "on");

    fetcher.submit(formData, { method: "post" });
    setShowEmailModal(false);
  }, [emailRecipients, senderName, senderEmail, personalMessage, includePreview, fetcher]);

  const handleSocialShare = useCallback((platform: string, url: string) => {
    // Track the share
    const formData = new FormData();
    formData.append("intent", "track_share");
    formData.append("platform", platform);
    
    fetcher.submit(formData, { method: "post" });

    // Open share URL
    window.open(url, '_blank', 'width=600,height=400');
  }, [fetcher]);

  const handleRevokeLink = useCallback((token: string) => {
    if (confirm("Are you sure you want to revoke this shareable link? It will no longer work.")) {
      const formData = new FormData();
      formData.append("intent", "revoke_link");
      formData.append("token", token);
      
      fetcher.submit(formData, { method: "post" });
    }
  }, [fetcher]);

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const tabs = [
    {
      id: 'quick-share',
      content: 'Quick Share',
      panelID: 'quick-share-panel'
    },
    {
      id: 'manage-links',
      content: 'Manage Links',
      panelID: 'manage-links-panel'
    },
    {
      id: 'analytics',
      content: 'Analytics',
      panelID: 'analytics-panel'
    }
  ];

  const socialPlatforms = [
    { key: 'facebook', name: 'Facebook', color: '#1877F2' },
    { key: 'twitter', name: 'Twitter', color: '#1DA1F2' },
    { key: 'linkedin', name: 'LinkedIn', color: '#0A66C2' },
    { key: 'pinterest', name: 'Pinterest', color: '#E60023' },
    { key: 'whatsapp', name: 'WhatsApp', color: '#25D366' },
    { key: 'email', name: 'Email', color: '#666' }
  ];

  return (
    <Page
      title={`Share ${registry.title}`}
      subtitle="Share your registry with friends and family"
      backAction={{
        content: 'Back to Registry',
        url: `/admin/registries/${registry.id}`
      }}
      primaryAction={{
        content: 'Generate New Link',
        onAction: () => setShowLinkModal(true),
        icon: LinkIcon
      }}
      secondaryActions={[
        {
          content: 'Email Registry',
          onAction: () => setShowEmailModal(true),
          icon: EmailIcon
        },
        {
          content: 'View Registry',
          url: `/registry/${registry.slug}`,
          external: true,
          icon: ViewIcon
        }
      ]}
    >
      <BlockStack gap="500">
        {/* Privacy Notice */}
        {registry.visibility === 'private' && (
          <Banner status="warning">
            <Text variant="bodyMd">
              This registry is set to private. Only people with direct links or invitations can view it.
            </Text>
          </Banner>
        )}

        {/* Success/Error Messages */}
        {fetcher.data?.success && (
          <Banner status="success" onDismiss={() => fetcher.load('')}>
            <Text variant="bodyMd">{fetcher.data.message}</Text>
          </Banner>
        )}

        {fetcher.data?.error && (
          <Banner status="critical" onDismiss={() => fetcher.load('')}>
            <Text variant="bodyMd">{fetcher.data.error}</Text>
          </Banner>
        )}

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {/* Quick Share Tab */}
          {selectedTab === 0 && (
            <Card>
              <BlockStack gap="500">
                <Text variant="headingLg" as="h2">Quick Share Options</Text>
                
                {/* Social Media Sharing */}
                <Box>
                  <Text variant="headingMd" as="h3">Share on Social Media</Text>
                  <Box paddingBlockStart="300">
                    <InlineGrid columns={{ xs: 2, sm: 3, lg: 6 }} gap="200">
                      {socialPlatforms.map(platform => (
                        <Button
                          key={platform.key}
                          fullWidth
                          onClick={() => socialUrls[platform.key] && handleSocialShare(platform.key, socialUrls[platform.key])}
                          disabled={!socialUrls[platform.key]}
                        >
                          {platform.name}
                        </Button>
                      ))}
                    </InlineGrid>
                  </Box>
                </Box>

                <Divider />

                {/* Direct Registry Link */}
                <Box>
                  <Text variant="headingMd" as="h3">Direct Registry Link</Text>
                  <Box paddingBlockStart="300">
                    <InlineStack gap="200" align="start">
                      <Box minWidth="400px">
                        <TextField
                          label=""
                          value={`${process.env.SHOPIFY_APP_URL || 'https://your-app.com'}/registry/${registry.slug}`}
                          readOnly
                          autoComplete="off"
                        />
                      </Box>
                      <Button
                        icon={DuplicateIcon}
                        onClick={() => copyToClipboard(
                          `${process.env.SHOPIFY_APP_URL || 'https://your-app.com'}/registry/${registry.slug}`,
                          'registry'
                        )}
                      >
                        {copiedUrl === 'registry' ? 'Copied!' : 'Copy'}
                      </Button>
                    </InlineStack>
                  </Box>
                </Box>

                {/* QR Code */}
                <Box>
                  <Text variant="headingMd" as="h3">QR Code</Text>
                  <Box paddingBlockStart="300">
                    <InlineStack gap="300" align="start">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${process.env.SHOPIFY_APP_URL || 'https://your-app.com'}/registry/${registry.slug}`)}`}
                        alt="Registry QR Code"
                        style={{ borderRadius: '8px', border: '1px solid #e1e3e5' }}
                      />
                      <BlockStack gap="200">
                        <Text variant="bodyMd">
                          Let people scan this QR code to quickly access your registry on their mobile device.
                        </Text>
                        <Button
                          icon={ExternalIcon}
                          url={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${process.env.SHOPIFY_APP_URL || 'https://your-app.com'}/registry/${registry.slug}`)}`}
                          external
                        >
                          Download High Resolution
                        </Button>
                      </BlockStack>
                    </InlineStack>
                  </Box>
                </Box>
              </BlockStack>
            </Card>
          )}

          {/* Manage Links Tab */}
          {selectedTab === 1 && (
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <Text variant="headingLg" as="h2">Shareable Links</Text>
                  <Button
                    variant="primary"
                    onClick={() => setShowLinkModal(true)}
                    icon={LinkIcon}
                  >
                    Create New Link
                  </Button>
                </InlineStack>

                {activeLinks.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'numeric', 'text', 'text']}
                    headings={['Link', 'Created', 'Uses', 'Expires', 'Actions']}
                    rows={activeLinks.map(link => [
                      <InlineStack gap="200" key={link.token}>
                        <Text variant="bodyMd" fontWeight="medium">
                          {link.url.substring(0, 50)}...
                        </Text>
                        <Button
                          size="micro"
                          icon={DuplicateIcon}
                          onClick={() => copyToClipboard(link.url, link.token)}
                        >
                          {copiedUrl === link.token ? 'Copied!' : 'Copy'}
                        </Button>
                      </InlineStack>,
                      formatDate(link.createdAt),
                      `${link.useCount}${link.maxUses ? ` / ${link.maxUses}` : ''}`,
                      link.expiresAt ? formatDate(link.expiresAt) : 'Never',
                      <ButtonGroup key={link.token}>
                        <Button
                          size="micro"
                          icon={DeleteIcon}
                          onClick={() => handleRevokeLink(link.token)}
                          tone="critical"
                        >
                          Revoke
                        </Button>
                      </ButtonGroup>
                    ])}
                  />
                ) : (
                  <EmptyState
                    heading="No shareable links created"
                    action={{
                      content: 'Create First Link',
                      onAction: () => setShowLinkModal(true)
                    }}
                    image="/api/placeholder/400/300"
                  >
                    <Text variant="bodyMd" tone="subdued">
                      Create custom shareable links with expiration dates and usage limits.
                    </Text>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Analytics Tab */}
          {selectedTab === 2 && (
            <Card>
              <BlockStack gap="500">
                <Text variant="headingLg" as="h2">Sharing Analytics</Text>
                
                {/* Key Metrics */}
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">{shareStats.totalShares}</Text>
                      <Text variant="bodyMd" tone="subdued">Total Shares</Text>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">{shareStats.totalViews}</Text>
                      <Text variant="bodyMd" tone="subdued">Link Views</Text>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">{Object.keys(shareStats.sharesByPlatform).length}</Text>
                      <Text variant="bodyMd" tone="subdued">Platforms Used</Text>
                    </BlockStack>
                  </Card>
                </InlineGrid>

                {/* Shares by Platform */}
                {Object.keys(shareStats.sharesByPlatform).length > 0 && (
                  <Box>
                    <Text variant="headingMd" as="h3">Shares by Platform</Text>
                    <Box paddingBlockStart="300">
                      <BlockStack gap="200">
                        {Object.entries(shareStats.sharesByPlatform).map(([platform, count]) => (
                          <InlineStack key={platform} align="space-between">
                            <Text variant="bodyMd">{formatPlatformName(platform)}</Text>
                            <Badge>{count}</Badge>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Box>
                  </Box>
                )}

                {/* Recent Activity */}
                {shareStats.recentShares.length > 0 && (
                  <Box>
                    <Text variant="headingMd" as="h3">Recent Sharing Activity</Text>
                    <Box paddingBlockStart="300">
                      <BlockStack gap="200">
                        {shareStats.recentShares.map((share, index) => (
                          <InlineStack key={index} align="space-between">
                            <Text variant="bodyMd">
                              Shared on {formatPlatformName(share.platform)}
                              {share.sharedBy && share.sharedBy !== 'anonymous' && ` by ${share.sharedBy}`}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              {formatDate(share.sharedAt)}
                            </Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Box>
                  </Box>
                )}

                {shareStats.totalShares === 0 && (
                  <EmptyState
                    heading="No sharing activity yet"
                    action={{
                      content: 'Share Registry',
                      onAction: () => setSelectedTab(0)
                    }}
                    image="/api/placeholder/400/300"
                  >
                    <Text variant="bodyMd" tone="subdued">
                      Start sharing your registry to see analytics here.
                    </Text>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          )}
        </Tabs>
      </BlockStack>

      {/* Generate Link Modal */}
      <Modal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Generate Shareable Link"
        primaryAction={{
          content: 'Generate Link',
          onAction: handleGenerateLink,
          loading: isLoading
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowLinkModal(false)
          }
        ]}
      >
        <Modal.Section>
          <Form>
            <FormLayout>
              <Select
                label="Platform context"
                options={[
                  { label: 'General sharing', value: 'link' },
                  { label: 'Facebook', value: 'facebook' },
                  { label: 'Twitter', value: 'twitter' },
                  { label: 'LinkedIn', value: 'linkedin' },
                  { label: 'Email', value: 'email' },
                  { label: 'WhatsApp', value: 'whatsapp' }
                ]}
                value={linkPlatform}
                onChange={setLinkPlatform}
                helpText="This helps track where the link is being used"
              />

              <TextField
                label="Expires in (hours)"
                type="number"
                value={linkExpiresIn}
                onChange={setLinkExpiresIn}
                placeholder="24"
                helpText="Leave empty for permanent link"
                autoComplete="off"
              />

              <TextField
                label="Maximum uses"
                type="number"
                value={linkMaxUses}
                onChange={setLinkMaxUses}
                placeholder="100"
                helpText="Leave empty for unlimited uses"
                autoComplete="off"
              />

              <Checkbox
                label="Allow guest access"
                checked={linkAllowGuests}
                onChange={setLinkAllowGuests}
                helpText="Let people view the registry without signing in"
              />

              <Checkbox
                label="Track views"
                checked={linkTrackViews}
                onChange={setLinkTrackViews}
                helpText="Count how many times this link is accessed"
              />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>

      {/* Email Share Modal */}
      <Modal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Share via Email"
        primaryAction={{
          content: 'Send Emails',
          onAction: handleSendEmails,
          loading: isLoading,
          disabled: !emailRecipients || !senderName || !senderEmail
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowEmailModal(false)
          }
        ]}
      >
        <Modal.Section>
          <Form>
            <FormLayout>
              <TextField
                label="Recipient emails"
                value={emailRecipients}
                onChange={setEmailRecipients}
                placeholder="friend1@example.com, friend2@example.com"
                helpText="Separate multiple emails with commas"
                multiline={2}
                autoComplete="off"
              />

              <TextField
                label="Your name"
                value={senderName}
                onChange={setSenderName}
                placeholder="John Smith"
                autoComplete="off"
              />

              <TextField
                label="Your email"
                type="email"
                value={senderEmail}
                onChange={setSenderEmail}
                placeholder="john@example.com"
                autoComplete="off"
              />

              <TextField
                label="Personal message (optional)"
                value={personalMessage}
                onChange={setPersonalMessage}
                placeholder="I'd love for you to check out my gift registry!"
                multiline={3}
                autoComplete="off"
              />

              <Checkbox
                label="Include registry preview"
                checked={includePreview}
                onChange={setIncludePreview}
                helpText="Show a preview of items in the email"
              />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}