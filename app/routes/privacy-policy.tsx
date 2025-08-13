import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - WishCraft" },
    { name: "description", content: "Privacy policy for WishCraft gift registry app" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Privacy Policy</h1>
      <p><em>Last updated: {new Date().toLocaleDateString()}</em></p>

      <h2>Introduction</h2>
      <p>
        WishCraft ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, 
        use, and safeguard your information when you use our Shopify app.
      </p>

      <h2>Information We Collect</h2>
      <h3>Shop Information</h3>
      <ul>
        <li>Shop domain and basic shop details</li>
        <li>Shop owner contact information</li>
        <li>Shop settings and preferences</li>
      </ul>

      <h3>Customer Information</h3>
      <ul>
        <li>Customer names and email addresses (encrypted)</li>
        <li>Gift registry preferences and wish lists</li>
        <li>Purchase history related to registries</li>
      </ul>

      <h3>Technical Information</h3>
      <ul>
        <li>Performance metrics (Web Vitals)</li>
        <li>Error logs for debugging</li>
        <li>Usage analytics (anonymized)</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <p>We use the collected information to:</p>
      <ul>
        <li>Provide and maintain the gift registry service</li>
        <li>Process registry transactions and purchases</li>
        <li>Send notifications about registry updates</li>
        <li>Improve app performance and user experience</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>Data Security</h2>
      <p>
        We implement industry-standard security measures including:
      </p>
      <ul>
        <li>AES-256 encryption for sensitive data</li>
        <li>Secure HTTPS connections</li>
        <li>Regular security audits</li>
        <li>Access controls and authentication</li>
      </ul>

      <h2>Data Retention</h2>
      <p>
        We retain your data only as long as necessary to provide our services. Shop data is retained for 90 days after 
        app uninstallation unless deletion is requested sooner.
      </p>

      <h2>GDPR Compliance</h2>
      <p>
        We comply with GDPR requirements and provide:
      </p>
      <ul>
        <li>Right to access your data</li>
        <li>Right to rectification</li>
        <li>Right to erasure ("right to be forgotten")</li>
        <li>Right to data portability</li>
        <li>Right to object to processing</li>
      </ul>

      <h2>Third-Party Services</h2>
      <p>
        We may use third-party services for:
      </p>
      <ul>
        <li>Shopify platform integration</li>
        <li>Database hosting (PostgreSQL)</li>
        <li>Application hosting (Vercel)</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use essential cookies for:
      </p>
      <ul>
        <li>Session management</li>
        <li>CSRF protection</li>
        <li>User preferences</li>
      </ul>

      <h2>Children's Privacy</h2>
      <p>
        Our service is not directed to individuals under 13. We do not knowingly collect personal information from 
        children under 13.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any changes by updating the 
        "Last updated" date at the top of this policy.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please contact us at:
      </p>
      <p>
        Email: support@wishcraft.app<br />
        Through your Shopify admin: Apps → WishCraft → Support
      </p>

      <div style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid #ddd" }}>
        <Link to="/" style={{ color: "#007ace", textDecoration: "none" }}>← Back to Home</Link>
      </div>
    </div>
  );
}