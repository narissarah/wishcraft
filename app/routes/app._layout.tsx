import type { LoaderFunctionArgs, HeadersFunction, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { lazy, Suspense } from "react";
import { requireValidIframe } from "~/lib/iframe-protection.server";

// Lazy load components to reduce initial bundle size
const AppBridgeWrapper = lazy(async () => {
  const m = await import("~/components/AppBridgeProvider");
  return { default: m.AppBridgeWrapper };
});
import { Page, Layout, Spinner } from "@shopify/polaris";
import "~/styles/index.css";

export const links: LinksFunction = () => [];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Use authentication with retry logic for intermittent failures
    const { authenticateWithRetry } = await import("~/lib/auth-utils.server");
    const { session } = await authenticateWithRetry(request);

    // Built for Shopify: Validate iframe embedding
    await requireValidIframe({ request } as LoaderFunctionArgs, session.shop);

    return json({
      shopOrigin: session.shop,
      apiKey: process.env.SHOPIFY_API_KEY || "", // Required for AppBridge
      host: new URL(request.url).searchParams.get("host") || "",
    });
  } catch (error) {
    // Handle authentication errors with proper recovery
    const { handleAuthError } = await import("~/lib/auth-utils.server");
    return handleAuthError(request, error);
  }
};

export default function App() {
  const { shopOrigin, apiKey, host } = useLoaderData<typeof loader>();

  return (
    <Suspense fallback={<Page><Layout><Layout.Section><Spinner size="large" /></Layout.Section></Layout></Page>}>
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
              <div className="app-nav-wrapper">
                <nav className="app-nav">
                  <Link to="/app" rel="home" className="app-nav-link">
                    Dashboard
                  </Link>
                  <Link to="/app/registries" className="app-nav-link">
                    Registries
                  </Link>
                  <Link to="/app/settings" className="app-nav-link">Settings</Link>
                </nav>
              </div>
              <Outlet />
            </Layout.Section>
          </Layout>
        </Page>
      </AppBridgeWrapper>
    </Suspense>
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