// Built for Shopify Compliance Dashboard
import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Layout, Text, Badge, ProgressBar, DataTable, Icon, Banner, List , InlineStack, BlockStack } from "@shopify/polaris";
import { CheckCircleIcon, AlertCircleIcon, InfoIcon } from "@shopify/polaris-icons";
import { authenticate } from "~/shopify.server";
import { checkBuiltForShopifyCompliance, getWebhookReliabilityMetrics } from "~/lib/built-for-shopify.server";
import indexStyles from "~/styles/index.css";
// Circuit breaker monitoring removed for 2025 GraphQL-only compliance

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: indexStyles }
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  
  // Get compliance status
  const compliance = await checkBuiltForShopifyCompliance(shopId);
  
  // Get webhook metrics
  const webhookMetrics = await getWebhookReliabilityMetrics(shopId);
  
  // Circuit breaker monitoring removed for 2025 GraphQL-only compliance
  const circuitBreakerStates = [];
  const circuitBreakersHealthy = true;
  
  return json({
    shopId,
    compliance,
    webhookMetrics,
    circuitBreakerStates,
    circuitBreakersHealthy,
  });
}

export default function ComplianceDashboard() {
  const { compliance, webhookMetrics, circuitBreakerStates, circuitBreakersHealthy } = useLoaderData<typeof loader>();
  
  const complianceItems = Object.entries(compliance.checks).map(([key, value]) => ({
    key,
    name: formatCheckName(key),
    status: value ? "Pass" : "Fail",
    badge: value ? "Pass" : "Fail",
  }));
  
  const webhookRows = webhookMetrics.map(metric => [
    metric.topic,
    metric.totalReceived.toString(),
    metric.successfullyProcessed.toString(),
    metric.failedProcessing.toString(),
    `${metric.averageProcessingTime.toFixed(2)}ms`,
    `${((metric.successfullyProcessed / metric.totalReceived) * 100).toFixed(1)}%`,
  ]);
  
  const circuitBreakerRows = Object.entries(circuitBreakerStates).map(([name, { state, metrics }]) => [
    formatCircuitBreakerName(name),
    state,
    metrics.totalRequests.toString(),
    metrics.failedRequests.toString(),
    `${metrics.errorRate ? metrics.errorRate.toFixed(1) : "0.0"}%`,
    state === "CLOSED" ? "Healthy" : state === "OPEN" ? "Open" : "Half Open",
  ]);
  
  return (
    <Page
      title="Built for Shopify Compliance"
      subtitle="Monitor your app's compliance with Shopify's quality standards"
    >
      <Layout>
        {/* Overall Compliance Score */}
        <Layout.Section>
          <Card>
            <div className="compliance-card-content">
              <Text as="h2" variant="headingLg">
                Overall Compliance Score
              </Text>
              <div className="compliance-progress-wrapper">
                <ProgressBar 
                  progress={compliance.complianceScore} 
                  tone={compliance.complianceScore >= 90 ? "success" : "critical"}
                />
              </div>
              <Text as="p" variant="headingXl">
                {compliance.complianceScore.toFixed(0)}%
              </Text>
              {compliance.isCompliant ? (
                <Banner tone="success" icon={CheckCircleIcon}>
                  Your app meets all Built for Shopify requirements!
                </Banner>
              ) : (
                <Banner tone="warning" icon={AlertCircleIcon}>
                  Some compliance requirements need attention.
                </Banner>
              )}
            </div>
          </Card>
        </Layout.Section>
        
        {/* Compliance Checklist */}
        <Layout.Section>
          <Card>
            <div className="compliance-card-content">
              <Text as="h2" variant="headingLg">
                Compliance Checklist
              </Text>
              <div className="compliance-table-wrapper">
                <DataTable
                  columnContentTypes={["text", "text"]}
                  headings={["Requirement", "Status"]}
                  rows={complianceItems.map(item => [item.name, item.badge])}
                />
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        {/* Webhook Reliability */}
        <Layout.Section>
          <Card>
            <div className="compliance-card-content">
              <Text as="h2" variant="headingLg">
                Webhook Reliability (Last 24 Hours)
              </Text>
              <div className="compliance-table-wrapper">
                {webhookRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric", "numeric", "numeric", "numeric"]}
                    headings={["Topic", "Received", "Processed", "Failed", "Avg Time", "Success Rate"]}
                    rows={webhookRows}
                  />
                ) : (
                  <Banner icon={InfoIcon}>
                    No webhook activity in the last 24 hours.
                  </Banner>
                )}
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        {/* Circuit Breaker Health */}
        <Layout.Section>
          <Card>
            <div className="compliance-card-content">
              <Text as="h2" variant="headingLg">
                API Circuit Breaker Health
              </Text>
              <div className="compliance-table-wrapper">
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "text"]}
                  headings={["Service", "State", "Requests", "Errors", "Error Rate", "Health"]}
                  rows={circuitBreakerRows}
                />
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        {/* Recommendations */}
        {!compliance.isCompliant && (
          <Layout.Section>
            <Card>
              <div className="compliance-card-content">
                <Text as="h2" variant="headingLg">
                  Recommendations
                </Text>
                <div className="compliance-table-wrapper">
                  <List type="bullet">
                    {!compliance.checks.performanceCompliant && (
                      <List.Item>
                        Optimize performance to meet Core Web Vitals targets:
                        <List type="bullet">
                          <List.Item>LCP should be under 2.5 seconds</List.Item>
                          <List.Item>FID should be under 100 milliseconds</List.Item>
                          <List.Item>CLS should be under 0.1</List.Item>
                        </List>
                      </List.Item>
                    )}
                    {!compliance.checks.webhooksConfigured && (
                      <List.Item>
                        Implement all required webhooks for GDPR compliance
                      </List.Item>
                    )}
                    {!compliance.checks.errorRecoveryImplemented && (
                      <List.Item>
                        Implement proper error recovery mechanisms with retry logic
                      </List.Item>
                    )}
                  </List>
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

function formatCheckName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatCircuitBreakerName(key: string): string {
  const names: Record<string, string> = {
    graphqlApi: "GraphQL Admin API",
    restApi: "REST Admin API",
    webhookProcessing: "Webhook Processing",
    externalService: "External Services",
  };
  return names[key] || key;
}