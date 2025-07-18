// Customer Privacy Management Dashboard
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Card, Layout, Text, Button, Banner, Badge, DataTable, Modal, TextContainer, Select, Form, FormLayout, TextField } from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { CustomerPrivacyService } from "~/lib/customer-privacy.server";
import { getJobStatistics } from "~/lib/job-processor.server";
import { db } from "~/lib/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const shopId = session.shop;
  
  // Get pending privacy jobs
  const pendingJobs = await db.systemJob.findMany({
    where: {
      shopId,
      type: {
        in: ["customer_data_export", "customer_data_redact", "shop_data_redact"],
      },
      status: { in: ["pending", "running"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  
  // Get completed privacy jobs (last 30 days)
  const completedJobs = await db.systemJob.findMany({
    where: {
      shopId,
      type: {
        in: ["customer_data_export", "customer_data_redact", "shop_data_redact"],
      },
      status: "completed",
      completedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });
  
  // Get job statistics
  const jobStats = await getJobStatistics(shopId);
  
  return json({
    shopId,
    pendingJobs,
    completedJobs,
    jobStats,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const action = formData.get("action");
  
  const privacyService = new CustomerPrivacyService(
    shopId,
    session.accessToken || ""
  );
  
  switch (action) {
    case "export_customer_data": {
      const customerId = formData.get("customerId") as string;
      const customerEmail = formData.get("customerEmail") as string;
      
      // Queue export job
      await db.systemJob.create({
        data: {
          type: "customer_data_export",
          shopId,
          payload: JSON.stringify({
            customerId,
            customerEmail,
            requestedAt: new Date().toISOString(),
            requestedBy: "admin",
          }),
          priority: 2,
          runAt: new Date(),
        },
      });
      
      return json({ success: true, message: "Export job queued" });
    }
    
    case "anonymize_customer": {
      const customerId = formData.get("customerId") as string;
      const customerEmail = formData.get("customerEmail") as string;
      
      const result = await privacyService.anonymizeCustomerData(
        customerId,
        customerEmail
      );
      
      return json({ success: true, result });
    }
    
    case "delete_customer": {
      const customerId = formData.get("customerId") as string;
      const customerEmail = formData.get("customerEmail") as string;
      
      const result = await privacyService.deleteCustomerData(
        customerId,
        customerEmail
      );
      
      return json({ success: true, result });
    }
    
    default:
      return json({ error: "Invalid action" }, { status: 400 });
  }
}

export default function PrivacyDashboard() {
  const { pendingJobs, completedJobs, jobStats } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAnonymizeModal, setShowAnonymizeModal] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  
  const handleExportData = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "export_customer_data");
    formData.append("customerId", customerId);
    formData.append("customerEmail", customerEmail);
    submit(formData, { method: "post" });
    setShowExportModal(false);
    setCustomerId("");
    setCustomerEmail("");
  }, [customerId, customerEmail, submit]);
  
  const handleAnonymizeData = useCallback(() => {
    if (confirm("Are you sure you want to anonymize this customer's data? This action cannot be undone.")) {
      const formData = new FormData();
      formData.append("action", "anonymize_customer");
      formData.append("customerId", customerId);
      formData.append("customerEmail", customerEmail);
      submit(formData, { method: "post" });
      setShowAnonymizeModal(false);
      setCustomerId("");
      setCustomerEmail("");
    }
  }, [customerId, customerEmail, submit]);
  
  const pendingJobRows = pendingJobs.map(job => {
    const payload = JSON.parse(job.payload || "{}");
    return [
      formatJobType(job.type),
      payload.customerEmail || payload.shopDomain || "N/A",
      <Badge tone={job.status === "running" ? "info" : "attention"}>
        {job.status}
      </Badge>,
      new Date(job.createdAt).toLocaleString(),
      job.attempts + "/" + job.maxAttempts,
    ];
  });
  
  const completedJobRows = completedJobs.map(job => {
    const payload = JSON.parse(job.payload || "{}");
    return [
      formatJobType(job.type),
      payload.customerEmail || payload.shopDomain || "N/A",
      <Badge tone="success">Completed</Badge>,
      new Date(job.completedAt!).toLocaleString(),
      job.attempts + " attempts",
    ];
  });
  
  return (
    <Page
      title="Customer Privacy Management"
      subtitle="Manage GDPR compliance and customer data requests"
      primaryAction={{
        content: "Export Customer Data",
        onAction: () => setShowExportModal(true),
      }}
      secondaryActions={[
        {
          content: "Anonymize Customer",
          onAction: () => setShowAnonymizeModal(true),
        },
      ]}
    >
      <Layout>
        {/* Privacy Job Statistics */}
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingLg" as="h2">
                Privacy Job Statistics
              </Text>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginTop: "20px" }}>
                <div>
                  <Text variant="headingSm" as="h3">Total Jobs</Text>
                  <Text variant="heading2xl" as="p">{jobStats.total}</Text>
                </div>
                <div>
                  <Text variant="headingSm" as="h3">Pending</Text>
                  <Text variant="heading2xl" as="p" tone="caution">{jobStats.pending}</Text>
                </div>
                <div>
                  <Text variant="headingSm" as="h3">Running</Text>
                  <Text variant="heading2xl" as="p">{jobStats.running}</Text>
                </div>
                <div>
                  <Text variant="headingSm" as="h3">Success Rate</Text>
                  <Text variant="heading2xl" as="p" tone="success">{jobStats.successRate.toFixed(1)}%</Text>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        {/* Pending Privacy Jobs */}
        {pendingJobs.length > 0 && (
          <Layout.Section>
            <Card>
              <div style={{ padding: "20px" }}>
                <Text variant="headingLg" as="h2">
                  Pending Privacy Jobs
                </Text>
                <div style={{ marginTop: "20px" }}>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Type", "Customer", "Status", "Created", "Attempts"]}
                    rows={pendingJobRows}
                  />
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}
        
        {/* Completed Privacy Jobs */}
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingLg" as="h2">
                Recent Completed Jobs
              </Text>
              {completedJobRows.length > 0 ? (
                <div style={{ marginTop: "20px" }}>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Type", "Customer", "Status", "Completed", "Details"]}
                    rows={completedJobRows}
                  />
                </div>
              ) : (
                <Banner>
                  <p>No completed privacy jobs in the last 30 days.</p>
                </Banner>
              )}
            </div>
          </Card>
        </Layout.Section>
        
        {/* GDPR Compliance Info */}
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingLg" as="h2">
                GDPR Compliance Information
              </Text>
              <div style={{ marginTop: "20px" }}>
                <TextContainer>
                  <Text variant="headingMd" as="h3">Your Responsibilities</Text>
                  <ul>
                    <li>Respond to data export requests within 30 days</li>
                    <li>Delete customer data upon request (right to erasure)</li>
                    <li>Maintain audit logs of all data processing activities</li>
                    <li>Ensure data is encrypted and secure</li>
                  </ul>
                  
                  <Text variant="headingMd" as="h3">Automated Compliance</Text>
                  <ul>
                    <li>All PII data is encrypted at rest</li>
                    <li>Automatic webhook handling for GDPR requests</li>
                    <li>Audit logging for all customer data access</li>
                    <li>Automated data retention policies</li>
                  </ul>
                </TextContainer>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
      
      {/* Export Customer Data Modal */}
      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Customer Data"
        primaryAction={{
          content: "Export",
          onAction: handleExportData,
          disabled: !customerId || !customerEmail,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowExportModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Customer ID"
              value={customerId}
              onChange={setCustomerId}
              placeholder="e.g., 1234567890"
              autoComplete="off"
            />
            <TextField
              label="Customer Email"
              value={customerEmail}
              onChange={setCustomerEmail}
              type="email"
              placeholder="customer@example.com"
              autoComplete="off"
            />
            <Banner tone="info">
              <p>This will queue a job to export all customer data. The export will be available for download once completed.</p>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      {/* Anonymize Customer Modal */}
      <Modal
        open={showAnonymizeModal}
        onClose={() => setShowAnonymizeModal(false)}
        title="Anonymize Customer Data"
        primaryAction={{
          content: "Anonymize",
          onAction: handleAnonymizeData,
          disabled: !customerId || !customerEmail,
          loading: isLoading,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowAnonymizeModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Customer ID"
              value={customerId}
              onChange={setCustomerId}
              placeholder="e.g., 1234567890"
              autoComplete="off"
            />
            <TextField
              label="Customer Email"
              value={customerEmail}
              onChange={setCustomerEmail}
              type="email"
              placeholder="customer@example.com"
              autoComplete="off"
            />
            <Banner tone="warning">
              <p>This will permanently anonymize all customer personal data. This action cannot be undone.</p>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function formatJobType(type: string): string {
  const types: Record<string, string> = {
    customer_data_export: "Data Export",
    customer_data_redact: "Data Redaction",
    shop_data_redact: "Shop Redaction",
  };
  return types[type] || type;
}