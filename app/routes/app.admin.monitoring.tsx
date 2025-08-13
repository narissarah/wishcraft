import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import { 
  getDatabaseMetrics, 
  getWorkingSetSize, 
  getTableSizes,
  getConnectionStats,
  checkPerformanceCompliance,
  getDailyPerformanceMetrics
} from "~/lib/db-monitoring.server";
import { 
  getNeonStatus, 
  getNeonOptimizations, 
  estimateNeonCosts 
} from "~/lib/neon-status.server";
import { Card, Page, Layout, Text, Badge, DataTable, Stack, Heading, Box } from "@shopify/polaris";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  // Only allow shop owners/admins to view monitoring
  const [
    metrics, 
    workingSet, 
    tableSizes, 
    connectionStats, 
    compliance,
    performanceMetrics,
    neonStatus,
    neonOptimizations,
    neonCosts
  ] = await Promise.all([
    getDatabaseMetrics(),
    getWorkingSetSize(),
    getTableSizes(),
    getConnectionStats(),
    checkPerformanceCompliance(),
    getDailyPerformanceMetrics(session.shop),
    getNeonStatus(),
    getNeonOptimizations(),
    estimateNeonCosts()
  ]);
  
  return json({ 
    metrics, 
    workingSet, 
    tableSizes, 
    connectionStats, 
    compliance,
    performanceMetrics,
    neonStatus,
    neonOptimizations,
    neonCosts,
    neonDashboard: "https://console.neon.tech"
  });
}

