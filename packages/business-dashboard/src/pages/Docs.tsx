import { useState } from 'react';

const sections = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'whatsapp', label: 'WhatsApp Setup' },
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'training', label: 'Training' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'orders', label: 'Orders' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'payments', label: 'Payment Settings' },
  { id: 'support', label: 'Support' },
];

const ACCENT = '#3182ce';
const LIGHT = '#ebf8ff';

export default function Docs() {
  const [active, setActive] = useState('getting-started');

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ display: 'flex', gap: 0, maxWidth: 1100, margin: '0 auto' }}>
      {/* Sticky sidebar */}
      <aside style={{
        width: 200, flexShrink: 0, position: 'sticky', top: 0,
        height: '100vh', overflowY: 'auto', paddingTop: 8, paddingRight: 16,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>Contents</p>
        {sections.map(s => (
          <button key={s.id} onClick={() => scrollTo(s.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '6px 10px', marginBottom: 2, borderRadius: 6,
            border: 'none', cursor: 'pointer', fontSize: 13,
            background: active === s.id ? LIGHT : 'transparent',
            color: active === s.id ? ACCENT : '#4a5568',
            fontWeight: active === s.id ? 600 : 400,
            transition: 'all 0.1s',
          }}>
            {s.label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, paddingLeft: 32, paddingBottom: 80 }}>
        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg, #1a202c 0%, #2d3748 100%)`, borderRadius: 14, padding: '32px 36px', marginBottom: 40, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Augustus Documentation</h1>
          </div>
          <p style={{ margin: 0, color: '#a0aec0', fontSize: 15, lineHeight: 1.6 }}>
            Your AI-powered WhatsApp sales assistant. This guide walks you through everything — from signing up to closing sales on autopilot.
          </p>
        </div>

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started" icon="🚀">
          <Step n={1} title="Create your account">
            Go to the <strong>Register</strong> page, enter your business name, email, and a password. You'll receive a verification email — click the link to activate your account.
          </Step>
          <Step n={2} title="Verify your email">
            Check your inbox for a verification email from Augustus. Click <em>Verify Email</em>. If it doesn't arrive within a few minutes, check your spam folder.
          </Step>
          <Step n={3} title="Choose a plan">
            After verifying, you'll land on the <strong>Subscription</strong> page. Pick a plan that fits your business — Silver, Gold, or Platinum. Payment is processed via Paynow.
          </Step>
          <Step n={4} title="Connect WhatsApp">
            Head to <strong>WhatsApp Setup</strong> and connect your WhatsApp Business number. Once connected, Augustus starts handling customer messages automatically.
          </Step>
          <Tip>You can be up and running in under 10 minutes.</Tip>
        </Section>

        {/* Subscription */}
        <Section id="subscription" title="Subscription" icon="💳">
          <p style={bodyText}>Your subscription controls how much AI usage you get each month and which features are available.</p>
          <Table rows={[
            ['Plan', 'Monthly Price', 'AI Credits'],
            ['Silver', '$31.99', '12,000 credits'],
            ['Gold', '$61.99', '30,000 credits'],
            ['Platinum', '$129.99', '70,000 credits'],
          ]} />
          <ul style={listStyle}>
            <li>Credits reset at the start of each billing cycle.</li>
            <li>The progress bar in the sidebar shows your current usage.</li>
            <li>You'll receive email alerts at 80% and 95% usage.</li>
            <li>At 100%, AI responses pause until the next cycle.</li>
          </ul>
          <Tip>To upgrade, select a higher plan and pay via Paynow. The new limits apply immediately.</Tip>
        </Section>

        {/* WhatsApp Setup */}
        <Section id="whatsapp" title="WhatsApp Setup" icon="💬">
          <p style={bodyText}>Augustus connects to your WhatsApp Business number via the Meta Cloud API. You need a WhatsApp Business Account (WABA) to proceed.</p>
          <Step n={1} title="Connect via Embedded Signup">
            Click <strong>Connect with Meta</strong> and follow the guided flow. Augustus will request access to your WABA and phone number.
          </Step>
          <Step n={2} title="Register your webhook">
            After connecting, click <strong>Register Webhook</strong>. This tells Meta to send incoming messages to Augustus.
          </Step>
          <Step n={3} title="Test it">
            Send a message to your WhatsApp number from any phone. You should see it appear in <strong>Conversations</strong> within seconds.
          </Step>
          <Tip>If you already have a WABA set up, you can also enter your credentials manually using the manual entry option.</Tip>
        </Section>

        {/* Catalogue */}
        <Section id="catalogue" title="Catalogue" icon="🛍️">
          <p style={bodyText}>Your product catalogue is what Augustus uses to answer product questions, show items to customers, and generate payment links.</p>
          <ul style={listStyle}>
            <li><strong>Add products</strong> — name, price, description, stock quantity, and images.</li>
            <li><strong>Upload images</strong> — drag and drop or click to upload. Multiple images per product are supported.</li>
            <li><strong>Bulk import</strong> — upload an Excel file (.xlsx) to add many products at once. Download the template for the correct format.</li>
            <li><strong>Stock management</strong> — set quantities. Out-of-stock items are hidden from the AI automatically.</li>
            <li><strong>Activate/deactivate</strong> — toggle products on or off without deleting them.</li>
          </ul>
          <Tip>Keep product descriptions concise but specific — the AI uses them to answer customer questions accurately.</Tip>
        </Section>

        {/* Training */}
        <Section id="training" title="Training" icon="📚">
          <p style={bodyText}>Training data shapes how Augustus talks to your customers. The more context you give it, the better it performs.</p>
          <Table rows={[
            ['Type', 'What to upload'],
            ['Business Description', 'What your business does, your story, your values'],
            ['FAQs', 'Common questions and answers about your products or policies'],
            ['Tone Guidelines', 'How you want the AI to sound — formal, casual, friendly, etc.'],
            ['Logo', 'Your business logo (also syncs to your WhatsApp profile photo)'],
            ['Documents', 'Price lists, menus, brochures, or any reference material'],
          ]} />
          <Tip>Upload a tone guideline like "Be warm, use emojis occasionally, keep replies short" to make the AI feel more like your brand.</Tip>
        </Section>

        {/* Conversations */}
        <Section id="conversations" title="Conversations" icon="🗨️">
          <p style={bodyText}>All active customer conversations appear here in real time. The AI handles them automatically, but you can step in at any time.</p>
          <ul style={listStyle}>
            <li><strong>View thread</strong> — click <em>View</em> on any conversation to see the full message history.</li>
            <li><strong>Take over</strong> — click <em>Take over</em> to switch to manual mode. The AI pauses and you type replies directly.</li>
            <li><strong>Hand back to AI</strong> — when you're done, click <em>Hand back to AI</em> to resume automated responses.</li>
            <li><strong>Real-time updates</strong> — new messages appear automatically every 10 seconds. Hit <em>Refresh</em> for instant updates.</li>
          </ul>
          <Tip>Use manual takeover for complex negotiations or sensitive situations. The AI picks up the context when you hand back.</Tip>
        </Section>

        {/* Orders */}
        <Section id="orders" title="Orders" icon="📦">
          <p style={bodyText}>Every purchase initiated through Augustus creates an order here. You can track status, update progress, and export records.</p>
          <Table rows={[
            ['Status', 'Meaning'],
            ['Pending', 'Payment link sent, awaiting payment'],
            ['Awaiting Payment', 'Invoice sent, customer pays manually'],
            ['Processing', 'Payment confirmed, being prepared'],
            ['Shipped', 'Order dispatched'],
            ['Completed', 'Delivered and done'],
            ['Cancelled / Expired', 'Order did not complete'],
          ]} />
          <ul style={listStyle}>
            <li>Click any order to expand it and update its status.</li>
            <li>Filter by date, status, or product name.</li>
            <li>Export all orders as a CSV for your records.</li>
            <li>Customer contact numbers are shown in full — tap to open WhatsApp directly.</li>
          </ul>
        </Section>

        {/* Revenue */}
        <Section id="revenue" title="Revenue" icon="💰">
          <p style={bodyText}>Track your earnings and request payouts from your available balance.</p>
          <ul style={listStyle}>
            <li><strong>Available Balance</strong> — funds from completed orders, ready to withdraw.</li>
            <li><strong>Lifetime Revenue</strong> — total earnings since you started.</li>
            <li><strong>Request Withdrawal</strong> — enter an amount and select your payment method. Requests are reviewed and processed by the platform.</li>
            <li><strong>Withdrawal History</strong> — see all past requests and their status.</li>
          </ul>
          <Tip>Make sure your payment method is configured in <strong>Payment Settings</strong> before requesting a withdrawal.</Tip>
        </Section>

        {/* Payment Settings */}
        <Section id="payments" title="Payment Settings" icon="⚙️">
          <p style={bodyText}>Control how customers pay for orders.</p>
          <ul style={listStyle}>
            <li><strong>In-chat payments (Paynow)</strong> — when enabled, Augustus generates a Paynow link automatically when a customer confirms an order. Payment is tracked in real time.</li>
            <li><strong>External / manual payments</strong> — when disabled, Augustus sends an invoice with your configured payment details (EcoCash, bank transfer, etc.) instead.</li>
          </ul>
          <p style={bodyText}>To add a payment method for invoices:</p>
          <ol style={{ ...listStyle, paddingLeft: 20 }}>
            <li>Disable in-chat payments.</li>
            <li>Add your payment details (provider, account number, name).</li>
            <li>Save. The AI will include these details in every invoice it sends.</li>
          </ol>
          <Tip>You can add multiple payment methods — EcoCash, bank transfer, and others — so customers can choose.</Tip>
        </Section>

        {/* Support */}
        <Section id="support" title="Support" icon="🎧">
          <p style={bodyText}>Need help? Submit a support ticket directly from the dashboard.</p>
          <ul style={listStyle}>
            <li>Click <strong>New Ticket</strong>, describe your issue, and submit.</li>
            <li>You'll receive an email confirmation with your ticket reference.</li>
            <li>Track the status of your tickets — Open, In Progress, or Closed.</li>
            <li>You'll be notified by email when your ticket status changes.</li>
          </ul>
          <Tip>Include as much detail as possible — screenshots, order references, or error messages — to get faster help.</Tip>
        </Section>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ id, title, icon, children }: { id: string; title: string; icon: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 52, scrollMarginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e2e8f0' }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 20, color: '#1a202c', fontWeight: 700 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
      <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, marginTop: 1 }}>
        {n}
      </div>
      <div>
        <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: 14, color: '#2d3748' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 14, color: '#4a5568', lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, background: LIGHT, border: `1px solid #bee3f8`, borderRadius: 8, padding: '10px 14px', marginTop: 14, fontSize: 13, color: '#2b6cb0' }}>
      <span style={{ flexShrink: 0 }}>💡</span>
      <span>{children}</span>
    </div>
  );
}

function Table({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div style={{ overflowX: 'auto', marginBottom: 14 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f7fafc' }}>
            {header.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '8px 12px', color: '#2d3748' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const bodyText: React.CSSProperties = { fontSize: 14, color: '#4a5568', lineHeight: 1.7, margin: '0 0 14px' };
const listStyle: React.CSSProperties = { fontSize: 14, color: '#4a5568', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: 18 };
