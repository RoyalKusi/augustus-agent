# Augustus AI Sales Platform

A multi-tenant SaaS platform that deploys a goal-driven AI Sales Agent on each Business's existing WhatsApp Business number. Businesses configure their catalogue and training data; their customers interact with the AI agent directly in WhatsApp to browse products and complete purchases via Paynow.

## Packages

| Package | Description |
|---------|-------------|
| `packages/api` | Node.js/TypeScript backend API (Fastify) |
| `packages/business-dashboard` | React/TypeScript Business Dashboard UI (Vite) |
| `packages/admin-dashboard` | React/TypeScript Admin Dashboard UI (Vite) |

## Prerequisites

- Node.js >= 20
- npm >= 10

## Getting Started

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run type checking across all packages
npm run typecheck
```

## Architecture

- **Backend API** — Fastify REST API with PostgreSQL (multi-tenant via `business_id`), Redis (sessions, conversation context, distributed locks), and S3-compatible object storage.
- **Business Dashboard** — Self-service UI for businesses to manage catalogue, training data, subscriptions, and monitor conversations.
- **Admin Dashboard** — Internal operator UI for platform-wide management, usage metrics, and withdrawal approvals.

## Subscription Tiers

| Tier | Price | Monthly AI Cost Cap |
|------|-------|---------------------|
| Silver | $31.99/month | $12 |
| Gold | $61.99/month | $30 |
| Platinum | $129.99/month | $70 |
