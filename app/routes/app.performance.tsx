import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Badge, 
  BlockStack,
  InlineStack,
  ProgressBar,
  DataTable,
  Banner
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { cache } from "~/lib/cache-unified.server";
import { log } from "~/lib/logger.server";

interface WebVitalMetric {
  metric: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  p75: number;
  p95: number;
  samples: number;
}

interface PerformanceData {
  webVitals: WebVitalMetric[];
  queryPerformance: {
    slowQueries: Array<{ query: string; avgDuration: number; count: number }>;
    cacheHitRate: number;
  };
  webhookPerformance: {
    avgLatency: number;
    successRate: number;
    recentFailures: number;
  };
  systemHealth: {
    dbConnections: number;
    cacheStatus: boolean;
    memoryUsage: number;
    uptime: number;
  };
}

// 2025 Core Web Vitals Thresholds
const THRESHOLDS = {
  INP: { good: 200, poor: 500 }, // PRIMARY 2025
  CLS: { good: 0.1, poor: 0.25 },
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Fetch performance metrics from database
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Get Web Vitals data
  const webVitalsData = await db.$queryRaw<Array<{
    metric: string;
    avg_value: number;
    p75_value: number;
    p95_value: number;
    count: bigint;
  }>>`
    SELECT 
      metric,
      AVG(value)::numeric as avg_value,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value)::numeric as p75_value,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::numeric as p95_value,
      COUNT(*) as count
    FROM performance_metrics
    WHERE created_at > ${dayAgo}
    GROUP BY metric
  `;

  // Get slow GraphQL queries
  const slowQueries = await db.$queryRaw<Array<{
    query_name: string;
    avg_duration: number;
    count: bigint;
  }>>`
    SELECT 
      query_name,
      AVG(duration)::numeric as avg_duration,
      COUNT(*) as count
    FROM graphql_queries
    WHERE created_at > ${dayAgo} AND duration > 1000
    GROUP BY query_name
    ORDER BY avg_duration DESC
    LIMIT 5
  `;

  // Get webhook performance
  const webhookStats = await db.$queryRaw<Array<{
    avg_latency: number;
    success_rate: number;
    failure_count: bigint;
  }>>`
    SELECT 
      AVG(latency)::numeric as avg_latency,
      SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)::float as success_rate,
      SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failure_count
    FROM webhook_events
    WHERE created_at > ${dayAgo}
  `;

  // Get cache hit rate
  const cacheStats = await cache.getStats();
  
  // Get system health
  const systemHealth = {
    dbConnections: await getActiveDbConnections(),
    cacheStatus: await cache.isHealthy(),
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
    uptime: process.uptime()
  };

  // Format Web Vitals data
  const webVitals: WebVitalMetric[] = webVitalsData.map(row => {
    const threshold = THRESHOLDS[row.metric as keyof typeof THRESHOLDS];
    let rating: "good" | "needs-improvement" | "poor" = "poor";
    
    if (threshold) {
      if (row.p75_value <= threshold.good) rating = "good";
      else if (row.p75_value <= threshold.poor) rating = "needs-improvement";
    }
    
    return {
      metric: row.metric,
      value: Number(row.avg_value),
      rating,
      p75: Number(row.p75_value),
      p95: Number(row.p95_value),
      samples: Number(row.count)
    };
  });

  const performanceData: PerformanceData = {
    webVitals,
    queryPerformance: {
      slowQueries: slowQueries.map(q => ({
        query: q.query_name,
        avgDuration: Number(q.avg_duration),
        count: Number(q.count)
      })),
      cacheHitRate: cacheStats.hitRate || 0
    },
    webhookPerformance: {
      avgLatency: Number(webhookStats[0]?.avg_latency || 0),
      successRate: Number(webhookStats[0]?.success_rate || 1),
      recentFailures: Number(webhookStats[0]?.failure_count || 0)
    },
    systemHealth
  };

  return json(performanceData);
};

