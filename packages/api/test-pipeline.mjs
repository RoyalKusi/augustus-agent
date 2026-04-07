import crypto from 'crypto';
import https from 'https';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'ep-spring-paper-a1ci3ys0-pooler.ap-southeast-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_CdYf2hbrMS5Z',
  ssl: { rejectUnauthorized: false }
});

const secret = 'a0d73c37fdb2702472eaefab27e0c16c';
const phoneNumberId = '1041647772369067';
const fromNumber = '263712345678';
const biz = 'a6ed5b90-cd30-46fd-af27-a51a550ee08f';

// Clear old data
await pool.query("DELETE FROM messages WHERE business_id = $1", [biz]);
await pool.query("DELETE FROM conversations WHERE business_id = $1", [biz]);
console.log('✓ Cleared old data');

// Send webhook
const msgId = 'wamid.live_' + Date.now();
const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ id: 'test', changes: [{ value: {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '+91 77804 37565', phone_number_id: phoneNumberId },
    contacts: [{ profile: { name: 'Test Customer' }, wa_id: fromNumber }],
    messages: [{ from: fromNumber, id: msgId, timestamp: String(Math.floor(Date.now()/1000)), type: 'text', text: { body: 'Hi! What products do you sell?' } }]
  }, field: 'messages' }] }]
});
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

const status = await new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'augustus.silverconne.com', path: '/webhooks/whatsapp', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'X-Hub-Signature-256': sig }
  }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(res.statusCode)); });
  req.on('error', reject); req.write(payload); req.end();
});
console.log('✓ Webhook sent:', status === 200 ? '200 OK' : status);
console.log('Polling for AI response...');

let found = false;
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const msgs = await pool.query("SELECT direction, content FROM messages WHERE business_id = $1 ORDER BY created_at ASC", [biz]);
  const out = msgs.rows.find(m => m.direction === 'outbound');
  if (out) {
    const inn = msgs.rows.find(m => m.direction === 'inbound');
    console.log('\n✅ PIPELINE WORKING!');
    console.log('Customer :', '"' + inn?.content + '"');
    console.log('AI Agent :', '"' + out.content + '"');
    found = true;
    break;
  }
  process.stdout.write(i % 4 === 0 ? (i*3)+'s ' : '.');
}

if (!found) {
  const msgs = await pool.query("SELECT direction, content FROM messages WHERE business_id = $1", [biz]);
  const conv = await pool.query("SELECT message_count FROM conversations WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1", [biz]);
  console.log('\n❌ No AI response after 45s');
  console.log('Messages:', msgs.rows.length, '| Conversation message_count:', conv.rows[0]?.message_count ?? 'none');
}

await pool.end();
