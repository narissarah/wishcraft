import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import { getAdminAuth } from "~/lib/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Use safe authentication that doesn't cause loops
  const auth = await getAdminAuth(request);
  
  if (!auth) {
    // If not authenticated, redirect to login with the current URL as return path
    const url = new URL(request.url);
    return redirect(`/auth/login?return=${encodeURIComponent(url.pathname + url.search)}`);
  }
  
  const { admin, session } = auth;

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