export default function PerformanceDashboard() {
  const data = useLoaderData<typeof loader>();
  
  // Check for 2025 compliance
  const inp = data.webVitals.find(v => v.metric === 'INP');
  const cls = data.webVitals.find(v => v.metric === 'CLS');
  const lcp = data.webVitals.find(v => v.metric === 'LCP');
  
  const is2025Compliant = 
    inp?.rating === 'good' && 
    cls?.rating === 'good' && 
    lcp?.rating === 'good';

  return (
    <Page title="Performance Dashboard">
      <Layout>
        <Layout.Section>
          {is2025Compliant ? (
            <Banner tone="success" title="2025 Compliant">
              Your app meets all Shopify 2025 Core Web Vitals requirements!
            </Banner>
          ) : (
            <Banner tone="warning" title="Performance Optimization Needed">
              Some Core Web Vitals need improvement for 2025 compliance.
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Core Web Vitals (2025 Standards)</Text>
              
              {data.webVitals.map(vital => (
                <BlockStack key={vital.metric} gap="200">
                  <InlineStack align="space-between">
                    <InlineStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        {vital.metric}
                        {vital.metric === 'INP' && (
                          <Badge tone="attention">Primary 2025 Metric</Badge>
                        )}
                      </Text>
                      <Badge tone={getToneForRating(vital.rating)}>{vital.rating}</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd">
                      P75: {formatMetricValue(vital.metric, vital.p75)}
                    </Text>
                  </InlineStack>
                  <ProgressBar 
                    progress={getProgressForMetric(vital.metric, vital.p75)} 
                    tone={getToneForRating(vital.rating)}
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    Average: {formatMetricValue(vital.metric, vital.value)} | 
                    P95: {formatMetricValue(vital.metric, vital.p95)} | 
                    Samples: {vital.samples.toLocaleString()}
                  </Text>
                </BlockStack>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">GraphQL Performance</Text>
              
              <InlineStack align="space-between">
                <Text as="p" variant="bodyMd">Cache Hit Rate</Text>
                <Badge tone={data.queryPerformance.cacheHitRate > 0.8 ? "success" : "warning"}>
                  {(data.queryPerformance.cacheHitRate * 100).toFixed(1)}%
                </Badge>
              </InlineStack>
              
              {data.queryPerformance.slowQueries.length > 0 && (
                <>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Slow Queries (&gt;1s)
                  </Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric']}
                    headings={['Query', 'Avg Duration', 'Count']}
                    rows={data.queryPerformance.slowQueries.map(q => [
                      q.query.substring(0, 30) + '...',
                      `${q.avgDuration.toFixed(0)}ms`,
                      q.count.toString()
                    ])}
                  />
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Webhook Performance</Text>
              
              <InlineStack align="space-between">
                <Text as="p" variant="bodyMd">Average Latency</Text>
                <Badge tone={data.webhookPerformance.avgLatency < 500 ? "success" : "warning"}>
                  {data.webhookPerformance.avgLatency.toFixed(0)}ms
                </Badge>
              </InlineStack>
              
              <InlineStack align="space-between">
                <Text as="p" variant="bodyMd">Success Rate</Text>
                <Badge tone={data.webhookPerformance.successRate > 0.95 ? "success" : "critical"}>
                  {(data.webhookPerformance.successRate * 100).toFixed(1)}%
                </Badge>
              </InlineStack>
              
              {data.webhookPerformance.recentFailures > 0 && (
                <Banner tone="warning">
                  {data.webhookPerformance.recentFailures} webhook failures in the last 24 hours
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">System Health</Text>
              
              <InlineStack gap="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">Database Connections</Text>
                  <Badge>{data.systemHealth.dbConnections} active</Badge>
                </BlockStack>
                
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">Cache Status</Text>
                  <Badge tone={data.systemHealth.cacheStatus ? "success" : "critical"}>{data.systemHealth.cacheStatus ? "Healthy" : "Unhealthy"}</Badge>
                </BlockStack>
                
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">Memory Usage</Text>
                  <Badge>{data.systemHealth.memoryUsage.toFixed(0)} MB</Badge>
                </BlockStack>
                
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">Uptime</Text>
                  <Badge>{formatUptime(data.systemHealth.uptime)}</Badge>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Helper functions
function getToneForRating(rating: string): "success" | "warning" | "critical" {
  switch (rating) {
    case "good": return "success";
    case "needs-improvement": return "warning";
    default: return "critical";
  }
}

function formatMetricValue(metric: string, value: number): string {
  switch (metric) {
    case "CLS": return value.toFixed(3);
    case "INP":
    case "LCP":
    case "FCP":
    case "TTFB": return `${value.toFixed(0)}ms`;
    default: return value.toString();
  }
}

function getProgressForMetric(metric: string, value: number): number {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
  if (!threshold) return 0;
  
  // Invert progress for better visualization (lower is better)
  const range = threshold.poor - threshold.good;
  const progress = Math.max(0, Math.min(100, ((threshold.poor - value) / range) * 100));
  return progress;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function getActiveDbConnections(): Promise<number> {
  try {
    const result = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `;
    return Number(result[0]?.count || 0);
  } catch (error) {
    log.warn('Failed to get database connections count', { error: (error as Error).message });
    return 0;
  }
}