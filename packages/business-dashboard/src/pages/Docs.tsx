import { useState, useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { apiFetch } from '../api';

interface Plan {
  tier: string;
  displayName: string;
  priceUsd: number;
  tokenBudgetUsd: number;
}

const sections = [
  { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
  { id: 'subscription',    label: 'Subscription',    icon: '💳' },
  { id: 'whatsapp',        label: 'WhatsApp Setup',  icon: '💬' },
  { id: 'catalogue',       label: 'Catalogue',       icon: '🛍️' },
  { id: 'training',        label: 'Training',        icon: '📚' },
  { id: 'conversations',   label: 'Conversations',   icon: '🗨️' },
  { id: 'orders',          label: 'Orders',          icon: '📦' },
  { id: 'revenue',         label: 'Revenue',         icon: '💰' },
  { id: 'payments',        label: 'Payment Settings',icon: '⚙️' },
  { id: 'support',         label: 'Support',         icon: '🎧' },
];

const ACCENT = '#3182ce';
const LIGHT = '#ebf8ff';

export default function Docs() {
  const isMobile = useIsMobile();
  const [active, setActive] = useState('getting-started');
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    apiFetch<{ plans: Plan[] }>('/subscription/plans')
      .then(r => setPlans(r.plans ?? []))
      .catch(() => {});
  }, []);

  // Build plan table rows from DB data, fall back to hardcoded defaults
  const planRows: string[][] = [['Plan', 'Price / month', 'AI Tokens / month']];
  if (plans.length > 0) {
    plans.forEach(p => planRows.push([
      p.displayName,
      `$${p.priceUsd.toFixed(2)}`,
      `${(p.tokenBudgetUsd * 1000).toLocaleString()}`,
    ]));
  } else {
    planRows.push(
      ['Silver', '$31.99', '12,000'],
      ['Gold', '$61.99', '30,000'],
      ['Platinum', '$129.99', '70,000'],
    );
  }

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // On mobile, scroll the tab bar to show the active tab
    const tabEl = document.getElementById(`tab-${id}`);
    tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Mobile: horizontal scrollable tab bar */}
      {isMobile && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          display: 'flex', gap: 0,
          scrollbarWidth: 'none',
          marginBottom: 20,
          marginLeft: -14, marginRight: -14, paddingLeft: 14,
        }}>
          {sections.map(s => (
            <button
              id={`tab-${s.id}`}
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                flexShrink: 0,
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                borderBottom: active === s.id ? `2px solid ${ACCENT}` : '2px solid transparent',
                color: active === s.id ? ACCENT : '#718096',
                fontWeight: active === s.id ? 700 : 400,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Desktop: sticky sidebar */}
        {!isMobile && (
          <aside style={{
            width: 190, flexShrink: 0,
            position: 'sticky', top: 16,
            height: 'calc(100vh - 80px)', overflowY: 'auto',
            paddingRight: 16, paddingTop: 4,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Contents</p>
            {sections.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                width: '100%', textAlign: 'left',
                padding: '6px 10px', marginBottom: 2, borderRadius: 6,
                border: 'none', cursor: 'pointer', fontSize: 13,
                background: active === s.id ? LIGHT : 'transparent',
                color: active === s.id ? ACCENT : '#4a5568',
                fontWeight: active === s.id ? 600 : 400,
                transition: 'all 0.1s',
              }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </aside>
        )}

        {/* Main content */}
        <div style={{ flex: 1, paddingLeft: isMobile ? 0 : 28, paddingBottom: 60, minWidth: 0 }}>
          {/* Hero */}
          <div style={{
            background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
            borderRadius: isMobile ? 10 : 14,
            padding: isMobile ? '20px 18px' : '28px 32px',
            marginBottom: isMobile ? 24 : 36,
            color: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>Augustus Documentation</h1>
            </div>
            <p style={{ margin: 0, color: '#a0aec0', fontSize: isMobile ? 13 : 14, lineHeight: 1.6 }}>
              Your AI-powered WhatsApp sales assistant. From signing up to closing sales on autopilot.
            </p>
          </div>

          {/* Getting Started */}
          <Section id="getting-started" title="Getting Started" icon="🚀" mobile={isMobile}>
            <Step n={1} title="Create your account">
              Go to the <strong>Register</strong> page, enter your business name, email, and a password. You'll receive a verification email — click the link to activate.
            </Step>
            <Step n={2} title="Verify your email">
              Check your inbox for a verification email. Click <em>Verify Email</em>. Check spam if it doesn't arrive.
            </Step>
            <Step n={3} title="Choose a plan">
              Pick Silver, Gold, or Platinum on the <strong>Subscription</strong> page. Payment via Paynow.
            </Step>
            <Step n={4} title="Connect WhatsApp">
              Go to <strong>WhatsApp Setup</strong> and connect your WhatsApp Business number. Augustus starts handling messages automatically.
            </Step>
            <Tip>You can be up and running in under 10 minutes.</Tip>
          </Section>

          {/* Subscription */}
          <Section id="subscription" title="Subscription" icon="💳" mobile={isMobile}>
            <p style={bodyText}>Your plan controls monthly AI usage and available features.</p>
            <Table rows={planRows} />
            <ul style={listStyle}>
              <li>Credits reset each billing cycle.</li>
              <li>Sidebar progress bar shows current usage.</li>
              <li>Email alerts at 80% and 95% usage.</li>
              <li>At 100%, AI pauses until next cycle.</li>
            </ul>
            <Tip>Upgrade anytime — new limits apply immediately.</Tip>
          </Section>

          {/* WhatsApp Setup */}
          <Section id="whatsapp" title="WhatsApp Setup" icon="💬" mobile={isMobile}>
            <p style={bodyText}>Connect your WhatsApp Business number via Meta Cloud API.</p>
            <Step n={1} title="Connect via Embedded Signup">
              Click <strong>Connect with Meta</strong> and follow the guided flow.
            </Step>
            <Step n={2} title="Register your webhook">
              Click <strong>Register Webhook</strong> so Meta sends messages to Augustus.
            </Step>
            <Step n={3} title="Test it">
              Send a message to your number — it should appear in <strong>Conversations</strong> within seconds.
            </Step>
            <Tip>You can also enter credentials manually if you already have a WABA set up.</Tip>
          </Section>

          {/* Catalogue */}
          <Section id="catalogue" title="Catalogue" icon="🛍️" mobile={isMobile}>
            <p style={bodyText}>Your product catalogue powers AI product recommendations and payment links.</p>
            <ul style={listStyle}>
              <li><strong>Add products</strong> — name, price, description, stock, images.</li>
              <li><strong>Bulk import</strong> — upload an Excel file to add many products at once.</li>
              <li><strong>Stock management</strong> — out-of-stock items are hidden from the AI automatically.</li>
              <li><strong>Activate/deactivate</strong> — toggle products without deleting them.</li>
            </ul>
            <Tip>Specific descriptions help the AI answer "what's the difference?" questions accurately.</Tip>
          </Section>

          {/* Training */}
          <Section id="training" title="Training" icon="📚" mobile={isMobile}>
            <p style={bodyText}>Training data shapes how Augustus talks to your customers.</p>
            <Table rows={[
              ['Type', 'What to upload'],
              ['Description', 'Your business story and values'],
              ['FAQs', 'Common questions and answers'],
              ['Tone', 'How the AI should sound'],
              ['Logo', 'Your business logo'],
              ['Documents', 'Price lists, policies, menus'],
            ]} />
            <Tip>Upload tone guidelines like "Be warm, use emojis occasionally" to match your brand voice.</Tip>
          </Section>

          {/* Conversations */}
          <Section id="conversations" title="Conversations" icon="🗨️" mobile={isMobile}>
            <p style={bodyText}>All active customer conversations in real time. AI handles them — you can step in anytime.</p>
            <ul style={listStyle}>
              <li><strong>View thread</strong> — tap <em>View</em> to see the full message history.</li>
              <li><strong>Take over</strong> — switch to manual mode and type replies directly.</li>
              <li><strong>Hand back to AI</strong> — resume automated responses when done.</li>
              <li><strong>Lead labels</strong> — 🔥 Hot, 🌡️ Warm, 👀 Browsing, ❄️ Cold — set automatically by AI.</li>
              <li><strong>Broadcast</strong> — send a message to multiple contacts at once.</li>
            </ul>
            <Tip>Use manual takeover for complex negotiations. The AI picks up context when you hand back.</Tip>
          </Section>

          {/* Orders */}
          <Section id="orders" title="Orders" icon="📦" mobile={isMobile}>
            <p style={bodyText}>Every purchase creates an order here. Track status, update progress, export records.</p>
            <Table rows={[
              ['Status', 'Meaning'],
              ['Pending', 'Payment link sent'],
              ['Awaiting Payment', 'Invoice sent'],
              ['Processing', 'Payment confirmed'],
              ['Shipped', 'Dispatched'],
              ['Completed', 'Done'],
            ]} />
            <ul style={listStyle}>
              <li>Tap any order to expand and update its status.</li>
              <li>Filter by date, status, or product name.</li>
              <li>Export all orders as CSV.</li>
              <li>Tap customer number to open WhatsApp directly.</li>
            </ul>
          </Section>

          {/* Revenue */}
          <Section id="revenue" title="Revenue" icon="💰" mobile={isMobile}>
            <p style={bodyText}>Track earnings and request payouts.</p>
            <ul style={listStyle}>
              <li><strong>Available Balance</strong> — funds ready to withdraw.</li>
              <li><strong>Lifetime Revenue</strong> — total earnings since you started.</li>
              <li><strong>Request Withdrawal</strong> — select amount and payment method.</li>
              <li><strong>History</strong> — all past withdrawal requests and their status.</li>
            </ul>
            <Tip>Configure your payment method in <strong>Payment Settings</strong> before requesting a withdrawal.</Tip>
          </Section>

          {/* Payment Settings */}
          <Section id="payments" title="Payment Settings" icon="⚙️" mobile={isMobile}>
            <p style={bodyText}>Control how customers pay for orders.</p>
            <ul style={listStyle}>
              <li><strong>In-chat payments (Paynow)</strong> — AI generates a payment link automatically on confirmed orders.</li>
              <li><strong>Manual payments</strong> — AI sends an invoice with your EcoCash/bank details instead.</li>
            </ul>
            <Tip>Add multiple payment methods so customers can choose how to pay.</Tip>
          </Section>

          {/* Support */}
          <Section id="support" title="Support" icon="🎧" mobile={isMobile}>
            <p style={bodyText}>Need help? Submit a ticket directly from the dashboard.</p>
            <ul style={listStyle}>
              <li>Click <strong>New Ticket</strong>, describe your issue, and submit.</li>
              <li>You'll get an email confirmation with your ticket reference.</li>
              <li>Track status — Open, In Progress, or Closed.</li>
              <li>Email notification when your ticket status changes.</li>
            </ul>
            <Tip>Include screenshots, order references, or error messages for faster resolution.</Tip>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ id, title, icon, children, mobile }: { id: string; title: string; icon: string; children: React.ReactNode; mobile: boolean }) {
  return (
    <div id={id} style={{ marginBottom: mobile ? 36 : 48, scrollMarginTop: mobile ? 56 : 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e2e8f0' }}>
        <span style={{ fontSize: mobile ? 18 : 22 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: mobile ? 17 : 20, color: '#1a202c', fontWeight: 700 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, marginTop: 1 }}>
        {n}
      </div>
      <div>
        <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14, color: '#2d3748' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 13, color: '#4a5568', lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, background: LIGHT, border: `1px solid #bee3f8`, borderRadius: 8, padding: '10px 12px', marginTop: 12, fontSize: 13, color: '#2b6cb0' }}>
      <span style={{ flexShrink: 0 }}>💡</span>
      <span>{children}</span>
    </div>
  );
}

function Table({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 280 }}>
        <thead>
          <tr style={{ background: '#f7fafc' }}>
            {header.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#4a5568', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
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

const bodyText: React.CSSProperties = { fontSize: 14, color: '#4a5568', lineHeight: 1.7, margin: '0 0 12px' };
const listStyle: React.CSSProperties = { fontSize: 14, color: '#4a5568', lineHeight: 1.8, margin: '0 0 12px', paddingLeft: 18 };
