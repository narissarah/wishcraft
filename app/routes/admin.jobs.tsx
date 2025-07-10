import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Button,
  ButtonGroup,
  Text,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import { getAllJobStatuses, runJobManually, type JobType } from "~/lib/jobs/job-processor.server";
import { log } from "~/lib/logger.server";

/**
 * Admin page for managing background jobs
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  const jobStatuses = await getAllJobStatuses();
  
  return json({ jobStatuses });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const jobType = formData.get("jobType") as JobType;
  
  if (jobType) {
    try {
      await runJobManually(jobType);
      log.info(`Manually triggered job: ${jobType}`);
    } catch (error) {
      log.error(`Failed to trigger job: ${jobType}`, error);
      throw new Response("Failed to trigger job", { status: 500 });
    }
  }
  
  return redirect("/admin/jobs");
}

export default function JobsPage() {
  const { jobStatuses } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  
  const rows = jobStatuses.map(job => {
    const status = job.lastRun?.status || 'NEVER_RUN';
    const statusBadge = getStatusBadge(status);
    const lastRunTime = job.lastRun?.startedAt 
      ? new Date(job.lastRun.startedAt).toLocaleString()
      : 'Never';
    const duration = job.lastRun?.duration 
      ? `${job.lastRun.duration}ms`
      : '-';
    
    return [
      job.type,
      job.schedule,
      statusBadge,
      lastRunTime,
      duration,
      <ButtonGroup key={job.type}>
        <Button
          size="slim"
          onClick={() => {
            submit(
              { jobType: job.type },
              { method: "post" }
            );
          }}
          disabled={!job.enabled}
        >
          Run Now
        </Button>
      </ButtonGroup>,
    ];
  });
  
  return (
    <Page title="Background Jobs">
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={[
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
              ]}
              headings={[
                'Job Type',
                'Schedule',
                'Status',
                'Last Run',
                'Duration',
                'Actions',
              ]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card title="Job Information">
            <Card.Section>
              <Text as="p" variant="bodyMd">
                Background jobs run automatically on their configured schedules.
                Jobs handle tasks like cache warming, log cleanup, inventory sync,
                and sending reminders.
              </Text>
            </Card.Section>
            <Card.Section>
              <Text as="h3" variant="headingMd">
                Job Types:
              </Text>
              <ul>
                <li><strong>CACHE_WARM</strong>: Warms Redis cache for active registries</li>
                <li><strong>CLEANUP_OLD_LOGS</strong>: Removes logs older than 30 days</li>
                <li><strong>SYNC_INVENTORY</strong>: Syncs registry items with Shopify inventory</li>
                <li><strong>SEND_REMINDERS</strong>: Sends event reminder emails</li>
                <li><strong>CLEANUP_SESSIONS</strong>: Removes expired session data</li>
              </ul>
            </Card.Section>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <Badge status="success">Completed</Badge>;
    case 'RUNNING':
      return <Badge status="info">Running</Badge>;
    case 'FAILED':
      return <Badge status="critical">Failed</Badge>;
    case 'NEVER_RUN':
      return <Badge>Never Run</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}