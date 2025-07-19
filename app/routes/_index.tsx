import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  // For embedded apps, Shopify handles authentication through the App Bridge
  // If we have a shop parameter, redirect to the app routes
  if (shop) {
    return redirect(`/app?shop=${shop}`);
  }
  
  // If no shop parameter, show installation page
  return json({
    appUrl: process.env.SHOPIFY_APP_URL,
    appName: "WishCraft Gift Registry"
  });
};

export default function Index() {
  const { appUrl, appName } = useLoaderData<typeof loader>();
  
  return (
    <div style={{ 
      fontFamily: "system-ui, sans-serif", 
      lineHeight: "1.8",
      padding: "2rem",
      maxWidth: "600px",
      margin: "0 auto",
      textAlign: "center"
    }}>
      <h1 style={{ color: "#004c3f", marginBottom: "1rem" }}>
        🎁 {appName}
      </h1>
      <p style={{ fontSize: "1.1rem", color: "#666", marginBottom: "2rem" }}>
        The most comprehensive gift registry app for Shopify stores. 
        Built for Shopify 2025 compliance with native inventory integration.
      </p>
      
      <div style={{ 
        background: "#f8f9fa", 
        padding: "1.5rem", 
        borderRadius: "8px",
        marginBottom: "2rem"
      }}>
        <h2 style={{ color: "#004c3f", fontSize: "1.2rem", marginBottom: "1rem" }}>
          Installation Required
        </h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          This app must be installed through the Shopify Admin panel.
        </p>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          To install: Go to your Shopify Admin → Apps → Find WishCraft in the App Store
        </p>
      </div>
      
      <div style={{ fontSize: "0.8rem", color: "#999" }}>
        <p>WishCraft v1.1.2 | Built for Shopify 2025</p>
        <p>Deployed on Railway | Status: Healthy ✅</p>
      </div>
    </div>
  );
}