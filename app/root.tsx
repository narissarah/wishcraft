/**
 * Simplified Root Component for WishCraft
 * Extracted Polaris i18n config to separate file
 */

import type { LinksFunction, LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import "~/styles/index.css";
import { generateNonce } from "~/lib/csp.server";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { useEffect } from "react";
import { ThemeProvider } from "~/components/ThemeProvider";
import { ErrorBoundary as ApplicationErrorBoundary } from "~/components/ErrorBoundary";
import { polarisI18n } from "~/lib/polaris-config";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://cdn.shopify.com" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
  { rel: "dns-prefetch", href: "https://analytics.google.com" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Skip rate limiting for auth routes
  if (!pathname.startsWith('/auth/')) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimit = checkRateLimit(ip, RATE_LIMITS.api.limit, RATE_LIMITS.api.window);
    
    if (!rateLimit.allowed) {
      throw new Response("Too many requests", { status: 429 });
    }
  }
  
  const nonce = (request as any).nonce || generateNonce();
  
  return json({
    pathname,
    nonce,
    ENV: {
      NODE_ENV: process.env.NODE_ENV,
      GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    }
  });
}

export const headers: HeadersFunction = ({ loaderHeaders, parentHeaders, actionHeaders }) => {
  const headers = new Headers(parentHeaders);
  
  loaderHeaders.forEach((value, key) => headers.set(key, value));
  actionHeaders?.forEach((value, key) => headers.set(key, value));
  
  // Basic security headers
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
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
        
        {/* Google Analytics */}
        {ENV.GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${ENV.GA_MEASUREMENT_ID}`}
            />
            <script
              nonce={nonce}
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${ENV.GA_MEASUREMENT_ID}', {
                    page_title: document.title,
                    page_location: window.location.href,
                    send_page_view: false,
                    cookie_flags: 'secure;samesite=strict'
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        <ThemeProvider>
          <AppProvider i18n={polarisI18n}>
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