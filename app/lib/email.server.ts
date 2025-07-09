export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  console.log(`Email mock: Sending email to ${to} with subject: ${subject}`);
  
  // In production, integrate with email service like SendGrid, AWS SES, etc.
  // For now, just log the email
  return Promise.resolve({ success: true, messageId: `mock-${Date.now()}` });
}