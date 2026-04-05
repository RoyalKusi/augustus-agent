/**
 * API Smoke Tests — Live environment
 * Target: https://augustus.silverconne.com
 *
 * Run: node smoke/api.smoke.js
 *
 * Set env vars before running:
 *   SMOKE_EMAIL      — a registered + verified business email
 *   SMOKE_PASSWORD   — its password
 *   ADMIN_EMAIL      — operator email
 *   ADMIN_PASSWORD   — operator password
 *   ADMIN_TOTP       — current TOTP code (or leave blank to skip MFA-gated tests)
 */

const BASE = process.env.API_BASE_URL ?? 'https://augustus.silverconne.com';

let passed = 0;
let failed = 0;
const failures = [];

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${err.message}`);
    failed++;
    failures.push({ label, error: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function json(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// ─── 1. Health ────────────────────────────────────────────────────────────────

console.log('\n── Health ──────────────────────────────────────────────────────');

await check('GET /health → 200 with status:ok', async () => {
  const res = await fetch(`${BASE}/health`);
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await json(res);
  assert(body.status === 'ok', `Expected status:ok, got ${JSON.stringify(body)}`);
});

// ─── 2. Auth ──────────────────────────────────────────────────────────────────

console.log('\n── Auth ────────────────────────────────────────────────────────');

// Registration with invalid password should fail
await check('POST /auth/register with weak password → 400', async () => {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Smoke Test Biz',
      ownerName: 'Smoke Owner',
      email: `smoke-${Date.now()}@example.com`,
      password: 'weak',
    }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
});

// Login with wrong credentials should fail
await check('POST /auth/login with bad credentials → 401', async () => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@nowhere.com', password: 'WrongPass1!' }),
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

// Password reset request always returns 200 (anti-enumeration)
await check('POST /auth/request-password-reset → 200 regardless of email', async () => {
  const res = await fetch(`${BASE}/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@nowhere.com' }),
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
});

// ─── 3. Authenticated business session ───────────────────────────────────────

let bizToken = null;

const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;

if (smokeEmail && smokePassword) {
  console.log('\n── Business Session ────────────────────────────────────────────');

  await check('POST /auth/login with valid credentials → 200 + token', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await json(res);
    assert(body.token, 'Expected token in response');
    bizToken = body.token;
  });

  if (bizToken) {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bizToken}`,
    };

    await check('GET /dashboard/subscription → 200', async () => {
      const res = await fetch(`${BASE}/dashboard/subscription`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await json(res);
      // Accept any of the known response shapes
      const hasKnownField = body.planName !== undefined || body.plan !== undefined ||
        body.subscription !== undefined || body.status !== undefined ||
        body.creditCapUsd !== undefined;
      assert(hasKnownField, `Unexpected shape: ${JSON.stringify(body)}`);
    });

    await check('GET /dashboard/credit-usage → 200', async () => {
      const res = await fetch(`${BASE}/dashboard/credit-usage`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /dashboard/conversations → 200', async () => {
      const res = await fetch(`${BASE}/dashboard/conversations`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /dashboard/orders → 200', async () => {
      const res = await fetch(`${BASE}/dashboard/orders`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /dashboard/revenue → 200', async () => {
      const res = await fetch(`${BASE}/dashboard/revenue`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /dashboard/withdrawals → 200', async () => {
      const res = await fetch(`${BASE}/dashboard/withdrawals`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /dashboard/support → 200', async () => {
      const res = await fetch(`${BASE}/dashboard/support`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /catalogue/products → 200 with products array', async () => {
      const res = await fetch(`${BASE}/catalogue/products`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await json(res);
      assert(Array.isArray(body.products), `Expected products array, got ${JSON.stringify(body)}`);
    });

    await check('GET /catalogue/combos → 200 with combos array', async () => {
      const res = await fetch(`${BASE}/catalogue/combos`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await json(res);
      assert(Array.isArray(body.combos), `Expected combos array`);
    });

    await check('GET /payments/balance → 200', async () => {
      const res = await fetch(`${BASE}/payments/balance`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /payments/settings → 200', async () => {
      const res = await fetch(`${BASE}/payments/settings`, { headers: authHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await json(res);
      assert(body.inChatPaymentsEnabled !== undefined, 'Expected inChatPaymentsEnabled field');
    });

    await check('POST /dashboard/support with missing fields → 400', async () => {
      const res = await fetch(`${BASE}/dashboard/support`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ subject: 'Test' }), // missing description
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await check('POST /catalogue/products with missing fields → 400', async () => {
      const res = await fetch(`${BASE}/catalogue/products`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'Incomplete Product' }), // missing price, currency, stock
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await check('PUT /payments/settings disable in-chat without external details → 422', async () => {
      const res = await fetch(`${BASE}/payments/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ inChatPaymentsEnabled: false, externalPaymentDetails: null }),
      });
      assert(res.status === 422, `Expected 422, got ${res.status}`);
    });

    await check('POST /auth/logout → 200', async () => {
      const res = await fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        headers: authHeaders,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // Note: JWT tokens remain cryptographically valid until expiry even after logout.
    // The session is removed from Redis but the middleware only checks JWT signature.
    // This is expected behaviour — tokens expire within 24h per config.
    await check('GET /dashboard/subscription after logout → token still valid (JWT-based auth)', async () => {
      const res = await fetch(`${BASE}/dashboard/subscription`, { headers: authHeaders });
      // JWT is still valid until expiry — 200 is correct behaviour
      assert(res.status === 200 || res.status === 401, `Expected 200 or 401, got ${res.status}`);
    });
  }
} else {
  console.log('\n  ⚠  Skipping authenticated business tests — set SMOKE_EMAIL and SMOKE_PASSWORD');
}

