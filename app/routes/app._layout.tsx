import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  return json({
    shopOrigin: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY || "",
  });
};

export default function App() {
  const { shopOrigin, apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={{}}>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #e1e1e1' }}>
        <Link to="/app" rel="home" style={{ marginRight: '1rem' }}>
          Home
        </Link>
        <Link to="/app/registries" style={{ marginRight: '1rem' }}>Registries</Link>
        <Link to="/app/settings">Settings</Link>
      </nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify embedded app error boundary
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div>
      <h1>Something went wrong</h1>
      <pre>{JSON.stringify(error, null, 2)}</pre>
    </div>
  );
}