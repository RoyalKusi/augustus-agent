import type { FastifyInstance } from 'fastify';

const STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #2d3748; line-height: 1.7; }
  h1 { color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
  h2 { color: #2d3748; margin-top: 32px; }
  a { color: #3182ce; }
  .meta { color: #718096; font-size: 14px; margin-bottom: 32px; }
`;

export async function legalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/privacy', (_req, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Augustus</title>
  <style>${STYLE}</style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="meta">Last updated: April 5, 2026 &nbsp;|&nbsp; Augustus AI Sales Platform</p>

  <p>Augustus ("we", "our", or "us") operates an AI-powered sales platform that enables businesses to connect their WhatsApp Business accounts and automate customer interactions. This Privacy Policy explains how we collect, use, and protect information.</p>

  <h2>1. Information We Collect</h2>
  <p>We collect information you provide when registering a business account, including business name, owner name, and email address. When you connect a WhatsApp Business Account, we store your WhatsApp Business Account ID, Phone Number ID, and access token (encrypted at rest). We also collect conversation data, order information, and usage metrics necessary to operate the service.</p>

  <h2>2. How We Use Your Information</h2>
  <p>We use collected information to provide and operate the Augustus platform, process payments via Paynow, send transactional emails (subscription reminders, support ticket updates), power the AI sales agent via Claude (Anthropic), and improve our services. We do not sell your personal data to third parties.</p>

  <h2>3. WhatsApp Data</h2>
  <p>Augustus integrates with the Meta WhatsApp Business API. Customer WhatsApp numbers are masked in our dashboard (last 4 digits only). Message content is processed to generate AI responses and is stored for conversation history. We comply with Meta's Platform Terms and WhatsApp Business Policy.</p>

  <h2>4. Data Security</h2>
  <p>WhatsApp access tokens are encrypted using AES-256-GCM. Passwords are hashed using bcrypt. All data is transmitted over HTTPS. We use row-level security in our database to ensure each business can only access its own data.</p>

  <h2>5. Data Retention</h2>
  <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data by contacting us at the address below.</p>

  <h2>6. Third-Party Services</h2>
  <p>We use the following third-party services: Meta WhatsApp Business API (messaging), Anthropic Claude (AI responses), Paynow (payments), SendGrid (email), Neon (database), Upstash (caching), and Cloudflare R2 (file storage). Each service has its own privacy policy.</p>

  <h2>7. Your Rights</h2>
  <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:support@silverconne.com">support@silverconne.com</a>.</p>

  <h2>8. Contact</h2>
  <p>Augustus AI Sales Platform<br/>
  Email: <a href="mailto:support@silverconne.com">support@silverconne.com</a><br/>
  Website: <a href="https://augustus.silverconne.com">https://augustus.silverconne.com</a></p>
</body>
</html>`);
  });

  app.get('/terms', (_req, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — Augustus</title>
  <style>${STYLE}</style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p class="meta">Last updated: April 5, 2026 &nbsp;|&nbsp; Augustus AI Sales Platform</p>

  <p>These Terms of Service ("Terms") govern your use of the Augustus AI Sales Platform ("Service") operated by Augustus ("we", "us", or "our"). By registering an account, you agree to these Terms.</p>

  <h2>1. Service Description</h2>
  <p>Augustus provides an AI-powered sales automation platform that connects to WhatsApp Business accounts, enabling automated customer conversations, product catalogue management, order processing, and payment collection via Paynow.</p>

  <h2>2. Account Registration</h2>
  <p>You must provide accurate business information when registering. You are responsible for maintaining the security of your account credentials. You must be authorised to connect any WhatsApp Business Account to our platform.</p>

  <h2>3. Acceptable Use</h2>
  <p>You agree to use the Service only for lawful business purposes. You must comply with Meta's WhatsApp Business Policy and all applicable laws. You may not use the Service to send spam, engage in deceptive practices, or violate any third-party rights.</p>

  <h2>4. WhatsApp Integration</h2>
  <p>By connecting a WhatsApp Business Account, you authorise Augustus to send and receive messages on your behalf. You remain responsible for all messages sent through your account. You must comply with Meta's Platform Terms at all times.</p>

  <h2>5. Subscription and Payments</h2>
  <p>Access to the Service requires an active subscription (Silver, Gold, or Platinum plan). Subscriptions are billed monthly via Paynow. Failure to pay may result in suspension of AI services. Refunds are not provided for partial billing periods.</p>

  <h2>6. AI Usage Limits</h2>
  <p>Each subscription plan includes a monthly AI credit budget. When the budget is exhausted, AI responses are suspended until the next billing cycle. You may purchase a higher plan or request an override from our support team.</p>

  <h2>7. Data Ownership</h2>
  <p>You retain ownership of your business data, product catalogue, and customer conversation data. By using the Service, you grant us a limited licence to process this data to provide the Service.</p>

  <h2>8. Service Availability</h2>
  <p>We aim for high availability but do not guarantee uninterrupted service. We are not liable for losses resulting from service downtime, third-party API failures (Meta, Paynow, Anthropic), or events outside our control.</p>

  <h2>9. Termination</h2>
  <p>We may suspend or terminate your account for violation of these Terms, non-payment, or misuse of the platform. You may cancel your account at any time from the dashboard.</p>

  <h2>10. Limitation of Liability</h2>
  <p>To the maximum extent permitted by law, Augustus is not liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>

  <h2>11. Changes to Terms</h2>
  <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>

  <h2>12. Contact</h2>
  <p>Augustus AI Sales Platform<br/>
  Email: <a href="mailto:support@silverconne.com">support@silverconne.com</a><br/>
  Website: <a href="https://augustus.silverconne.com">https://augustus.silverconne.com</a></p>
</body>
</html>`);
  });
}