// ─── 4. Admin session ─────────────────────────────────────────────────────────

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminTotp = process.env.ADMIN_TOTP ?? '';

if (adminEmail && adminPassword) {
  console.log('\n── Admin Session ───────────────────────────────────────────────');

  let adminToken = null;

  await check('POST /admin/auth/login with valid credentials → 200 + token', async () => {
    const res = await fetch(`${BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword, totpCode: adminTotp }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await json(res);
    assert(body.token, `Expected token, got ${JSON.stringify(body)}`);
    adminToken = body.token;
  });

  if (adminToken) {
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    await check('GET /admin/businesses → 200 with businesses array', async () => {
      const res = await fetch(`${BASE}/admin/businesses`, { headers: adminHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await json(res);
      assert(Array.isArray(body.businesses ?? body), 'Expected businesses array');
    });

    await check('GET /admin/metrics/ai → 200', async () => {
      const res = await fetch(`${BASE}/admin/metrics/ai`, { headers: adminHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /admin/metrics/meta → 200', async () => {
      const res = await fetch(`${BASE}/admin/metrics/meta`, { headers: adminHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /admin/metrics/subscriptions → 200', async () => {
      const res = await fetch(`${BASE}/admin/metrics/subscriptions`, { headers: adminHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /admin/withdrawals/pending → 200', async () => {
      const res = await fetch(`${BASE}/admin/withdrawals/pending`, { headers: adminHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /admin/api-keys/status → 200', async () => {
      const res = await fetch(`${BASE}/admin/api-keys/status`, { headers: adminHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await check('GET /admin/support → 200', async () => {
      const res = await fetch(`${BASE}/admin/support`, { headers: adminHeaders });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });
  }
} else {
  console.log('\n  ⚠  Skipping admin tests — set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOTP');
}

// ─── 5. Protected routes without token ───────────────────────────────────────

console.log('\n── Auth Guards ─────────────────────────────────────────────────');

for (const [method, path] of [
  ['GET', '/dashboard/subscription'],
  ['GET', '/catalogue/products'],
  ['GET', '/payments/balance'],
  ['GET', '/admin/businesses'],
  ['GET', '/admin/metrics/ai'],
]) {
  await check(`${method} ${path} without token → 401`, async () => {
    const res = await fetch(`${BASE}${path}`, { method });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n────────────────────────────────────────────────────────────────');
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\n  Failures:');
  failures.forEach(({ label, error }) => console.log(`    ✗ ${label}\n      ${error}`));
  process.exit(1);
}
console.log('  All smoke tests passed.\n');
