/**
 * Conversation Engine Simulation — 100 test messages
 * Calls /webhooks/sim-message to run processInboundMessage directly.
 *
 * Run: BUSINESS_ID=<uuid> CUSTOMER_WA=<phone> node packages/e2e/smoke/conversation.sim.js
 */

const BASE = process.env.API_BASE_URL ?? 'https://augustus.silverconne.com';
const BUSINESS_ID = process.env.BUSINESS_ID ?? 'a6ed5b90-cd30-46fd-af27-a51a550ee08f';
const CUSTOMER_WA = process.env.CUSTOMER_WA ?? '263783673079';

// 100 realistic test messages covering all conversation scenarios
const MESSAGES = [
  // Greetings (10)
  'Hi', 'Hello', 'Hey there', 'Good morning', 'Hie',
  'Sawubona', 'Ndeipi', 'Mhoro', 'Hi there!', 'Howdy',
  // Product inquiries (15)
  'What do you sell?', 'Show me your products', 'What do you have available?',
  'Do you have shoes?', 'What are your prices?', 'Show me what you have',
  'I want to see your catalogue', 'What products are in stock?',
  'Tell me about your products', 'What items do you carry?',
  'Do you have electronics?', 'What brands do you stock?',
  'Show me everything', "What's new?", 'Any new arrivals?',
  // Specific product questions (10)
  'Tell me about the AIRMAX', 'How much is the AIRMAX?', 'Is the AIRMAX available?',
  'What sizes do you have?', 'Do you have it in black?', 'What colors are available?',
  'Is it genuine?', "What's the quality like?", 'Any reviews?', 'Is it durable?',
  // Price sensitivity (8)
  "That's too expensive", 'Can you give me a discount?', 'Do you have anything cheaper?',
  "What's your best price?", 'Is there a sale?', 'Any promotions?',
  'Can you do better on the price?', "What's the minimum price?",
  // Purchase intent (12)
  'I want to buy', "I'll take one", 'I want to order', 'How do I pay?',
  'I want 2 of those', "I'll take the AIRMAX",
  'I want to order the AIRMAX', 'Yes I want to buy it', 'Confirm my order',
  "I'd like to order 1 AIRMAX", 'Yes please', 'Proceed with the order',
  // Casual responses (10)
  'Ok', 'Thanks', 'Got it', 'Sure', 'Alright',
  'Cool', 'Great', 'Sounds good', 'Perfect', 'Awesome',
  // Complaints (5)
  'The product I received was damaged', 'I have a complaint',
  'This is not what I ordered', 'I want a refund', 'The quality is bad',
  // Off-topic (5)
  "What's the weather like?", 'Tell me a joke',
  'Are you a robot?', 'Who made you?', 'What time is it?',
  // Follow-up questions (8)
  'Can you tell me more?', 'What else do you have?', 'Show me more options',
  'Any other products?', 'What about accessories?',
  'What was the price again?', 'Can you repeat that?', 'I forgot the price',
  // Negotiation (4)
  "I'll pay $40 for it", 'Best I can do is $35',
  'Meet me halfway', 'Can we negotiate?',
  // Availability (4)
  'Is it in stock?', 'When will it be available?',
  'How many do you have left?', 'Is it limited edition?',
  // Order status (4)
  'Where is my order?', 'Has my order been shipped?',
  'When will I receive it?', 'Track my order',
  // Goodbye (5)
  'Bye', 'Thanks bye', 'Talk later', 'Goodbye', 'See you',
];

// Pad to exactly 100
while (MESSAGES.length < 100) MESSAGES.push(`Test message ${MESSAGES.length + 1}`);
const msgs = MESSAGES.slice(0, 100);

let passed = 0;
let failed = 0;
const errors = [];
const timings = [];

console.log(`\n🧪 Conversation Engine Simulation — 100 messages`);
console.log(`   Target:   ${BASE}`);
console.log(`   Business: ${BUSINESS_ID}`);
console.log(`   Customer: ${CUSTOMER_WA}`);
console.log(`${'─'.repeat(65)}\n`);

for (let i = 0; i < msgs.length; i++) {
  const msg = msgs[i];
  const num = String(i + 1).padStart(3, '0');
  const start = Date.now();

  try {
    const res = await fetch(`${BASE}/webhooks/sim-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: BUSINESS_ID, customerWaNumber: CUSTOMER_WA, messageText: msg }),
    });

    const elapsed = Date.now() - start;
    timings.push(elapsed);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const action = data.result?.action?.type ?? 'text';
      const dispatched = data.result?.dispatched !== false ? '✓' : '⊘';
      console.log(`  ${num} ${dispatched}  [${action.padEnd(8)}] ${elapsed}ms  "${msg.slice(0, 45)}${msg.length > 45 ? '…' : ''}"`);
      passed++;
    } else {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const errMsg = data.error ?? `HTTP ${res.status}`;
      console.error(`  ${num} ✗  [${elapsed}ms] "${msg.slice(0, 45)}" → ${errMsg}`);
      failed++;
      errors.push({ i: i + 1, msg: msg.slice(0, 60), error: errMsg });
    }

    // 200ms delay between messages
    await new Promise(r => setTimeout(r, 200));
  } catch (err) {
    const elapsed = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`  ${num} ✗  [${elapsed}ms] "${msg.slice(0, 45)}" → ${errMsg}`);
    failed++;
    errors.push({ i: i + 1, msg: msg.slice(0, 60), error: errMsg });
  }
}

const avgMs = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : 0;
const maxMs = timings.length ? Math.max(...timings) : 0;
const minMs = timings.length ? Math.min(...timings) : 0;

console.log(`\n${'─'.repeat(65)}`);
console.log(`Results:  ${passed} passed, ${failed} failed`);
console.log(`Timing:   avg ${avgMs}ms  min ${minMs}ms  max ${maxMs}ms`);

if (errors.length > 0) {
  console.log(`\n❌ Errors (${errors.length}):`);
  errors.forEach(({ i, msg, error }) => {
    console.log(`  [${i}] "${msg}"`);
    console.log(`       → ${error}`);
  });
  process.exit(1);
} else {
  console.log(`\n✅ All 100 messages processed successfully.\n`);
}
