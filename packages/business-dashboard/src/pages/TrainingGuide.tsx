import { useState } from 'react';
import { Link } from 'react-router-dom';

const ACCENT = '#3182ce';
const LIGHT = '#ebf8ff';

const sections = [
  { id: 'description', label: '🏢 Business Description', color: '#3182ce', bg: '#ebf8ff' },
  { id: 'faq', label: '❓ FAQs', color: '#6b46c1', bg: '#faf5ff' },
  { id: 'tone', label: '🎨 Tone & Style', color: '#b7791f', bg: '#fffff0' },
  { id: 'tips', label: '💡 Pro Tips', color: '#276749', bg: '#f0fff4' },
];

export default function TrainingGuide() {
  const [active, setActive] = useState('description');

  return (
    <div style={{ maxWidth: 860, fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Link to="/dashboard/training" style={{ color: '#718096', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back to Training
        </Link>
      </div>
      <div style={{ background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)', borderRadius: 14, padding: '28px 32px', marginBottom: 32, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 28 }}>✍️</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Training Templates & Brand Guide</h1>
        </div>
        <p style={{ margin: 0, color: '#a0aec0', fontSize: 14, lineHeight: 1.7 }}>
          The better you train your AI, the better it sells. Use these templates and examples to build a strong brand voice that converts customers.
        </p>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            padding: '8px 16px', borderRadius: 20, border: `1px solid ${active === s.id ? s.color : '#e2e8f0'}`,
            background: active === s.id ? s.bg : '#fff', color: active === s.id ? s.color : '#718096',
            fontWeight: active === s.id ? 700 : 400, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Business Description ── */}
      {active === 'description' && (
        <div>
          <Intro>Your business description is the AI's foundation. It uses this to introduce your brand, answer "what do you sell?" questions, and set the context for every conversation.</Intro>

          <Section title="Minimal Template" accent="#3182ce">
            <Template>{`[Business Name] is a [type of business] based in [location]. We sell [main products/services]. Our customers are [target audience]. We are known for [key differentiator — e.g. fast delivery, quality, affordability].`}</Template>
          </Section>

          <Section title="Strong Example — Fashion Store" accent="#6b46c1">
            <Template>{`Zara Boutique is a women's fashion store based in Harare, Zimbabwe. We specialise in trendy, affordable clothing for women aged 18–40 — from casual everyday wear to elegant evening outfits.

Our collection includes dresses, tops, jeans, skirts, and accessories. We source directly from trusted suppliers to keep prices competitive without compromising quality.

We offer same-day delivery within Harare and nationwide shipping within 3–5 business days. All orders come with a 7-day exchange policy.`}</Template>
          </Section>

          <Section title="Strong Example — Food Business" accent="#276749">
            <Template>{`Mama's Kitchen is a home-based catering and meal prep service in Bulawayo. We prepare fresh, home-cooked meals using traditional Zimbabwean recipes with a modern twist.

Our menu includes sadza dishes, grilled meats, vegetable stews, and custom meal plans for busy families and professionals. We cater for events, offices, and daily meal subscriptions.

Orders placed before 10am are delivered the same day. We use eco-friendly packaging and source ingredients locally.`}</Template>
          </Section>

          <Section title="Strong Example — Electronics Shop" accent="#c05621">
            <Template>{`TechZone is an electronics and accessories retailer operating online and from our Avondale store in Harare. We stock phones, laptops, tablets, earphones, chargers, and smart home devices from brands like Samsung, Apple, Xiaomi, and Hisense.

We offer genuine products with manufacturer warranties, competitive pricing, and flexible payment options including EcoCash and bank transfer. Free delivery on orders over $50 within Harare.`}</Template>
          </Section>

          <Tip>Include your location, delivery policy, and what makes you different. The AI will use all of this when customers ask questions.</Tip>
        </div>
      )}

      {/* ── FAQs ── */}
      {active === 'faq' && (
        <div>
          <Intro>FAQs are the most powerful training input. Every question you add is one the AI can answer instantly and accurately — reducing back-and-forth and building customer trust.</Intro>

          <Section title="Format to Use" accent="#6b46c1">
            <Template>{`Q: [Customer question]
A: [Your answer]

Q: [Another question]
A: [Answer]`}</Template>
          </Section>

          <Section title="Delivery & Shipping FAQs" accent="#3182ce">
            <Template>{`Q: Do you deliver?
A: Yes! We deliver nationwide. Orders within Harare arrive same-day if placed before 2pm. Other cities take 2–4 business days.

Q: How much is delivery?
A: Delivery within Harare is $2. Nationwide shipping starts at $5 depending on location.

Q: Can I track my order?
A: Yes, we send a tracking link via WhatsApp once your order is dispatched.

Q: What if my order is late?
A: Contact us immediately and we'll investigate. We guarantee delivery or a full refund.`}</Template>
          </Section>

          <Section title="Payment FAQs" accent="#276749">
            <Template>{`Q: How do I pay?
A: We accept EcoCash, bank transfer (ZB Bank, CBZ), and cash on delivery within Harare.

Q: Is it safe to pay online?
A: Yes. All payments go through Paynow, Zimbabwe's trusted payment gateway. We never store your card details.

Q: Can I pay on delivery?
A: Cash on delivery is available for Harare orders only. A $1 COD fee applies.

Q: Do you offer payment plans?
A: For orders over $100, we offer a 50% deposit with the balance on delivery.`}</Template>
          </Section>

          <Section title="Returns & Exchanges" accent="#c05621">
            <Template>{`Q: Can I return a product?
A: Yes, within 7 days of delivery if the item is unused and in original packaging.

Q: What if I received the wrong item?
A: We'll collect it and send the correct item at no extra cost within 24 hours.

Q: Do you offer refunds?
A: Yes, full refunds are processed within 3–5 business days to your original payment method.`}</Template>
          </Section>

          <Tip>Add at least 10–15 FAQs. Think about every question a new customer might ask before buying. The more you add, the less the AI has to guess.</Tip>
        </div>
      )}

      {/* ── Tone & Style ── */}
      {active === 'tone' && (
        <div>
          <Intro>Tone guidelines shape how the AI sounds — its personality, energy, and communication style. This is what makes your brand feel human and memorable.</Intro>

          <Section title="Friendly & Casual (Best for most businesses)" accent="#b7791f">
            <Template>{`Be warm, friendly, and conversational. Use simple language that anyone can understand. Keep replies short — 1 to 2 sentences unless more detail is needed.

Use emojis occasionally to add personality (😊 ✅ 🛍️) but don't overdo it. Address customers by name if known. Always end with a helpful question or next step.

Avoid corporate jargon. Sound like a helpful friend, not a formal company.`}</Template>
          </Section>

          <Section title="Professional & Formal (Services, B2B)" accent="#3182ce">
            <Template>{`Maintain a professional, courteous tone at all times. Use complete sentences and proper grammar. Avoid slang or informal language.

Address customers respectfully. Provide clear, accurate information. When in doubt, offer to connect them with a human agent.

Responses should be concise but thorough. Always confirm understanding before proceeding.`}</Template>
          </Section>

          <Section title="Energetic & Bold (Youth brands, streetwear, food)" accent="#c53030">
            <Template>{`Keep it hype! Short, punchy replies with energy. Use exclamation points and emojis freely 🔥💯. Match the customer's vibe — if they're excited, be excited back.

Get straight to the point. No long paragraphs. Make buying feel easy and fun. Use phrases like "Let's get it!", "You're going to love this!", "That's a great pick!"`}</Template>
          </Section>

          <Section title="Luxury & Premium (High-end products)" accent="#6b46c1">
            <Template>{`Speak with elegance and confidence. Every word should reflect quality and exclusivity. Use refined language — "exquisite", "crafted", "curated", "bespoke".

Never rush the customer. Take time to describe the value and craftsmanship. Make them feel special and understood. Avoid discounts unless absolutely necessary — focus on value.`}</Template>
          </Section>

          <Tip>Copy one of these templates and customise it to match your brand. You can also mix styles — e.g. "friendly but professional, with occasional emojis."</Tip>
        </div>
      )}

      {/* ── Pro Tips ── */}
      {active === 'tips' && (
        <div>
          <Intro>These tips will help you get the most out of your AI agent and build a brand that customers remember and trust.</Intro>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TipCard n={1} title="Start with the basics, then build up">
              Add a business description first, then FAQs, then tone. You can always come back and add more. The AI improves with every entry you add.
            </TipCard>
            <TipCard n={2} title="Be specific in your FAQs">
              "We deliver in 2 days" is better than "We deliver fast." Specific answers build trust and reduce customer anxiety before buying.
            </TipCard>
            <TipCard n={3} title="Upload your price list as a document">
              If you have a PDF price list or product catalogue, upload it under Documents. The AI will reference it when customers ask about pricing.
            </TipCard>
            <TipCard n={4} title="Update your training when things change">
              Changed your delivery policy? Updated your prices? Add a new FAQ entry. The AI uses your latest training data within minutes.
            </TipCard>
            <TipCard n={5} title="Your logo matters more than you think">
              Upload a high-quality logo. It appears on your WhatsApp Business profile — the first thing customers see before they even message you.
            </TipCard>
            <TipCard n={6} title="Add your unique selling points explicitly">
              Don't assume the AI knows what makes you special. Write it out: "We are the only store in Harare that offers same-day custom printing." The AI will use this to differentiate you.
            </TipCard>
            <TipCard n={7} title="Include your return and refund policy">
              Customers hesitate to buy when they're unsure about returns. A clear policy in your FAQs removes that hesitation and increases conversions.
            </TipCard>
            <TipCard n={8} title="Test your AI after training">
              After adding training data, send a test message to your WhatsApp number. Ask it about your products, delivery, and prices. See how it responds and refine your training accordingly.
            </TipCard>
          </div>

          <div style={{ marginTop: 28, padding: '16px 20px', background: LIGHT, border: `1px solid #bee3f8`, borderRadius: 10, fontSize: 14, color: '#2b6cb0' }}>
            <strong>Ready to train your AI?</strong>{' '}
            <Link to="/dashboard/training" style={{ color: ACCENT, fontWeight: 600 }}>Go to Training →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Intro({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.7, margin: '0 0 20px', padding: '12px 16px', background: '#f7fafc', borderRadius: 8, borderLeft: '3px solid #3182ce' }}>{children}</p>;
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 14, color: accent, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 3, height: 16, background: accent, borderRadius: 2, display: 'inline-block' }} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Template({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div style={{ position: 'relative', background: '#1a202c', borderRadius: 8, padding: '14px 16px', marginBottom: 4 }}>
      <pre style={{ margin: 0, fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'inherit' }}>{children}</pre>
      <button onClick={copy} style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', background: copied ? '#38a169' : '#2d3748', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, background: '#fffff0', border: '1px solid #f6e05e', borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 13, color: '#744210' }}>
      <span style={{ flexShrink: 0 }}>💡</span>
      <span>{children}</span>
    </div>
  );
}

function TipCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{n}</div>
      <div>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#1a202c' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 13, color: '#4a5568', lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  );
}
