import type { LoaderFunctionArgs, HeadersFunction, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "~/shopify.server";
import { AppBridgeWrapper } from "~/components/AppBridgeProvider";
import { Page, Card, Layout, Navigation } from "@shopify/polaris";
import indexStyles from "~/styles/index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: indexStyles }
];

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