import type { LinksFunction, LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import { generateResourceHints, generateCriticalCSS } from "~/lib/performance.server";
import { CriticalCSS, ResourceHints, PerformanceMonitor } from "~/components/PerformanceOptimized";
import { getSecurityHeaders, generateNonce, getCSPMetaTag } from "~/lib/security-headers.server";
import { rateLimitMiddleware, RATE_LIMITS } from "~/lib/rate-limiter.server";
import { ThemeProvider } from "~/components/ThemeProvider";
import { useEffect } from "react";

export const links: LinksFunction = () => {
  return [
    // Critical CSS will be inlined, so load Polaris with lower priority
    { 
      rel: "preload", 
      href: "/build/polaris.css", 
      as: "style",
      onload: "this.onload=null;this.rel='stylesheet'"
    },
    // Preconnect to critical domains
    { rel: "preconnect", href: "https://cdn.shopify.com" },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    // DNS prefetch for analytics
    { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
    { rel: "dns-prefetch", href: "https://analytics.google.com" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(RATE_LIMITS.public)(request);
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    throw rateLimitResponse;
  }
  
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Generate CSP nonce for this request
  const nonce = generateNonce();
  
  return json({
    resourceHints: generateResourceHints(),
    criticalCSS: generateCriticalCSS(pathname),
    pathname,
    nonce,
    ENV: {
      NODE_ENV: process.env.NODE_ENV,
      GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    }
  }, {
    headers: rateLimitResponse?.headers || {}
  });
}

// Apply security headers to all responses
export const headers: HeadersFunction = ({ loaderHeaders, parentHeaders }) => {
  const headers = new Headers(parentHeaders);
  
  // Copy loader headers (for rate limiting)
  loaderHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  
  // Apply security headers
  const securityHeaders = getSecurityHeaders(new Request("https://wishcraft.app"));
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) headers.set(key, value);
  });
  
  return headers;
};

export default function App() {
  const { resourceHints, criticalCSS, ENV, nonce } = useLoaderData<typeof loader>();

  // Initialize Core Web Vitals monitoring on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("~/lib/web-vitals.client").then(({ initWebVitals }) => {
        initWebVitals();
      });
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        
        {/* Security headers via meta tags */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        
        {/* Performance optimizations */}
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />
        
        {/* Resource hints for performance */}
        <ResourceHints hints={resourceHints} />
        
        {/* Critical CSS inlined for faster rendering */}
        <CriticalCSS styles={criticalCSS} />
        
        <Meta />
        <Links />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/build/entry.client.js" as="script" />
        
        {/* Google Analytics (if configured) with nonce */}
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
          <AppProvider i18n={{}}>
            <Outlet />
          </AppProvider>
        </ThemeProvider>
        
        {/* Performance monitoring */}
        <PerformanceMonitor />
        
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        
        {/* Service Worker registration with nonce */}
        {ENV.NODE_ENV === 'production' && (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.register('/sw.js', {
                    updateViaCache: 'none'
                  })
                    .then(registration => {
                      console.log('SW registered');
                      // Check for updates every hour
                      setInterval(() => registration.update(), 3600000);
                    })
                    .catch(error => console.log('SW registration failed'));
                }
              `,
            }}
          />
        )}
        
        {/* Performance monitoring initialization */}
        <script 
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize performance monitoring
              if (window.performance && performance.mark) {
                performance.mark('app-interactive');
              }
            `,
          }}
        />
        
        {/* Environment variables for client */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)};`,
          }}
        />
      </body>
    </html>
  );
}