export default function Monitoring() {
  const { 
    metrics, 
    workingSet, 
    tableSizes, 
    connectionStats, 
    compliance,
    performanceMetrics,
    neonStatus,
    neonOptimizations,
    neonCosts,
    neonDashboard
  } = useLoaderData<typeof loader>();
  
  const cacheHitRate = (workingSet.hit_rate * 100).toFixed(2);
  
  // Format table sizes for DataTable
  const tableSizeRows = tableSizes.map((table: any) => [
    table.tablename,
    table.size,
  ]);
  
  // Format slow queries for DataTable
  const slowQueryRows = metrics.slowQueries.map((query: any) => [
    query.query.substring(0, 50) + '...',
    `${query.mean_exec_time.toFixed(2)}ms`,
    query.calls.toString(),
  ]);
  
  return (
    <Page
      title="Database Monitoring"
      subtitle="Neon PostgreSQL performance metrics"
      primaryAction={{
        content: 'View Neon Dashboard',
        url: neonDashboard,
        external: true,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Stack vertical>
              <Heading>Built for Shopify Compliance</Heading>
              <Box paddingBlockStart="200">
                {compliance.compliant ? (
                  <Badge tone="success">Compliant</Badge>
                ) : (
                  <Badge tone="warning">Issues Detected</Badge>
                )}
              </Box>
              
              {compliance.issues.length > 0 && (
                <Stack vertical gap="200">
                  {compliance.issues.map((issue: any, index: number) => (
                    <Box key={index} padding="200" background="bg-surface-warning">
                      <Stack vertical gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          {issue.message}
                        </Text>
                        <Text as="p" variant="bodySm">
                          {issue.recommendation}
                        </Text>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
              
              <Box paddingBlockStart="400">
                <Stack vertical gap="200">
                  <Text as="p" variant="bodySm">
                    <strong>Web Vitals (24h average):</strong>
                  </Text>
                  <Text as="p" variant="bodySm">
                    LCP: {performanceMetrics.aggregates.avgLCP.toFixed(0)}ms 
                    {performanceMetrics.aggregates.avgLCP <= 2500 ? ' ✓' : ' ✗'}
                  </Text>
                  <Text as="p" variant="bodySm">
                    CLS: {performanceMetrics.aggregates.avgCLS.toFixed(3)} 
                    {performanceMetrics.aggregates.avgCLS <= 0.1 ? ' ✓' : ' ✗'}
                  </Text>
                  <Text as="p" variant="bodySm">
                    INP: {performanceMetrics.aggregates.avgINP.toFixed(0)}ms 
                    {performanceMetrics.aggregates.avgINP <= 200 ? ' ✓' : ' ✗'}
                  </Text>
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Layout.Section>
        
        <Layout.Section oneHalf>
          <Card>
            <Stack vertical>
              <Heading>Cache Performance</Heading>
              <Text as="p" variant="headingLg">
                {cacheHitRate}%
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Hit Rate (Target: >90%)
              </Text>
              <Box paddingBlockStart="200">
                <Stack vertical gap="100">
                  <Text as="p" variant="bodySm">
                    Reads: {workingSet.reads?.toLocaleString() || 0}
                  </Text>
                  <Text as="p" variant="bodySm">
                    Hits: {workingSet.hits?.toLocaleString() || 0}
                  </Text>
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Layout.Section>
        
        <Layout.Section oneHalf>
          <Card>
            <Stack vertical>
              <Heading>Connection Pool</Heading>
              <Text as="p" variant="headingLg">
                {connectionStats.total_connections}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Total Connections
              </Text>
              <Box paddingBlockStart="200">
                <Stack vertical gap="100">
                  <Text as="p" variant="bodySm">
                    Active: {connectionStats.active_connections}
                  </Text>
                  <Text as="p" variant="bodySm">
                    Idle: {connectionStats.idle_connections}
                  </Text>
                  <Text as="p" variant="bodySm">
                    In Transaction: {connectionStats.idle_in_transaction}
                  </Text>
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Layout.Section>
        
        {slowQueryRows.length > 0 && (
          <Layout.Section>
            <Card>
              <Stack vertical>
                <Heading>Slow Queries (&gt;100ms)</Heading>
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric']}
                  headings={['Query', 'Avg Time', 'Calls']}
                  rows={slowQueryRows}
                />
              </Stack>
            </Card>
          </Layout.Section>
        )}
        
        <Layout.Section>
          <Card>
            <Stack vertical>
              <Heading>Table Sizes</Heading>
              <DataTable
                columnContentTypes={['text', 'text']}
                headings={['Table', 'Size']}
                rows={tableSizeRows}
              />
            </Stack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Stack vertical>
              <Heading>Neon Integration Status</Heading>
              
              <Box paddingBlockStart="200">
                <Stack vertical gap="200">
                  <Stack>
                    <Badge tone={neonStatus.isNeon ? "success" : "critical"}>
                      {neonStatus.isNeon ? "Connected to Neon" : "Not using Neon"}
                    </Badge>
                    {neonStatus.isPooled && (
                      <Badge tone="success">Pooled Connection</Badge>
                    )}
                    {neonStatus.isPreviewBranch && (
                      <Badge tone="info">Preview Branch</Badge>
                    )}
                  </Stack>
                  
                  {neonStatus.branchName && (
                    <Text as="p" variant="bodySm">
                      Branch: <strong>{neonStatus.branchName}</strong>
                    </Text>
                  )}
                  
                  {neonOptimizations.available && (
                    <>
                      <Box paddingBlockStart="200">
                        <Text as="h4" variant="headingSm">Active Features:</Text>
                        <Stack vertical gap="100">
                          {neonOptimizations.features.map((feature: string, index: number) => (
                            <Text key={index} as="p" variant="bodySm">{feature}</Text>
                          ))}
                        </Stack>
                      </Box>
                      
                      {neonOptimizations.recommendations.length > 0 && (
                        <Box paddingBlockStart="200">
                          <Text as="h4" variant="headingSm">Recommendations:</Text>
                          <Stack vertical gap="100">
                            {neonOptimizations.recommendations.map((rec: string, index: number) => (
                              <Text key={index} as="p" variant="bodySm">• {rec}</Text>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Layout.Section>
        
        {neonCosts && (
          <Layout.Section>
            <Card>
              <Stack vertical>
                <Heading>Neon Usage & Costs</Heading>
                <Box paddingBlockStart="200">
                  <Stack vertical gap="200">
                    <Text as="p" variant="bodySm">
                      <strong>Database Size:</strong> {neonCosts.current.storageGB} GB 
                      ({neonCosts.usage.storageUsed} of free tier)
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Tables:</strong> {neonCosts.current.tables}
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Total Rows:</strong> {neonCosts.current.rows.toLocaleString()}
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Compute Usage:</strong> ~{neonCosts.usage.computeEstimate} of free tier
                    </Text>
                    <Box paddingBlockStart="100">
                      <Badge tone={neonCosts.usage.withinFreeTier ? "success" : "warning"}>
                        {neonCosts.usage.withinFreeTier ? "Within Free Tier" : "May Exceed Free Tier"}
                      </Badge>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}