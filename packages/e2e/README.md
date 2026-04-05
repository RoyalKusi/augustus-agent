# Augustus E2E Tests

Live tests targeting **https://augustus.silverconne.com**.

## Setup

```bash
cd augustus/packages/e2e
npm install
npx playwright install chromium
```

Copy and fill in credentials:

```bash
cp .env.example .env
# edit .env with real credentials
```

## Running

### API Smoke Tests (no browser, fast)

```bash
# Without credentials — tests health + auth guards only
node smoke/api.smoke.js

# With credentials
SMOKE_EMAIL=you@example.com SMOKE_PASSWORD=Pass1! \
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Pass1! ADMIN_TOTP=123456 \
node smoke/api.smoke.js
```

### Browser E2E Tests (Playwright)

```bash
# Headless (CI-friendly)
npx playwright test

# With credentials
SMOKE_EMAIL=you@example.com SMOKE_PASSWORD=Pass1! \
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Pass1! ADMIN_TOTP=123456 \
npx playwright test

# Headed (watch it run)
npx playwright test --headed

# Single spec
npx playwright test tests/auth.spec.ts

# View HTML report after run
npx playwright show-report
```

## Test Coverage

| Suite | What it tests |
|---|---|
| `smoke/api.smoke.js` | Health, auth guards, all dashboard/catalogue/payment/admin endpoints |
| `tests/auth.spec.ts` | Login page, wrong credentials, register validation, forgot password, unauthenticated redirect |
| `tests/business-dashboard.spec.ts` | All dashboard pages, form validation, credit widget |
| `tests/admin-dashboard.spec.ts` | Admin login, businesses list, metrics, withdrawals, API key status |

## Notes

- `ADMIN_TOTP` must be the **current** 6-digit code from your authenticator app — it expires every 30 s.
- Authenticated browser tests are skipped automatically if credentials are not set.
- Screenshots and traces are saved on failure in `playwright-report/`.
