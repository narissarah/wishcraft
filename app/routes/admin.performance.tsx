// Performance dashboard admin page
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Card, Layout, Page, Text, Badge, DataTable, Button, ButtonGroup } from '@shopify/polaris';
import { performanceAnalytics } from '~/lib/performance-dashboard.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const timeRange = url.searchParams.get('range') || '7d';
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  
  switch (timeRange) {
    case '1d':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const dashboardData = await performanceAnalytics.aggregateMetrics(startDate, endDate);
  const alerts = await performanceAnalytics.generateAlerts();
  const recommendations = await performanceAnalytics.generateRecommendations();

  return json({
    dashboardData,
    alerts,
    recommendations,
    timeRange
  });
}

export default function PerformanceDashboard() {
  const { dashboardData, alerts, recommendations, timeRange } = useLoaderData<typeof loader>();

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'critical';
  };

  const getCoreWebVitalColor = (metric: string, value: number) => {
    switch (metric) {
      case 'LCP':
        if (value <= 2500) return 'success';
        if (value <= 4000) return 'warning';
        return 'critical';
      case 'FID':
        if (value <= 100) return 'success';
        if (value <= 300) return 'warning';
        return 'critical';
      case 'CLS':
        if (value <= 0.1) return 'success';
        if (value <= 0.25) return 'warning';
        return 'critical';
      default:
        return 'info';
    }
  };

  const topPagesRows = dashboardData.topPages.map(page => [
    page.path,
    page.pageViews.toLocaleString(),
    `${page.averageLoadTime}ms`,
    <Badge tone={getPerformanceColor(page.performanceScore)} key={page.path}>
      {page.performanceScore}/100
    </Badge>
  ]);

  const connectionTypeRows = dashboardData.connectionTypes.map(conn => [
    conn.type.toUpperCase(),
    `${conn.percentage}%`,
    `${conn.averageLoadTime}ms`
  ]);

  const errorRows = dashboardData.errorAnalysis.errorsByType.map(error => [
    error.type,
    error.count.toLocaleString(),
    `${error.percentage}%`
  ]);

  return (
    <Page
      title="Performance Dashboard"
      subtitle="Monitor and optimize your app's performance"
      primaryAction={{
        content: 'Generate Report',
        onAction: () => {
          // Generate performance report
          window.open(`/admin/performance/report?range=${timeRange}`, '_blank');
        }
      }}
      secondaryActions={[
        {
          content: 'Refresh Data',
          onAction: () => window.location.reload()
        }
      ]}
    >
      <Layout>
        {/* Time Range Selector */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '16px' }}>
              <Text variant="headingMd">Time Range</Text>
              <div style={{ marginTop: '8px' }}>
                <ButtonGroup>
                  <Button 
                    pressed={timeRange === '1d'} 
                    url="?range=1d"
                  >
                    1 Day
                  </Button>
                  <Button 
                    pressed={timeRange === '7d'} 
                    url="?range=7d"
                  >
                    7 Days
                  </Button>
                  <Button 
                    pressed={timeRange === '30d'} 
                    url="?range=30d"
                  >
                    30 Days
                  </Button>
                  <Button 
                    pressed={timeRange === '90d'} 
                    url="?range=90d"
                  >
                    90 Days
                  </Button>
                </ButtonGroup>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* Overview Cards */}
        <Layout.Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <Card>
              <div style={{ padding: '16px' }}>
                <Text variant="headingMd">Total Page Views</Text>
                <Text variant="headingLg">{dashboardData.overview.totalPageViews.toLocaleString()}</Text>
              </div>
            </Card>
            
            <Card>
              <div style={{ padding: '16px' }}>
                <Text variant="headingMd">Average Load Time</Text>
                <Text variant="headingLg">{dashboardData.overview.averageLoadTime}ms</Text>
              </div>
            </Card>
            
            <Card>
              <div style={{ padding: '16px' }}>
                <Text variant="headingMd">Performance Score</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text variant="headingLg">{dashboardData.overview.performanceScore}/100</Text>
                  <Badge tone={getPerformanceColor(dashboardData.overview.performanceScore)}>
                    {dashboardData.overview.performanceScore >= 90 ? 'Good' : 
                     dashboardData.overview.performanceScore >= 70 ? 'Needs Improvement' : 'Poor'}
                  </Badge>
                </div>
              </div>
            </Card>
            
            <Card>
              <div style={{ padding: '16px' }}>
                <Text variant="headingMd">Budget Violations</Text>
                <Text variant="headingLg">{dashboardData.overview.budgetViolations}</Text>
              </div>
            </Card>
          </div>
        </Layout.Section>

        {/* Core Web Vitals */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '16px' }}>
              <Text variant="headingMd">Core Web Vitals</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
                <div>
                  <Text variant="headingSm">Largest Contentful Paint</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Text variant="headingMd">{dashboardData.overview.coreWebVitals.LCP.p50}ms</Text>
                    <Badge tone={getCoreWebVitalColor('LCP', dashboardData.overview.coreWebVitals.LCP.p50)}>
                      P50
                    </Badge>
                  </div>
                  <Text variant="bodySm">P95: {dashboardData.overview.coreWebVitals.LCP.p95}ms</Text>
                </div>
                
                <div>
                  <Text variant="headingSm">First Input Delay</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Text variant="headingMd">{dashboardData.overview.coreWebVitals.FID.p50}ms</Text>
                    <Badge tone={getCoreWebVitalColor('FID', dashboardData.overview.coreWebVitals.FID.p50)}>
                      P50
                    </Badge>
                  </div>
                  <Text variant="bodySm">P95: {dashboardData.overview.coreWebVitals.FID.p95}ms</Text>
                </div>
                
                <div>
                  <Text variant="headingSm">Cumulative Layout Shift</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Text variant="headingMd">{dashboardData.overview.coreWebVitals.CLS.p50}</Text>
                    <Badge tone={getCoreWebVitalColor('CLS', dashboardData.overview.coreWebVitals.CLS.p50)}>
                      P50
                    </Badge>
                  </div>
                  <Text variant="bodySm">P95: {dashboardData.overview.coreWebVitals.CLS.p95}</Text>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <Text variant="headingMd">Performance Alerts</Text>
                <div style={{ marginTop: '16px' }}>
                  {alerts.map(alert => (
                    <div key={alert.id} style={{ padding: '12px', border: '1px solid #e1e3e5', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="headingSm">{alert.title}</Text>
                        <Badge tone={alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'warning' : 'info'}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <Text variant="bodySm">{alert.message}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}

        {/* Recommendations */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '16px' }}>
              <Text variant="headingMd">Performance Recommendations</Text>
              <div style={{ marginTop: '16px' }}>
                {recommendations.map((rec, index) => (
                  <div key={index} style={{ padding: '12px', border: '1px solid #e1e3e5', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="headingSm">{rec.title}</Text>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Badge tone={rec.priority === 'high' ? 'warning' : rec.priority === 'medium' ? 'info' : 'success'}>
                          {rec.priority.toUpperCase()}
                        </Badge>
                        <Badge tone="info">{rec.effort} effort</Badge>
                      </div>
                    </div>
                    <Text variant="bodySm">{rec.description}</Text>
                    <Text variant="bodySm" tone="subdued">Impact: {rec.impact}</Text>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* Top Pages */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '16px' }}>
              <Text variant="headingMd">Top Pages</Text>
              <div style={{ marginTop: '16px' }}>
                <DataTable
                  columnContentTypes={['text', 'numeric', 'text', 'text']}
                  headings={['Page', 'Views', 'Load Time', 'Score']}
                  rows={topPagesRows}
                />
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* Connection Types */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '16px' }}>
              <Text variant="headingMd">Connection Types</Text>
              <div style={{ marginTop: '16px' }}>
                <DataTable
                  columnContentTypes={['text', 'text', 'text']}
                  headings={['Type', 'Percentage', 'Avg Load Time']}
                  rows={connectionTypeRows}
                />
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* Error Analysis */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '16px' }}>
              <Text variant="headingMd">Error Analysis</Text>
              <div style={{ marginTop: '16px' }}>
                <Text variant="bodySm">Total Errors: {dashboardData.errorAnalysis.totalErrors}</Text>
                <div style={{ marginTop: '8px' }}>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'text']}
                    headings={['Type', 'Count', 'Percentage']}
                    rows={errorRows}
                  />
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}