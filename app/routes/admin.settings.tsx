import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  TextField,
  Select,
  Checkbox,
  RadioButton,
  Button,
  ButtonGroup,
  InlineStack,
  Box,
  Form,
  FormLayout,
  Divider,
  ColorPicker,
  RangeSlider,
  ChoiceList,
  Collapsible,
  Banner,
  Toast,
  Frame,
  Tabs,
  Icon,
  Tooltip,
  Link,
  Badge,
  Modal,
  SettingToggle
} from "@shopify/polaris";
// Simplified theme handling - removed ThemeProvider dependency
import {
  SettingsIcon,
  ColorIcon,
  EmailIcon,
  NotificationIcon,
  PackageIcon,
  LockIcon,
  BillIcon,
  AppsIcon,
  InfoIcon,
  EditIcon,
  ExternalIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
import { db } from "~/lib/db.server";

interface ShopSettings {
  // Appearance Settings
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  
  // Feature Settings
  enablePasswordProtection: boolean;
  enableGiftMessages: boolean;
  enableSocialSharing: boolean;
  enableGroupGifting: boolean;
  enableAnalytics: boolean;
  enableEmailNotifications: boolean;
  enableInventoryTracking: boolean;
  enableMultipleAddresses: boolean;
  
  // Business Settings
  defaultRegistryVisibility: string;
  maxItemsPerRegistry: number;
  allowAnonymousGifts: boolean;
  requireGiftApproval: boolean;
  
  // Email Settings
  fromEmail: string;
  fromName: string;
  emailSignature: string;
  
  // Shipping Settings
  defaultShippingZone: string;
  freeShippingThreshold: number;
  enableShippingCalculation: boolean;
  
  // Advanced Settings
  customCSS: string;
  googleAnalyticsId: string;
  facebookPixelId: string;
  enableDeveloperMode: boolean;
}

interface LoaderData {
  shop: {
    id: string;
    name: string;
    domain: string;
    email: string;
    currencyCode: string;
  };
  settings: ShopSettings;
  plans: {
    current: string;
    available: Array<{
      id: string;
      name: string;
      price: number;
      features: string[];
      isRecommended?: boolean;
    }>;
  };
}

interface ActionData {
  success?: boolean;
  errors?: Record<string, string>;
  message?: string;
}

/**
 * WishCraft Settings Page
 * Comprehensive settings configuration following Polaris annotated layout pattern
 */
export const loader = withAdminAuth(async ({ request }, { admin, session, shop }) => {
  // Get shop settings from database
  const shopSettings = await db.shopSettings.findUnique({
    where: { shopId: shop.id }
  });

  const settings: ShopSettings = {
    // Appearance
    primaryColor: shopSettings?.primaryColor || "#007ace",
    accentColor: shopSettings?.accentColor || "#f3f3f3",
    fontFamily: shopSettings?.fontFamily || "Inter",
    
    // Features
    enablePasswordProtection: shopSettings?.enablePasswordProtection ?? true,
    enableGiftMessages: shopSettings?.enableGiftMessages ?? true,
    enableSocialSharing: shopSettings?.enableSocialSharing ?? true,
    enableGroupGifting: shopSettings?.enableGroupGifting ?? true,
    enableAnalytics: shopSettings?.enableAnalytics ?? true,
    enableEmailNotifications: shopSettings?.enableEmailNotifications ?? true,
    enableInventoryTracking: shopSettings?.enableInventoryTracking ?? true,
    enableMultipleAddresses: shopSettings?.enableMultipleAddresses ?? true,
    
    // Business
    defaultRegistryVisibility: shopSettings?.defaultRegistryVisibility || "public",
    maxItemsPerRegistry: shopSettings?.maxItemsPerRegistry || 100,
    allowAnonymousGifts: shopSettings?.allowAnonymousGifts ?? true,
    requireGiftApproval: shopSettings?.requireGiftApproval ?? false,
    
    // Email
    fromEmail: shop.email || "",
    fromName: shop.name || "",
    emailSignature: shopSettings?.emailSignature || "",
    
    // Shipping
    defaultShippingZone: shopSettings?.defaultShippingZone || "domestic",
    freeShippingThreshold: shopSettings?.freeShippingThreshold || 75,
    enableShippingCalculation: shopSettings?.enableShippingCalculation ?? true,
    
    // Advanced
    customCSS: shopSettings?.customCSS || "",
    googleAnalyticsId: shopSettings?.googleAnalyticsId || "",
    facebookPixelId: shopSettings?.facebookPixelId || "",
    enableDeveloperMode: shopSettings?.enableDeveloperMode ?? false
  };

  const plans = {
    current: "starter",
    available: [
      {
        id: "starter",
        name: "Starter",
        price: 0,
        features: ["Up to 10 registries", "Basic analytics", "Email support"]
      },
      {
        id: "professional",
        name: "Professional",
        price: 29,
        features: ["Unlimited registries", "Advanced analytics", "Custom branding", "Priority support"],
        isRecommended: true
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: 99,
        features: ["Everything in Professional", "API access", "Custom integrations", "Dedicated support"]
      }
    ]
  };

  return json<LoaderData>({
    shop: {
      id: shop.id,
      name: shop.name,
      domain: shop.domain,
      email: shop.email,
      currencyCode: shop.currencyCode
    },
    settings,
    plans
  });
});

export const action = withAdminAuth(async ({ request }, { admin, session, shop }) => {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    switch (intent) {
      case "update_settings": {
        const settings = Object.fromEntries(formData.entries());
        delete settings.intent;

        // Convert string booleans to actual booleans
        const booleanFields = [
          'enablePasswordProtection', 'enableGiftMessages', 'enableSocialSharing',
          'enableGroupGifting', 'enableAnalytics', 'enableEmailNotifications',
          'enableInventoryTracking', 'enableMultipleAddresses', 'allowAnonymousGifts',
          'requireGiftApproval', 'enableShippingCalculation', 'enableDeveloperMode'
        ];

        booleanFields.forEach(field => {
          if (settings[field] !== undefined) {
            settings[field] = settings[field] === 'true' || settings[field] === 'on';
          }
        });

        // Convert numeric fields
        if (settings.maxItemsPerRegistry) {
          settings.maxItemsPerRegistry = parseInt(settings.maxItemsPerRegistry as string);
        }
        if (settings.freeShippingThreshold) {
          settings.freeShippingThreshold = parseFloat(settings.freeShippingThreshold as string);
        }

        // Update settings in database
        await db.shopSettings.upsert({
          where: { shopId: shop.id },
          update: settings,
          create: { shopId: shop.id, ...settings }
        });

        return json<ActionData>({ 
          success: true, 
          message: "Settings updated successfully!" 
        });
      }

      case "reset_settings": {
        await db.shopSettings.delete({
          where: { shopId: shop.id }
        });

        return json<ActionData>({ 
          success: true, 
          message: "Settings reset to defaults!" 
        });
      }

      case "export_settings": {
        const settings = await db.shopSettings.findUnique({
          where: { shopId: shop.id }
        });

        // In a real app, you'd generate and return a download link
        return json<ActionData>({ 
          success: true, 
          message: "Settings exported successfully!" 
        });
      }

      default:
        return json<ActionData>({ 
          errors: { general: "Invalid action" } 
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Settings update error:", error);
    return json<ActionData>({ 
      errors: { general: "Failed to update settings. Please try again." } 
    }, { status: 500 });
  }
});

export default function Settings() {
  const { shop, settings, plans } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const navigation = useNavigation();

  // State management
  const [selectedTab, setSelectedTab] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Form state
  const [formSettings, setFormSettings] = useState<ShopSettings>(settings);

  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const handleSettingChange = useCallback((field: keyof ShopSettings, value: any) => {
    setFormSettings(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "update_settings");
    
    Object.entries(formSettings).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    submit(formData, { method: "post" });
    setIsDirty(false);
  }, [formSettings, submit]);

  const handleReset = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "reset_settings");
    submit(formData, { method: "post" });
    setShowResetModal(false);
    setIsDirty(false);
  }, [submit]);

  const handleExport = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "export_settings");
    submit(formData, { method: "post" });
  }, [submit]);

  // Show toast on successful action
  useState(() => {
    if (actionData?.success) {
      setShowToast(true);
    }
  });

  const isLoading = navigation.state === "submitting";

  const tabs = [
    { id: 'general', content: 'General', icon: SettingsIcon },
    { id: 'appearance', content: 'Appearance', icon: ColorIcon },
    { id: 'features', content: 'Features', icon: AppsIcon },
    { id: 'email', content: 'Email', icon: EmailIcon },
    { id: 'shipping', content: 'Shipping', icon: PackageIcon },
    { id: 'advanced', content: 'Advanced', icon: LockIcon },
    { id: 'billing', content: 'Billing', icon: BillIcon }
  ];

  const fontOptions = [
    { label: 'Inter (Recommended)', value: 'Inter' },
    { label: 'Helvetica', value: 'Helvetica' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Times New Roman', value: 'Times New Roman' }
  ];

  const visibilityOptions = [
    { label: 'Public (Searchable)', value: 'public' },
    { label: 'Private (Link only)', value: 'private' },
    { label: 'Friends only', value: 'friends' },
    { label: 'Password protected', value: 'password' }
  ];

  const shippingZoneOptions = [
    { label: 'Domestic only', value: 'domestic' },
    { label: 'North America', value: 'north_america' },
    { label: 'International', value: 'international' }
  ];

  const renderGeneralSettings = () => (
    <Layout>
      <Layout.AnnotatedSection
        id="business-settings"
        title="Business Settings"
        description="Configure basic registry behavior and limits"
      >
        <Card>
          <FormLayout>
            <Select
              label="Default registry visibility"
              options={visibilityOptions}
              value={formSettings.defaultRegistryVisibility}
              onChange={(value) => handleSettingChange('defaultRegistryVisibility', value)}
              helpText="How new registries will be visible by default"
            />

            <TextField
              label="Maximum items per registry"
              type="number"
              value={formSettings.maxItemsPerRegistry.toString()}
              onChange={(value) => handleSettingChange('maxItemsPerRegistry', parseInt(value) || 100)}
              helpText="Limit the number of items customers can add to a single registry"
              suffix="items"
            />

            <InlineGrid columns={2} gap="300">
              <Checkbox
                label="Allow anonymous gifts"
                checked={formSettings.allowAnonymousGifts}
                onChange={(checked) => handleSettingChange('allowAnonymousGifts', checked)}
                helpText="Let customers purchase gifts without providing their information"
              />

              <Checkbox
                label="Require gift approval"
                checked={formSettings.requireGiftApproval}
                onChange={(checked) => handleSettingChange('requireGiftApproval', checked)}
                helpText="Registry owners must approve gifts before they're marked as purchased"
              />
            </InlineGrid>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="shop-info"
        title="Shop Information"
        description="Basic information about your store"
      >
        <Card>
          <FormLayout>
            <TextField
              label="Shop name"
              value={shop.name}
              disabled
              helpText="This is managed through your Shopify admin"
            />

            <TextField
              label="Shop domain"
              value={shop.domain}
              disabled
              helpText="Your primary shop domain"
            />

            <TextField
              label="Contact email"
              value={shop.email}
              disabled
              helpText="Used for app notifications and support"
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
    </Layout>
  );

  const renderAppearanceSettings = () => (
    <Layout>
      <Layout.AnnotatedSection
        id="theme-settings"
        title="Theme Settings"
        description="Configure the visual appearance of your admin interface"
      >
        <Card>
          <FormLayout>
            <Box>
              <InlineStack gap="400" align="space-between">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="medium">Admin Theme</Text>
                  <Text variant="bodySm" tone="subdued">
                    Choose between light and dark theme for the admin interface
                  </Text>
                </BlockStack>
                <ThemeToggle />
              </InlineStack>
            </Box>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="brand-colors"
        title="Brand Colors"
        description="Customize the look and feel of your registry pages"
      >
        <Card>
          <FormLayout>
            <InlineGrid columns={2} gap="400">
              <Box>
                <Text variant="bodyMd" fontWeight="medium">Primary Color</Text>
                <Box paddingBlockStart="200">
                  <ColorPicker
                    color={formSettings.primaryColor}
                    onChange={(color) => handleSettingChange('primaryColor', color.hex)}
                  />
                </Box>
                <Text variant="bodySm" tone="subdued">
                  Used for buttons, links, and accents
                </Text>
              </Box>

              <Box>
                <Text variant="bodyMd" fontWeight="medium">Accent Color</Text>
                <Box paddingBlockStart="200">
                  <ColorPicker
                    color={formSettings.accentColor}
                    onChange={(color) => handleSettingChange('accentColor', color.hex)}
                  />
                </Box>
                <Text variant="bodySm" tone="subdued">
                  Used for backgrounds and borders
                </Text>
              </Box>
            </InlineGrid>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="typography"
        title="Typography"
        description="Choose fonts that match your brand"
      >
        <Card>
          <FormLayout>
            <Select
              label="Font family"
              options={fontOptions}
              value={formSettings.fontFamily}
              onChange={(value) => handleSettingChange('fontFamily', value)}
              helpText="Font used throughout your registry pages"
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="preview"
        title="Preview"
        description="See how your registries will look"
      >
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Registry Preview</Text>
            <Box 
              padding="400" 
              background="bg-surface-secondary"
              borderRadius="200"
              style={{ 
                borderColor: formSettings.primaryColor,
                fontFamily: formSettings.fontFamily 
              }}
            >
              <InlineStack gap="200" align="center">
                <Box
                  minHeight="40px"
                  minWidth="120px"
                  background="bg-fill-brand"
                  borderRadius="100"
                  style={{ backgroundColor: formSettings.primaryColor }}
                />
                <Text variant="bodyMd">Sample registry button</Text>
              </InlineStack>
            </Box>
            <Text variant="bodySm" tone="subdued">
              This is how buttons and links will appear on your registry pages
            </Text>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </Layout>
  );

  const renderFeatureSettings = () => (
    <Layout>
      <Layout.AnnotatedSection
        id="core-features"
        title="Core Features"
        description="Enable or disable key registry functionality"
      >
        <Card>
          <BlockStack gap="400">
            <SettingToggle
              action={{
                content: formSettings.enablePasswordProtection ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enablePasswordProtection', !formSettings.enablePasswordProtection)
              }}
              enabled={formSettings.enablePasswordProtection}
            >
              <Text variant="bodyMd" fontWeight="medium">Password Protection</Text>
              <Text variant="bodySm" tone="subdued">
                Allow registry owners to set passwords for private access
              </Text>
            </SettingToggle>

            <SettingToggle
              action={{
                content: formSettings.enableGiftMessages ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enableGiftMessages', !formSettings.enableGiftMessages)
              }}
              enabled={formSettings.enableGiftMessages}
            >
              <Text variant="bodyMd" fontWeight="medium">Gift Messages</Text>
              <Text variant="bodySm" tone="subdued">
                Let gift buyers include personal messages with their purchases
              </Text>
            </SettingToggle>

            <SettingToggle
              action={{
                content: formSettings.enableSocialSharing ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enableSocialSharing', !formSettings.enableSocialSharing)
              }}
              enabled={formSettings.enableSocialSharing}
            >
              <Text variant="bodyMd" fontWeight="medium">Social Sharing</Text>
              <Text variant="bodySm" tone="subdued">
                Enable sharing registries on social media platforms
              </Text>
            </SettingToggle>

            <SettingToggle
              action={{
                content: formSettings.enableGroupGifting ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enableGroupGifting', !formSettings.enableGroupGifting)
              }}
              enabled={formSettings.enableGroupGifting}
            >
              <Text variant="bodyMd" fontWeight="medium">Group Gifting</Text>
              <Text variant="bodySm" tone="subdued">
                Allow multiple people to contribute to expensive gifts
              </Text>
            </SettingToggle>

            <SettingToggle
              action={{
                content: formSettings.enableMultipleAddresses ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enableMultipleAddresses', !formSettings.enableMultipleAddresses)
              }}
              enabled={formSettings.enableMultipleAddresses}
            >
              <Text variant="bodyMd" fontWeight="medium">Multiple Shipping Addresses</Text>
              <Text variant="bodySm" tone="subdued">
                Allow different shipping addresses for different items
              </Text>
            </SettingToggle>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="analytics-features"
        title="Analytics & Tracking"
        description="Monitor performance and gather insights"
      >
        <Card>
          <BlockStack gap="400">
            <SettingToggle
              action={{
                content: formSettings.enableAnalytics ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enableAnalytics', !formSettings.enableAnalytics)
              }}
              enabled={formSettings.enableAnalytics}
            >
              <Text variant="bodyMd" fontWeight="medium">Registry Analytics</Text>
              <Text variant="bodySm" tone="subdued">
                Track registry performance, popular items, and conversion rates
              </Text>
            </SettingToggle>

            <SettingToggle
              action={{
                content: formSettings.enableInventoryTracking ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enableInventoryTracking', !formSettings.enableInventoryTracking)
              }}
              enabled={formSettings.enableInventoryTracking}
            >
              <Text variant="bodyMd" fontWeight="medium">Inventory Tracking</Text>
              <Text variant="bodySm" tone="subdued">
                Sync with Shopify inventory to show item availability
              </Text>
            </SettingToggle>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </Layout>
  );

  const renderEmailSettings = () => (
    <Layout>
      <Layout.AnnotatedSection
        id="email-config"
        title="Email Configuration"
        description="Set up email notifications and templates"
      >
        <Card>
          <FormLayout>
            <SettingToggle
              action={{
                content: formSettings.enableEmailNotifications ? 'Disable' : 'Enable',
                onAction: () => handleSettingChange('enableEmailNotifications', !formSettings.enableEmailNotifications)
              }}
              enabled={formSettings.enableEmailNotifications}
            >
              <Text variant="bodyMd" fontWeight="medium">Email Notifications</Text>
              <Text variant="bodySm" tone="subdued">
                Send automated emails for registry events
              </Text>
            </SettingToggle>

            {formSettings.enableEmailNotifications && (
              <BlockStack gap="300">
                <TextField
                  label="From email address"
                  type="email"
                  value={formSettings.fromEmail}
                  onChange={(value) => handleSettingChange('fromEmail', value)}
                  helpText="Email address used for outgoing notifications"
                />

                <TextField
                  label="From name"
                  value={formSettings.fromName}
                  onChange={(value) => handleSettingChange('fromName', value)}
                  helpText="Name displayed in email notifications"
                />

                <TextField
                  label="Email signature"
                  value={formSettings.emailSignature}
                  onChange={(value) => handleSettingChange('emailSignature', value)}
                  multiline={4}
                  helpText="Signature added to all outgoing emails"
                  placeholder="Best regards,\nThe Team"
                />
              </BlockStack>
            )}
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="email-templates"
        title="Email Templates"
        description="Customize automated email content"
      >
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Available Templates</Text>
            
            <InlineStack gap="200" align="space-between">
              <Box>
                <Text variant="bodyMd" fontWeight="medium">Registry Created</Text>
                <Text variant="bodySm" tone="subdued">
                  Sent when a new registry is created
                </Text>
              </Box>
              <Button icon={EditIcon} size="micro">Edit</Button>
            </InlineStack>
            
            <Divider />
            
            <InlineStack gap="200" align="space-between">
              <Box>
                <Text variant="bodyMd" fontWeight="medium">Gift Purchased</Text>
                <Text variant="bodySm" tone="subdued">
                  Sent when someone purchases a gift from the registry
                </Text>
              </Box>
              <Button icon={EditIcon} size="micro">Edit</Button>
            </InlineStack>
            
            <Divider />
            
            <InlineStack gap="200" align="space-between">
              <Box>
                <Text variant="bodyMd" fontWeight="medium">Registry Shared</Text>
                <Text variant="bodySm" tone="subdued">
                  Sent when a registry is shared with friends
                </Text>
              </Box>
              <Button icon={EditIcon} size="micro">Edit</Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </Layout>
  );

  const renderShippingSettings = () => (
    <Layout>
      <Layout.AnnotatedSection
        id="shipping-config"
        title="Shipping Configuration"
        description="Set up shipping zones and calculation preferences"
      >
        <Card>
          <FormLayout>
            <Select
              label="Default shipping zone"
              options={shippingZoneOptions}
              value={formSettings.defaultShippingZone}
              onChange={(value) => handleSettingChange('defaultShippingZone', value)}
              helpText="Default shipping zone for new registries"
            />

            <TextField
              label="Free shipping threshold"
              type="number"
              value={formSettings.freeShippingThreshold.toString()}
              onChange={(value) => handleSettingChange('freeShippingThreshold', parseFloat(value) || 0)}
              helpText="Minimum order value for free shipping"
              prefix="$"
            />

            <Checkbox
              label="Enable real-time shipping calculation"
              checked={formSettings.enableShippingCalculation}
              onChange={(checked) => handleSettingChange('enableShippingCalculation', checked)}
              helpText="Calculate shipping costs based on customer location and cart contents"
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
    </Layout>
  );

  const renderAdvancedSettings = () => (
    <Layout>
      <Layout.AnnotatedSection
        id="tracking-codes"
        title="Tracking & Analytics"
        description="Add external tracking and analytics codes"
      >
        <Card>
          <FormLayout>
            <TextField
              label="Google Analytics ID"
              value={formSettings.googleAnalyticsId}
              onChange={(value) => handleSettingChange('googleAnalyticsId', value)}
              helpText="Your Google Analytics tracking ID (e.g., GA-XXXXXXXX-X)"
              placeholder="GA-XXXXXXXX-X"
            />

            <TextField
              label="Facebook Pixel ID"
              value={formSettings.facebookPixelId}
              onChange={(value) => handleSettingChange('facebookPixelId', value)}
              helpText="Your Facebook Pixel ID for conversion tracking"
              placeholder="123456789012345"
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="custom-code"
        title="Custom Code"
        description="Add custom CSS or HTML to your registry pages"
      >
        <Card>
          <FormLayout>
            <TextField
              label="Custom CSS"
              value={formSettings.customCSS}
              onChange={(value) => handleSettingChange('customCSS', value)}
              multiline={8}
              helpText="Custom CSS to style your registry pages (advanced users only)"
              placeholder="/* Add your custom CSS here */"
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="developer-settings"
        title="Developer Settings"
        description="Advanced options for developers and technical users"
      >
        <Card>
          <BlockStack gap="300">
            <Checkbox
              label="Enable developer mode"
              checked={formSettings.enableDeveloperMode}
              onChange={(checked) => handleSettingChange('enableDeveloperMode', checked)}
              helpText="Show debug information and advanced options"
            />

            {formSettings.enableDeveloperMode && (
              <Banner
                title="Developer mode enabled"
                status="info"
              >
                <Text variant="bodyMd">
                  Debug information and API details will be visible in the interface.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </Layout>
  );

  const renderBillingSettings = () => (
    <Layout>
      <Layout.AnnotatedSection
        id="current-plan"
        title="Current Plan"
        description="Your current WishCraft subscription"
      >
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h3">
                  {plans.available.find(p => p.id === plans.current)?.name} Plan
                </Text>
                <Text variant="bodySm" tone="subdued">
                  ${plans.available.find(p => p.id === plans.current)?.price}/month
                </Text>
              </BlockStack>
              <Badge tone="success">Active</Badge>
            </InlineStack>

            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="medium">Included features:</Text>
              {plans.available.find(p => p.id === plans.current)?.features.map((feature, index) => (
                <InlineStack key={index} gap="200" align="start">
                  <Icon source={InfoIcon} tone="success" />
                  <Text variant="bodySm">{feature}</Text>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        id="available-plans"
        title="Available Plans"
        description="Upgrade or change your subscription"
      >
        <BlockStack gap="400">
          {plans.available.map(plan => (
            <Card key={plan.id}>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <BlockStack gap="100">
                    <InlineStack gap="200" align="start">
                      <Text variant="headingMd" as="h3">{plan.name}</Text>
                      {plan.isRecommended && <Badge tone="info">Recommended</Badge>}
                    </InlineStack>
                    <Text variant="headingLg" as="p">${plan.price}/month</Text>
                  </BlockStack>
                  
                  <Button
                    variant={plan.id === plans.current ? "secondary" : "primary"}
                    disabled={plan.id === plans.current}
                  >
                    {plan.id === plans.current ? "Current Plan" : "Upgrade"}
                  </Button>
                </InlineStack>

                <BlockStack gap="200">
                  {plan.features.map((feature, index) => (
                    <InlineStack key={index} gap="200" align="start">
                      <Icon source={InfoIcon} tone="base" />
                      <Text variant="bodySm">{feature}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          ))}
        </BlockStack>
      </Layout.AnnotatedSection>
    </Layout>
  );

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0: return renderGeneralSettings();
      case 1: return renderAppearanceSettings();
      case 2: return renderFeatureSettings();
      case 3: return renderEmailSettings();
      case 4: return renderShippingSettings();
      case 5: return renderAdvancedSettings();
      case 6: return renderBillingSettings();
      default: return renderGeneralSettings();
    }
  };

  const toastMarkup = showToast ? (
    <Toast
      content={actionData?.message || "Settings updated successfully!"}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  return (
    <Frame>
      <Page
        title="Settings"
        subtitle="Configure your WishCraft app preferences and features"
        primaryAction={{
          content: 'Save Settings',
          onAction: handleSubmit,
          loading: isLoading,
          disabled: !isDirty
        }}
        secondaryActions={[
          {
            content: 'Export Settings',
            onAction: handleExport,
            accessibilityLabel: 'Export current settings'
          },
          {
            content: 'Reset to Defaults',
            onAction: () => setShowResetModal(true),
            destructive: true,
            accessibilityLabel: 'Reset all settings to default values'
          }
        ]}
      >
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            {renderTabContent()}
          </Box>
        </Tabs>

        {/* Reset Confirmation Modal */}
        <Modal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Reset Settings"
          primaryAction={{
            content: 'Reset Settings',
            destructive: true,
            onAction: handleReset
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setShowResetModal(false)
            }
          ]}
        >
          <Modal.Section>
            <Text variant="bodyMd">
              Are you sure you want to reset all settings to their default values? 
              This action cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>

        {toastMarkup}
      </Page>
    </Frame>
  );
}