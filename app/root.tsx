import type { LinksFunction, LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import "~/styles/index.css";
import { ThemeProvider } from "~/components/ThemeProvider";
import { ErrorBoundary as ApplicationErrorBoundary } from "~/components/ErrorBoundary";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://cdn.shopify.com" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
  { rel: "dns-prefetch", href: "https://analytics.google.com" },
];

export async function loader({ }: LoaderFunctionArgs) {
  const nonce = Math.random().toString(36).substring(2, 15);
  
  return json({
    nonce,
    ENV: {
      NODE_ENV: process.env['NODE_ENV'],
      SHOPIFY_APP_URL: process.env['SHOPIFY_APP_URL'],
    }
  });
}

export const headers: HeadersFunction = ({ loaderHeaders, parentHeaders, actionHeaders }) => {
  const headers = new Headers(parentHeaders);
  
  loaderHeaders.forEach((value, key) => headers.set(key, value));
  actionHeaders?.forEach((value, key) => headers.set(key, value));
  
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // CORS headers for API routes
  const origin = headers.get("Origin") || "*";
  const shopifyOrigins = ["https://*.myshopify.com", "https://admin.shopify.com"];
  if (shopifyOrigins.some(pattern => origin.match(pattern.replace("*", ".*")))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  
  return headers;
};

export default function App() {
  const { ENV, nonce } = useLoaderData<typeof loader>();

  // Client-side error handling - errors are handled by ErrorBoundary component

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />
        
        <Meta />
        <Links />
        
        <link rel="preload" href="/build/entry.client.js" as="script" />
        
      </head>
      <body>
        <ThemeProvider>
          <AppProvider i18n={{}}>
            <ApplicationErrorBoundary>
              <Outlet />
            </ApplicationErrorBoundary>
          </AppProvider>
        </ThemeProvider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <LiveReload nonce={nonce} />
        
        {/* Environment variables for client-side */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return (
    <html lang="en">
      <head>
        <title>Application Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <ApplicationErrorBoundary>
          <div>Application Error - Please reload the page</div>
        </ApplicationErrorBoundary>
        <Scripts />
      </body>
    </html>
  );
}