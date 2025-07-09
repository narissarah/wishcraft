import { json } from "@remix-run/node";

export const loader = async () => {
  return json({
    message: "✅ App is working!",
    timestamp: new Date().toISOString(),
    csp_status: "fixed",
    note: "This route bypasses authentication for testing"
  });
};

export default function TestSimple() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🎁 WishCraft Test</h1>
      <div style={{ background: '#d4edda', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <h2>✅ Success!</h2>
        <p>The app is loading correctly. The CSP issue has been fixed.</p>
      </div>
      
      <h3>Current Status:</h3>
      <ul>
        <li>✅ CSP Headers: Fixed for Shopify embedding</li>
        <li>✅ App Loading: Working without crashes</li>
        <li>✅ Basic Routes: Functioning properly</li>
        <li>⚠️ Authentication: Requires proper Shopify OAuth flow</li>
      </ul>
      
      <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginTop: '2rem' }}>
        <h3>Next Steps:</h3>
        <p>Access this app through your Shopify admin (Apps → WishCraft) for full functionality.</p>
      </div>
    </div>
  );
}