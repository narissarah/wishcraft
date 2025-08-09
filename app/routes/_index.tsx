import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import indexStyles from "~/styles/index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: indexStyles }
];

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
    appUrl: process.env.SHOPIFY_APP_URL || "https://wishcraft.vercel.app",
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
        <p>WishCraft v1.1.6 | Built for Shopify 2025</p>
        <p>Deployed on Vercel | Status: Healthy ✅</p>
      </div>
    </div>
  );
}