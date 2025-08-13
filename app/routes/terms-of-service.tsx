import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service - WishCraft" },
    { name: "description", content: "Terms of service for WishCraft gift registry app" },
  ];
};

export default function TermsOfService() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Terms of Service</h1>
      <p><em>Last updated: {new Date().toLocaleDateString()}</em></p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By installing and using WishCraft ("the App"), you agree to be bound by these Terms of Service. 
        If you do not agree to these terms, please do not use the App.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        WishCraft is a gift registry application for Shopify stores that allows customers to create and manage 
        wish lists for various occasions including weddings, birthdays, baby showers, and other events.
      </p>

      <h2>3. Account Responsibilities</h2>
      <p>You are responsible for:</p>
      <ul>
        <li>Maintaining the confidentiality of your account</li>
        <li>All activities that occur under your account</li>
        <li>Ensuring all information provided is accurate and current</li>
        <li>Complying with all applicable laws and regulations</li>
      </ul>

      <h2>4. Acceptable Use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Use the App for any illegal or unauthorized purpose</li>
        <li>Interfere with or disrupt the App's functionality</li>
        <li>Attempt to gain unauthorized access to any systems</li>
        <li>Upload malicious code or harmful content</li>
        <li>Violate any third party's rights</li>
      </ul>

      <h2>5. Intellectual Property</h2>
      <p>
        All content, features, and functionality of WishCraft are owned by us and are protected by international 
        copyright, trademark, and other intellectual property laws.
      </p>

      <h2>6. Privacy and Data Protection</h2>
      <p>
        Your use of the App is also governed by our Privacy Policy. By using the App, you consent to our 
        collection and use of information as outlined in the Privacy Policy.
      </p>

      <h2>7. Pricing and Payment</h2>
      <ul>
        <li>Pricing is subject to change with 30 days notice</li>
        <li>Billing is processed through Shopify</li>
        <li>Free trial periods may be offered at our discretion</li>
        <li>Refunds are handled according to Shopify's policies</li>
      </ul>

      <h2>8. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WISHCRAFT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP.
      </p>

      <h2>9. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless WishCraft from any claims, damages, or expenses arising from 
        your violation of these Terms or your use of the App.
      </p>

      <h2>10. Termination</h2>
      <p>
        We may terminate or suspend your access to the App immediately, without prior notice, for any reason, 
        including breach of these Terms.
      </p>

      <h2>11. Changes to Terms</h2>
      <p>
        We reserve the right to modify these Terms at any time. We will notify users of any material changes 
        via email or through the App.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which 
        WishCraft operates, without regard to conflict of law principles.
      </p>

      <h2>13. Contact Information</h2>
      <p>
        For questions about these Terms, please contact us at:
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