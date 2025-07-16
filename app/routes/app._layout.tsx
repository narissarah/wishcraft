import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "~/shopify.server";
import { AppBridgeWrapper } from "~/components/AppBridgeProvider";
import { Page, Card, Layout, Navigation } from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Use 2025 authentication pattern - this handles redirects automatically
  const { admin, session } = await authenticate.admin(request);

  return json({
    shopOrigin: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY || "",
    host: new URL(request.url).searchParams.get("host") || "",
  });
};

export default function App() {
  const { shopOrigin, apiKey, host } = useLoaderData<typeof loader>();

  return (
    <AppBridgeWrapper
      config={{
        apiKey,
        shop: shopOrigin,
        host,
      }}
    >
      <Page>
        <Layout>
          <Layout.Section>
            <div style={{ marginBottom: '1rem' }}>
              <nav style={{ padding: '1rem', borderBottom: '1px solid #e1e1e1' }}>
                <Link to="/app" rel="home" style={{ marginRight: '1rem' }}>
                  Dashboard
                </Link>
                <Link to="/app/registries" style={{ marginRight: '1rem' }}>
                  Registries
                </Link>
                <Link to="/app/settings">Settings</Link>
              </nav>
            </div>
            <Outlet />
          </Layout.Section>
        </Layout>
      </Page>
    </AppBridgeWrapper>
  );
}

// 2025 Shopify Embedded App Error Boundary
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Required headers for embedded apps
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};