# Augustus — Hostinger Cloud Startup Deployment Guide

## Domain
`augustus.silverconne.com`

## Architecture
Single Node.js process serves everything:
- `https://augustus.silverconne.com/` → Business Dashboard (React SPA)
- `https://augustus.silverconne.com/admin-app/` → Admin Dashboard (React SPA)
- `https://augustus.silverconne.com/auth/*` → API routes
- `https://augustus.silverconne.com/dashboard/*` → API routes
- `https://augustus.silverconne.com/admin/*` → API routes
- `https://augustus.silverconne.com/webhooks/*` → WhatsApp webhook routes

---

## Step 1: Build locally before uploading

```bash
cd augustus
npm install
npm run build
```

This produces:
- `packages/api/dist/` — compiled API
- `packages/business-dashboard/dist/` — business dashboard static files
- `packages/admin-dashboard/dist/` — admin dashboard static files

---

## Step 2: Files to upload to Hostinger

Upload the entire `augustus/` folder contents. The entry point Hostinger needs is:

**Entry point:** `packages/api/dist/index.js`
**Start command:** `node packages/api/dist/index.js`
**Node version:** 20.x

---

## Step 3: Environment Variables on Hostinger

Set these in Hostinger's Node.js app environment variables panel:

```
NODE_ENV=production
PORT=3000

# Database (use Hostinger's managed PostgreSQL or external)
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=augustus
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SSL=true
DB_POOL_MAX=10

# Redis (use Hostinger's managed Redis or external like Upstash)
REDIS_URL=redis://your-redis-url

# S3 Storage (use Cloudflare R2, AWS S3, or Backblaze B2)
S3_ENDPOINT=https://your-s3-endpoint
S3_REGION=auto
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=augustus

# Anthropic Claude
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-haiku-20240307

# Meta / WhatsApp
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_WEBHOOK_VERIFY_TOKEN=your-verify-token
META_GRAPH_API_VERSION=v19.0
META_EMBEDDED_SIGNUP_CONFIG_ID=your-config-id

# Paynow
PAYNOW_INTEGRATION_ID=your-integration-id
PAYNOW_INTEGRATION_KEY=your-integration-key
PAYNOW_RETURN_URL=https://augustus.silverconne.com/payment/return
PAYNOW_RESULT_URL=https://augustus.silverconne.com/payments/paynow/webhook

# Email (SendGrid)
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=SG.your-sendgrid-key
EMAIL_FROM_ADDRESS=noreply@silverconne.com
EMAIL_FROM_NAME=Augustus

# JWT — generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-64-char-hex-secret
JWT_EXPIRES_IN=24h

# Encryption — generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-char-hex-key

# URLs
BASE_URL=https://augustus.silverconne.com
FRONTEND_URL=https://augustus.silverconne.com
CORS_ORIGINS=https://augustus.silverconne.com

# Withdrawals
WITHDRAWAL_AUTO_PROCESS_THRESHOLD=50
```

---

## Step 4: Database Setup

Run migrations on first deploy. The API runs them automatically on startup via `runMigrations()`.

If using Hostinger's managed PostgreSQL:
1. Create a database named `augustus`
2. Set the DB_* env vars above
3. The app will create all tables on first start

---

## Step 5: Hostinger Node.js App Configuration

In Hostinger hPanel → Node.js:
1. **Node.js version:** 20.x
2. **Application root:** `/` (root of uploaded files)
3. **Application startup file:** `packages/api/dist/index.js`
4. **Application mode:** Production

---

## Step 6: DNS

Point `augustus.silverconne.com` to your Hostinger server IP via an A record in your DNS panel.

---

## Step 7: WhatsApp Webhook

After deployment, in Meta Developer Console:
- Webhook URL: `https://augustus.silverconne.com/webhooks/whatsapp`
- Verify Token: value of `META_WEBHOOK_VERIFY_TOKEN`

---

## URLs after deployment

| Service | URL |
|---------|-----|
| Business Dashboard | https://augustus.silverconne.com/ |
| Admin Dashboard | https://augustus.silverconne.com/admin-app/ |
| API Health | https://augustus.silverconne.com/health |
| Admin Login | https://augustus.silverconne.com/admin-app/admin/login |

---

## Admin Credentials

Email: `admin@augustus.ai`
Password: `Admin@1234`
TOTP: any 6-digit code (e.g. `123456`) — TOTP is currently a stub

**Change the admin password immediately after first login.**
