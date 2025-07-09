import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  Button,
  ButtonGroup,
  InlineStack,
  Box,
  ProgressBar,
  Badge,
  Icon,
  Link,
  Banner,
  Modal,
  Form,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  RadioButton,
  Collapsible,
  VideoThumbnail,
  Divider,
  CalloutCard,
  EmptyState,
  Spinner
} from "@shopify/polaris";
import {
  CheckIcon,
  CheckCircleIcon,
  CircleChevronRightIcon,
  PlayIcon,
  ExternalIcon,
  AppsIcon,
  SettingsIcon,
  ProductIcon,
  PersonIcon,
  ChartVerticalIcon,
  MagicIcon,
  InfoIcon,
  StarIcon
} from "@shopify/polaris-icons";
import { withAdminAuth } from "~/lib/middleware.server";
import { db } from "~/lib/db.server";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
  estimatedTime: string;
  category: 'setup' | 'configuration' | 'content' | 'launch';
  action?: {
    label: string;
    url?: string;
    onClick?: () => void;
  };
  resources?: Array<{
    title: string;
    type: 'video' | 'article' | 'tutorial';
    url: string;
    duration?: string;
  }>;
}

interface OnboardingData {
  currentStep: number;
  completionPercentage: number;
  steps: OnboardingStep[];
  shopInfo: {
    hasProducts: boolean;
    hasTheme: boolean;
    hasOrders: boolean;
    planLevel: string;
  };
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: any;
    isUnlocked: boolean;
    unlockedAt?: string;
  }>;
}

interface LoaderData {
  onboarding: OnboardingData;
  shop: {
    id: string;
    name: string;
    domain: string;
  };
}

/**
 * Merchant Onboarding Flow
 * Progressive disclosure onboarding with gamification and interactive guidance
 */
export const loader = withAdminAuth(async ({ request }, { admin, session, shop }) => {
  // Get shop settings to determine completion status
  const shopSettings = await db.shopSettings.findUnique({
    where: { shopId: shop.id }
  });

  // Get registry count
  const registryCount = await db.registry.count({
    where: { shopId: shop.id }
  });

  // Mock shop info (in production, fetch from Shopify API)
  const shopInfo = {
    hasProducts: true, // Check via GraphQL
    hasTheme: true, // Check if theme extension is installed
    hasOrders: false, // Check order count
    planLevel: 'starter' // From billing/subscription
  };

  // Define onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to WishCraft',
      description: 'Get familiar with your new gift registry app',
      isCompleted: true, // Always completed when they reach onboarding
      isRequired: true,
      estimatedTime: '2 min',
      category: 'setup',
      action: {
        label: 'Watch Welcome Video',
        onClick: () => {}
      },
      resources: [
        {
          title: 'WishCraft Overview',
          type: 'video',
          url: '/videos/welcome',
          duration: '3:24'
        }
      ]
    },
    {
      id: 'basic-settings',
      title: 'Configure Basic Settings',
      description: 'Set up your app preferences, colors, and basic features',
      isCompleted: !!shopSettings,
      isRequired: true,
      estimatedTime: '5 min',
      category: 'setup',
      action: {
        label: 'Open Settings',
        url: '/admin/settings'
      },
      resources: [
        {
          title: 'Settings Configuration Guide',
          type: 'article',
          url: '/help/settings'
        }
      ]
    },
    {
      id: 'create-test-registry',
      title: 'Create Your First Registry',
      description: 'Create a test registry to understand the customer experience',
      isCompleted: registryCount > 0,
      isRequired: true,
      estimatedTime: '10 min',
      category: 'content',
      action: {
        label: 'Create Registry',
        url: '/admin/registries/new'
      },
      resources: [
        {
          title: 'Creating Registries Tutorial',
          type: 'tutorial',
          url: '/tutorials/create-registry',
          duration: '5:12'
        }
      ]
    },
    {
      id: 'install-theme-extension',
      title: 'Install Theme Extension',
      description: 'Add registry functionality to your storefront theme',
      isCompleted: shopInfo.hasTheme,
      isRequired: true,
      estimatedTime: '3 min',
      category: 'configuration',
      action: {
        label: 'Install Extension',
        url: '/admin/themes'
      }
    },
    {
      id: 'setup-product-suggestions',
      title: 'Configure Product Suggestions',
      description: 'Set up AI-powered product recommendations for your customers',
      isCompleted: false,
      isRequired: false,
      estimatedTime: '8 min',
      category: 'configuration',
      action: {
        label: 'Setup Suggestions',
        url: '/admin/products'
      }
    },
    {
      id: 'customize-emails',
      title: 'Customize Email Templates',
      description: 'Personalize email notifications to match your brand',
      isCompleted: false,
      isRequired: false,
      estimatedTime: '10 min',
      category: 'configuration',
      action: {
        label: 'Edit Templates',
        url: '/admin/settings?tab=email'
      }
    },
    {
      id: 'test-purchase',
      title: 'Test a Gift Purchase',
      description: 'Make a test purchase to ensure everything works correctly',
      isCompleted: false,
      isRequired: false,
      estimatedTime: '5 min',
      category: 'launch',
      action: {
        label: 'Test Purchase',
        url: '/admin/registries'
      }
    },
    {
      id: 'launch-promotion',
      title: 'Launch & Promote',
      description: 'Announce your gift registry feature to customers',
      isCompleted: false,
      isRequired: false,
      estimatedTime: '15 min',
      category: 'launch',
      action: {
        label: 'View Marketing Kit',
        url: '/admin/marketing'
      }
    }
  ];

  // Calculate completion
  const completedSteps = steps.filter(step => step.isCompleted).length;
  const completionPercentage = Math.round((completedSteps / steps.length) * 100);
  const currentStep = steps.findIndex(step => !step.isCompleted);

  // Define achievements
  const achievements = [
    {
      id: 'first-registry',
      title: 'Registry Creator',
      description: 'Created your first gift registry',
      icon: StarIcon,
      isUnlocked: registryCount > 0,
      unlockedAt: registryCount > 0 ? new Date().toISOString() : undefined
    },
    {
      id: 'settings-configured',
      title: 'Configurator',
      description: 'Completed basic app setup',
      icon: SettingsIcon,
      isUnlocked: !!shopSettings,
      unlockedAt: shopSettings ? new Date().toISOString() : undefined
    },
    {
      id: 'theme-integrated',
      title: 'Integration Master',
      description: 'Successfully integrated with your theme',
      icon: AppsIcon,
      isUnlocked: shopInfo.hasTheme,
      unlockedAt: shopInfo.hasTheme ? new Date().toISOString() : undefined
    },
    {
      id: 'launch-ready',
      title: 'Launch Expert',
      description: 'Completed all essential setup steps',
      icon: CheckIcon,
      isUnlocked: completionPercentage >= 75,
      unlockedAt: completionPercentage >= 75 ? new Date().toISOString() : undefined
    }
  ];

  const onboarding: OnboardingData = {
    currentStep: currentStep === -1 ? steps.length - 1 : currentStep,
    completionPercentage,
    steps,
    shopInfo,
    achievements
  };

  return json<LoaderData>({
    onboarding,
    shop: {
      id: shop.id,
      name: shop.name,
      domain: shop.domain
    }
  });
});

