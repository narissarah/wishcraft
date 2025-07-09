import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  return json({
    message: "WishCraft is working!",
    cspFixed: true,
    timestamp: new Date().toISOString()
  });
};

export default function EmbedTest() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>🎉 WishCraft App Test</h1>
      <p><strong>Status:</strong> {data.message}</p>
      <p><strong>CSP Fixed:</strong> {data.cspFixed ? "✅ Yes" : "❌ No"}</p>
      <p><strong>Timestamp:</strong> {data.timestamp}</p>
      <p><strong>Frame Context:</strong> {typeof window !== "undefined" ? (window.parent !== window ? "Embedded" : "Standalone") : "Server"}</p>
    </div>
  );
}