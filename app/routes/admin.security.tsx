import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Badge,
  Text,
  Grid,
  ProgressBar,
  ButtonGroup,
  Button,
  Banner,
  List,
  Layout,
  Divider,
  Box,
  InlineStack,
  BlockStack
} from "@shopify/polaris";
import { AlertTriangleIcon, CheckCircleIcon, XCircleIcon } from "@shopify/polaris-icons";
import { requireAdminAuth } from "~/lib/auth.server";
import { securityMonitor } from "~/lib/security-monitoring.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminAuth(request);
  
  const dashboardData = await securityMonitor.getDashboardData();
  
  return json(dashboardData);
}

export default function SecurityDashboard() {
  const { metrics, recentEvents, activeAlerts, threatTrends } = useLoaderData<typeof loader>();

  const getSecurityScoreColor = (score: number) => {
    if (score >= 90) return "success";
    if (score >= 70) return "warning";
    return "critical";
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "info",
      medium: "warning", 
      high: "critical",
      critical: "critical"
    };
    return colors[severity as keyof typeof colors] || "info";
  };

  const eventTableRows = recentEvents.map(event => [
    event.timestamp.toLocaleString(),
    event.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    <Badge key={event.id} tone={getSeverityBadge(event.severity)}>
      {event.severity}
    </Badge>,
    event.source,
    event.shop || 'N/A',
    event.ip || 'N/A'
  ]);

  const alertTableRows = activeAlerts.map(alert => [
    alert.timestamp.toLocaleString(),
    alert.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    <Badge key={alert.id} tone={getSeverityBadge(alert.severity)}>
      {alert.severity}
    </Badge>,
    alert.message,
    alert.events.length.toString()
  ]);

  return (
    <Page 
      title="Security Dashboard" 
      primaryAction={{ content: "Refresh", onAction: () => window.location.reload() }}
      secondaryActions={[
        { content: "Download Report", onAction: () => console.log("Download report") },
        { content: "Settings", onAction: () => console.log("Security settings") }
      ]}
    >
      <Layout>
        <Layout.Section>
          {/* Security Score and Metrics */}
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="center" gap="200">
                    <CheckCircleIcon />
                    <Text variant="headingMd" as="h3">Security Score</Text>
                  </InlineStack>
                  <Text variant="heading3xl" as="p" alignment="center">
                    {metrics.securityScore}%
                  </Text>
                  <ProgressBar 
                    progress={metrics.securityScore} 
                    color={getSecurityScoreColor(metrics.securityScore)}
                  />
                  <Text variant="bodySm" tone="subdued" alignment="center" as="p">
                    Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
                  </Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
            
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="center" gap="200">
                    <AlertTriangleIcon />
                    <Text variant="headingMd" as="h3">Active Alerts</Text>
                  </InlineStack>
                  <Text variant="heading3xl" as="p" alignment="center" tone={metrics.activeAlerts > 0 ? "critical" : "success"}>
                    {metrics.activeAlerts}
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center" as="p">
                    Unresolved security alerts
                  </Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
            
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="center" gap="200">
                    <XCircleIcon />
                    <Text variant="headingMd" as="h3">Critical Events</Text>
                  </InlineStack>
                  <Text variant="heading3xl" as="p" alignment="center" tone={metrics.criticalEvents > 0 ? "critical" : "success"}>
                    {metrics.criticalEvents}
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center" as="p">
                    In last 24 hours
                  </Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
            
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="center" gap="200">
                    <CheckCircleIcon />
                    <Text variant="headingMd" as="h3">Total Events</Text>
                  </InlineStack>
                  <Text variant="heading3xl" as="p" alignment="center">
                    {metrics.totalEvents}
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center" as="p">
                    Security events tracked
                  </Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Active Security Alerts</Text>
                  <Badge tone="critical">{activeAlerts.length}</Badge>
                </InlineStack>
                
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'numeric']}
                  headings={['Time', 'Type', 'Severity', 'Message', 'Events']}
                  rows={alertTableRows}
                  truncate
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Top Threats */}
        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Top Security Threats</Text>
                  
                  {metrics.topThreats.length > 0 ? (
                    <List>
                      {metrics.topThreats.map((threat, index) => (
                        <List.Item key={index}>
                          <InlineStack align="space-between">
                            <Text variant="bodyMd" as="span">
                              {threat.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Text>
                            <Badge>{threat.count}</Badge>
                          </InlineStack>
                        </List.Item>
                      ))}
                    </List>
                  ) : (
                    <Text variant="bodySm" tone="subdued" as="p">No threats detected</Text>
                  )}
                </BlockStack>
              </Card>
            </Grid.Cell>
            
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Threat Trends (24h)</Text>
                  
                  {/* Simple trend visualization */}
                  <div style={{ height: '200px', display: 'flex', alignItems: 'end', gap: '2px' }}>
                    {threatTrends.map((trend, index) => (
                      <div
                        key={index}
                        style={{
                          height: `${Math.max(trend.count * 10, 2)}px`,
                          width: '8px',
                          backgroundColor: trend.count > 5 ? '#d72c0d' : trend.count > 2 ? '#ffc453' : '#008060',
                          borderRadius: '1px'
                        }}
                        title={`${new Date(trend.date).toLocaleTimeString()}: ${trend.count} events`}
                      />
                    ))}
                  </div>
                  
                  <Text variant="bodySm" tone="subdued" as="p">
                    Hourly security events for the last 24 hours
                  </Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        {/* Recent Events */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Recent Security Events</Text>
              
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Time', 'Event Type', 'Severity', 'Source', 'Shop', 'IP']}
                rows={eventTableRows}
                truncate
              />
              
              {recentEvents.length === 0 && (
                <Banner tone="success">
                  <Text as="p">No security events detected recently. Your application is secure.</Text>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Security Recommendations */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Security Recommendations</Text>
              
              <List>
                <List.Item>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="span">Enable two-factor authentication for all admin accounts</Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Add an extra layer of security to prevent unauthorized access
                    </Text>
                  </BlockStack>
                </List.Item>
                
                <List.Item>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="span">Regular security audits and penetration testing</Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Schedule monthly security assessments to identify vulnerabilities
                    </Text>
                  </BlockStack>
                </List.Item>
                
                <List.Item>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="span">Monitor API rate limits and implement alerting</Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Set up automated alerts for suspicious API usage patterns
                    </Text>
                  </BlockStack>
                </List.Item>
                
                <List.Item>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="span">Keep dependencies updated and scan for vulnerabilities</Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Regularly update packages and run security scans on dependencies
                    </Text>
                  </BlockStack>
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}