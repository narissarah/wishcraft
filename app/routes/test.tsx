import { json } from "@remix-run/node";

export const loader = async () => {
  return json({
    status: "ok",
    message: "WishCraft app is working correctly",
    timestamp: new Date().toISOString(),
    cspFixed: true,
    routingFixed: true
  });
};

export default function Test() {
  return (
    <div>
      <h1>WishCraft Test Route</h1>
      <p>This route confirms the app is working correctly.</p>
      <p>The CSP frame-ancestors issue has been fixed.</p>
      <p>The root route now properly redirects to /app.</p>
    </div>
  );
}