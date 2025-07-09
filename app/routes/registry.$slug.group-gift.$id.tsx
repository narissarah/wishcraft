import { LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useFetcher } from "@remix-run/react";
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Button, 
  TextField, 
  Checkbox, 
  ProgressBar,
  BlockStack,
  InlineStack,
  Badge,
  Avatar,
  Divider,
  Banner
} from "@shopify/polaris";
import { getGroupGiftProgress, addContribution } from "~/lib/group-gifting.server";
import { validateCustomerAccess } from "~/lib/customer-auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id } = params;
  
  if (!id) {
    throw new Response("Group gift not found", { status: 404 });
  }

  try {
    const groupGift = await getGroupGiftProgress(id);
    
    // Check if user has access to view this registry
    const { hasAccess, customer } = await validateCustomerAccess(
      request, 
      groupGift.registryItem.registryId
    );

    return json({
      groupGift,
      customer,
      hasAccess
    });
  } catch (error) {
    throw new Response("Group gift not found", { status: 404 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "contribute") {
    try {
      const contribution = await addContribution({
        groupGiftId: id!,
        contributorEmail: formData.get("email") as string,
        contributorName: formData.get("name") as string,
        amount: parseFloat(formData.get("amount") as string),
        isAnonymous: formData.get("isAnonymous") === "true",
        message: formData.get("message") as string || undefined,
        paymentIntentId: formData.get("paymentIntentId") as string || undefined
      });

      return json({ 
        success: true, 
        contribution,
        message: "Thank you for your contribution!" 
      });
    } catch (error) {
      return json({ 
        error: error instanceof Error ? error.message : "Failed to add contribution" 
      }, { status: 400 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function GroupGiftPage() {
  const { groupGift, customer, hasAccess } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();

  const progressPercentage = Math.min((groupGift.currentAmount / groupGift.targetAmount) * 100, 100);
  const remainingAmount = Math.max(groupGift.targetAmount - groupGift.currentAmount, 0);
  const isCompleted = groupGift.currentAmount >= groupGift.targetAmount;
  const isExpired = groupGift.deadline ? new Date() > new Date(groupGift.deadline) : false;

  if (!hasAccess) {
    return (
      <Page title="Access Denied">
        <Layout>
          <Layout.Section>
            <Card>
              <Text>You don't have access to view this group gift.</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page 
      title={groupGift.title}
      subtitle={`Group gift for ${groupGift.registryItem.productTitle}`}
      backAction={{
        content: 'Back to Registry',
        url: `/registry/${groupGift.registryItem.registry.slug}`
      }}
    >
      <Layout>
        <Layout.Section variant="oneHalf">
          {/* Progress Card */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Progress</Text>
              
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" tone="subdued">
                    ${groupGift.currentAmount.toFixed(2)} raised
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    ${groupGift.targetAmount.toFixed(2)} goal
                  </Text>
                </InlineStack>
                
                <ProgressBar 
                  progress={progressPercentage} 
                  size="large"
                  tone={isCompleted ? "success" : "primary"}
                />
                
                <InlineStack align="space-between">
                  <Text variant="bodySm" tone="subdued">
                    {groupGift.contributions.length} contributor{groupGift.contributions.length !== 1 ? 's' : ''}
                  </Text>
                  {groupGift.deadline && (
                    <Text variant="bodySm" tone="subdued">
                      {groupGift.daysRemaining > 0 
                        ? `${groupGift.daysRemaining} days left`
                        : 'Expired'
                      }
                    </Text>
                  )}
                </InlineStack>
              </BlockStack>

              {isCompleted && (
                <Banner tone="success">
                  <Text>🎉 Goal reached! Order will be placed automatically.</Text>
                </Banner>
              )}

              {isExpired && !isCompleted && (
                <Banner tone="critical">
                  <Text>This group gift has expired.</Text>
                </Banner>
              )}

              {!isCompleted && !isExpired && remainingAmount > 0 && (
                <Banner tone="info">
                  <Text>${remainingAmount.toFixed(2)} remaining to reach the goal</Text>
                </Banner>
              )}
            </BlockStack>
          </Card>

          {/* Product Details */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Gift Details</Text>
              
              <InlineStack gap="400">
                {groupGift.registryItem.productImage && (
                  <img 
                    src={groupGift.registryItem.productImage} 
                    alt={groupGift.registryItem.productTitle}
                    style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                  />
                )}
                
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold">
                    {groupGift.registryItem.productTitle}
                  </Text>
                  
                  {groupGift.registryItem.productVariantTitle && (
                    <Text variant="bodySm" tone="subdued">
                      {groupGift.registryItem.productVariantTitle}
                    </Text>
                  )}
                  
                  <Text variant="bodyMd">
                    ${groupGift.registryItem.price?.toFixed(2)}
                  </Text>
                </BlockStack>
              </InlineStack>

              {groupGift.description && (
                <Text variant="bodyMd" tone="subdued">
                  {groupGift.description}
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          {/* Contribution Form */}
          {!isCompleted && !isExpired && (
            <Card>
              <Form method="post">
                <input type="hidden" name="intent" value="contribute" />
                
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Make a Contribution</Text>
                  
                  {actionData?.error && (
                    <Banner tone="critical">
                      <Text>{actionData.error}</Text>
                    </Banner>
                  )}

                  {actionData?.success && (
                    <Banner tone="success">
                      <Text>{actionData.message}</Text>
                    </Banner>
                  )}

                  <TextField
                    label="Your Name"
                    name="name"
                    autoComplete="name"
                    value={customer?.firstName && customer?.lastName 
                      ? `${customer.firstName} ${customer.lastName}` 
                      : ''
                    }
                    required
                  />

                  <TextField
                    label="Email Address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={customer?.email || ''}
                    required
                  />

                  <TextField
                    label="Contribution Amount"
                    name="amount"
                    type="number"
                    prefix="$"
                    min={groupGift.minimumContribution}
                    max={remainingAmount}
                    step="0.01"
                    helpText={`Minimum: $${groupGift.minimumContribution.toFixed(2)}`}
                    required
                  />

                  <TextField
                    label="Message (Optional)"
                    name="message"
                    multiline={2}
                    placeholder="Add a personal message..."
                  />

                  {groupGift.allowAnonymous && (
                    <Checkbox
                      label="Contribute anonymously"
                      name="isAnonymous"
                      helpText="Your name won't be shown to others"
                    />
                  )}

                  <Button 
                    variant="primary" 
                    size="large" 
                    submit
                    loading={fetcher.state === "submitting"}
                  >
                    Contribute Now
                  </Button>

                  <Text variant="bodySm" tone="subdued" alignment="center">
                    Secure payment processing • Refund if goal not met
                  </Text>
                </BlockStack>
              </Form>
            </Card>
          )}

          {/* Contributors List */}
          {groupGift.showContributorList && groupGift.contributions.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Contributors</Text>
                
                <BlockStack gap="300">
                  {groupGift.contributions.map((contribution: any) => (
                    <InlineStack 
                      key={contribution.id} 
                      align="space-between"
                      blockAlign="center"
                    >
                      <InlineStack gap="300" blockAlign="center">
                        <Avatar 
                          size="small" 
                          name={contribution.isAnonymous ? 'Anonymous' : contribution.contributorName}
                        />
                        
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="medium">
                            {contribution.isAnonymous ? 'Anonymous' : contribution.contributorName}
                          </Text>
                          
                          {contribution.message && !contribution.isAnonymous && (
                            <Text variant="bodySm" tone="subdued">
                              "{contribution.message}"
                            </Text>
                          )}
                          
                          <Text variant="bodySm" tone="subdued">
                            {new Date(contribution.createdAt).toLocaleDateString()}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      
                      <Badge tone="success">
                        ${contribution.amount.toFixed(2)}
                      </Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          )}

          {/* Organizer Info */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Organized by</Text>
              
              <InlineStack gap="300" blockAlign="center">
                <Avatar size="medium" name={groupGift.organizerName} />
                
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="medium">
                    {groupGift.organizerName}
                  </Text>
                  
                  <Text variant="bodySm" tone="subdued">
                    Created {new Date(groupGift.createdAt).toLocaleDateString()}
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}