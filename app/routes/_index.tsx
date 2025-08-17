import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import "~/styles/index.css";
import packageJson from "../../package.json";
import { SHOPIFY_CONFIG } from "~/config/shopify.config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // Preserve ALL Shopify parameters for proper authentication
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const embedded = url.searchParams.get("embedded");
  const session = url.searchParams.get("session");
  const timestamp = url.searchParams.get("timestamp");
  const locale = url.searchParams.get("locale");
  
  // For embedded apps, Shopify handles authentication through the App Bridge
  // If we have a shop parameter, redirect to the app routes with ALL params
  if (shop) {
    const params = new URLSearchParams();
    params.set("shop", shop);
    if (host) params.set("host", host);
    if (embedded) params.set("embedded", embedded);
    if (session) params.set("session", session);
    if (timestamp) params.set("timestamp", timestamp);
    if (locale) params.set("locale", locale);
    
    return redirect(`/app?${params.toString()}`);
  }
  
  // If no shop parameter, show installation page
  return json({
    appUrl: process.env['SHOPIFY_APP_URL'] || new URL(request.url).origin,
    appName: "WishCraft Gift Registry"
  });
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  
  // Handle potential undefined data
  const appName = data?.appName || "WishCraft Gift Registry";
  
  return (
    <div className="landing-container">
      <h1 className="landing-title">
        🎁 {appName}
      </h1>
      <p className="landing-description">
        The most comprehensive gift registry app for Shopify stores. 
        Built for Shopify 2025 compliance with native inventory integration.
      </p>
      
      <div className="landing-install-box">
        <h2 className="landing-install-title">
          Installation Required
        </h2>
        <p className="landing-install-text">
          This app must be installed through the Shopify Admin panel.
        </p>
        <p className="landing-install-instructions">
          To install: Go to your Shopify Admin → Apps → Find WishCraft in the App Store
        </p>
      </div>
      
      <div className="landing-footer">
        <p>WishCraft v{packageJson.version} | Built for Shopify 2025</p>
        <p>Deployed on Vercel | Status: Healthy ✅</p>
        <div style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
          <a href="/privacy-policy" style={{ color: "#666", marginRight: "1rem" }}>Privacy Policy</a>
          <a href="/terms-of-service" style={{ color: "#666" }}>Terms of Service</a>
        </div>
      </div>
    </div>
  );
}