export const action = withAdminAuth(async ({ request }, { admin, session, shop }) => {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "complete_step":
      const stepId = formData.get("stepId") as string;
      // Mark step as completed in database
      // In production, you'd track completion status
      break;
    
    case "skip_onboarding":
      // Mark onboarding as skipped
      break;
      
    default:
      break;
  }

  return json({ success: true });
});

export default function Onboarding() {
  const { onboarding, shop } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const navigation = useNavigation();

  // State management
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);

  const handleStepClick = useCallback((stepId: string) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  }, [expandedStep]);

  const handleVideoPlay = useCallback((resource: any) => {
    setSelectedVideo(resource);
    setShowVideoModal(true);
  }, []);

  const handleCompleteStep = useCallback((stepId: string) => {
    const formData = new FormData();
    formData.append("intent", "complete_step");
    formData.append("stepId", stepId);
    submit(formData, { method: "post" });
  }, [submit]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'setup': return 'success';
      case 'configuration': return 'info';
      case 'content': return 'attention';
      case 'launch': return 'warning';
      default: return 'new';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'setup': return SettingsIcon;
      case 'configuration': return AppsIcon;
      case 'content': return ProductIcon;
      case 'launch': return ChartVerticalIcon;
      default: return InfoIcon;
    }
  };

  const formatTime = (timeStr: string) => {
    return timeStr.replace(' min', ' minutes');
  };

  const isLoading = navigation.state === "submitting";

  // Group steps by category
  const stepsByCategory = onboarding.steps.reduce((groups, step) => {
    if (!groups[step.category]) {
      groups[step.category] = [];
    }
    groups[step.category].push(step);
    return groups;
  }, {} as Record<string, OnboardingStep[]>);

  const categoryOrder = ['setup', 'configuration', 'content', 'launch'];

  return (
    <Page
      title={`Welcome to WishCraft, ${shop.name}!`}
      subtitle="Let's get your gift registry app set up and running"
      primaryAction={{
        content: onboarding.completionPercentage === 100 ? 'View Dashboard' : 'Continue Setup',
        url: onboarding.completionPercentage === 100 ? '/admin' : undefined,
        onAction: onboarding.completionPercentage < 100 ? () => {
          const nextStep = onboarding.steps[onboarding.currentStep];
          if (nextStep?.action?.url) {
            window.location.href = nextStep.action.url;
          }
        } : undefined
      }}
      secondaryActions={[
        {
          content: 'View Achievements',
          onAction: () => setShowAchievements(true)
        },
        {
          content: 'Skip Onboarding',
          url: '/admin'
        }
      ]}
    >
      <BlockStack gap="500">
        {/* Progress Overview */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">Setup Progress</Text>
                <Text variant="bodySm" tone="subdued">
                  {onboarding.steps.filter(s => s.isCompleted).length} of {onboarding.steps.length} steps completed
                </Text>
              </BlockStack>
              <Text variant="heading2xl" as="p">{onboarding.completionPercentage}%</Text>
            </InlineStack>
            
            <ProgressBar progress={onboarding.completionPercentage} size="large" />
            
            {onboarding.completionPercentage === 100 && (
              <Banner
                title="🎉 Congratulations! Your setup is complete!"
                status="success"
                action={{
                  content: 'View Dashboard',
                  url: '/admin'
                }}
              >
                <Text variant="bodyMd">
                  You're all set! Your gift registry is ready to help customers create amazing wish lists.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {/* Quick Stats */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Registry Count</Text>
                <Icon source={ProductIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                {onboarding.steps.find(s => s.id === 'create-test-registry')?.isCompleted ? '1+' : '0'}
              </Text>
              <Text variant="bodySm" tone="subdued">Registries created</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Theme Integration</Text>
                <Icon source={AppsIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                {onboarding.shopInfo.hasTheme ? '✓' : '○'}
              </Text>
              <Text variant="bodySm" tone="subdued">Extension installed</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Configuration</Text>
                <Icon source={SettingsIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                {onboarding.steps.find(s => s.id === 'basic-settings')?.isCompleted ? '✓' : '○'}
              </Text>
              <Text variant="bodySm" tone="subdued">Settings configured</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">Achievements</Text>
                <Icon source={StarIcon} tone="base" />
              </InlineStack>
              <Text variant="heading2xl" as="p">
                {onboarding.achievements.filter(a => a.isUnlocked).length}
              </Text>
              <Text variant="bodySm" tone="subdued">Unlocked</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Setup Steps by Category */}
        {categoryOrder.map(category => {
          const categorySteps = stepsByCategory[category];
          if (!categorySteps) return null;

          const completedInCategory = categorySteps.filter(s => s.isCompleted).length;
          const categoryPercentage = Math.round((completedInCategory / categorySteps.length) * 100);

          return (
            <Card key={category}>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <InlineStack gap="300" align="center">
                    <Icon source={getCategoryIcon(category)} tone="base" />
                    <BlockStack gap="100">
                      <Text variant="headingMd" as="h3">
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        {completedInCategory} of {categorySteps.length} completed
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Badge tone={getCategoryColor(category)}>
                    {categoryPercentage}%
                  </Badge>
                </InlineStack>

                <ProgressBar progress={categoryPercentage} size="small" />

                <BlockStack gap="300">
                  {categorySteps.map((step, index) => (
                    <Box key={step.id}>
                      <InlineStack align="space-between" blockAlign="start">
                        <InlineStack gap="300" align="start">
                          <Box paddingBlockStart="050">
                            {step.isCompleted ? (
                              <Icon source={CheckCircleIcon} tone="success" />
                            ) : (
                              <Icon 
                                source={CircleChevronRightIcon} 
                                tone={step.isRequired ? "critical" : "subdued"}
                              />
                            )}
                          </Box>
                          
                          <BlockStack gap="200">
                            <InlineStack gap="200" align="start">
                              <Text 
                                variant="bodyMd" 
                                fontWeight="medium"
                                tone={step.isCompleted ? "subdued" : undefined}
                                textDecorationLine={step.isCompleted ? "line-through" : undefined}
                              >
                                {step.title}
                              </Text>
                              {step.isRequired && !step.isCompleted && (
                                <Badge tone="critical" size="small">Required</Badge>
                              )}
                              <Badge size="small">{formatTime(step.estimatedTime)}</Badge>
                            </InlineStack>
                            
                            <Text variant="bodySm" tone="subdued">
                              {step.description}
                            </Text>

                            {/* Action Button */}
                            {!step.isCompleted && step.action && (
                              <Box paddingBlockStart="200">
                                <Button
                                  variant={step.isRequired ? "primary" : "secondary"}
                                  size="micro"
                                  url={step.action.url}
                                  onClick={step.action.onClick}
                                  icon={step.action.url ? ExternalIcon : undefined}
                                >
                                  {step.action.label}
                                </Button>
                              </Box>
                            )}

                            {/* Resources */}
                            {step.resources && step.resources.length > 0 && (
                              <Collapsible
                                open={expandedStep === step.id}
                                id={`resources-${step.id}`}
                                transition={{ duration: '150ms', timingFunction: 'ease' }}
                              >
                                <Box paddingBlockStart="200">
                                  <BlockStack gap="200">
                                    <Text variant="bodyMd" fontWeight="medium">
                                      Helpful Resources:
                                    </Text>
                                    {step.resources.map((resource, idx) => (
                                      <InlineStack key={idx} gap="200" align="start">
                                        <Icon 
                                          source={resource.type === 'video' ? PlayIcon : InfoIcon} 
                                          tone="base" 
                                        />
                                        <InlineStack gap="100" align="start">
                                          <Link 
                                            url={resource.url}
                                            external={resource.type === 'video'}
                                            onClick={resource.type === 'video' ? 
                                              () => handleVideoPlay(resource) : undefined
                                            }
                                          >
                                            <Text variant="bodySm">{resource.title}</Text>
                                          </Link>
                                          {resource.duration && (
                                            <Text variant="bodySm" tone="subdued">
                                              ({resource.duration})
                                            </Text>
                                          )}
                                        </InlineStack>
                                      </InlineStack>
                                    ))}
                                  </BlockStack>
                                </Box>
                              </Collapsible>
                            )}
                          </BlockStack>
                        </InlineStack>

                        {/* Expand/Collapse Button */}
                        {step.resources && step.resources.length > 0 && (
                          <Button
                            variant="plain"
                            size="micro"
                            onClick={() => handleStepClick(step.id)}
                            ariaExpanded={expandedStep === step.id}
                            ariaControls={`resources-${step.id}`}
                          >
                            {expandedStep === step.id ? 'Hide' : 'Show'} Resources
                          </Button>
                        )}
                      </InlineStack>
                      
                      {index < categorySteps.length - 1 && <Divider />}
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          );
        })}

        {/* Call to Action */}
        {onboarding.completionPercentage < 100 && (
          <CalloutCard
            title="Ready to continue?"
            illustration="/api/placeholder/300/200"
            primaryAction={{
              content: 'Continue Setup',
              url: onboarding.steps[onboarding.currentStep]?.action?.url || '/admin'
            }}
          >
            <Text variant="bodyMd">
              Complete the remaining {onboarding.steps.filter(s => !s.isCompleted).length} steps 
              to get the most out of WishCraft. Each step brings you closer to launching 
              an amazing gift registry experience!
            </Text>
          </CalloutCard>
        )}
      </BlockStack>

      {/* Video Modal */}
      <Modal
        open={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        title={selectedVideo?.title}
        large
      >
        <Modal.Section>
          {selectedVideo && (
            <VideoThumbnail
              videoLength={selectedVideo.duration}
              thumbnailUrl="/api/placeholder/600/400"
              onClick={() => {}}
            />
          )}
        </Modal.Section>
      </Modal>

      {/* Achievements Modal */}
      <Modal
        open={showAchievements}
        onClose={() => setShowAchievements(false)}
        title="Your Achievements"
        primaryAction={{
          content: 'Close',
          onAction: () => setShowAchievements(false)
        }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {onboarding.achievements.map(achievement => (
              <InlineStack key={achievement.id} gap="300" align="start">
                <Icon 
                  source={achievement.icon} 
                  tone={achievement.isUnlocked ? "success" : "subdued"} 
                />
                <BlockStack gap="100">
                  <InlineStack gap="200" align="start">
                    <Text 
                      variant="bodyMd" 
                      fontWeight="medium"
                      tone={achievement.isUnlocked ? undefined : "subdued"}
                    >
                      {achievement.title}
                    </Text>
                    {achievement.isUnlocked ? (
                      <Badge tone="success">Unlocked</Badge>
                    ) : (
                      <Badge>Locked</Badge>
                    )}
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    {achievement.description}
                  </Text>
                  {achievement.unlockedAt && (
                    <Text variant="bodySm" tone="subdued">
                      Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </Text>
                  )}
                </BlockStack>
              </InlineStack>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}