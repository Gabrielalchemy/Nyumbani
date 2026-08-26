# 🏠 Nyumbani

**A digital home for African makers.** USSD storefront, M-Pesa order desk and smart inventory — built for *jua kali* producers who need to sell online without needing a website, an app, or even a smartphone.

Built for the **Africa's Talking Open Hackathon: Manufacturing** (Nairobi, Aug 2026).

---

## What it does

| Channel | Capability |
|---|---|
| **USSD** (`*384*XXXX#`) | Customers browse the catalogue, order and pay an M-Pesa deposit from any phone |
| **Web storefront** | Beautiful animated catalogue; "pay deposit" triggers a live M-Pesa STK push |
| **Owner dashboard** | SMS-OTP login · products & stock · order board with automatic customer SMS updates · restock tracking |
| **AI insights** | Upload invoices/receipts → Gemini extracts structured data → one-tap business report (revenue, expenses by supplier/category, stock health) → readable on screen or as SMS |

Every sale decrements stock atomically; crossing a product's alert threshold texts the owner automatically.

## Architecture

```
Fastify API ──── Prisma ──── PostgreSQL      React 19 + Vite SPA
   │                                             (served statically
   ├─ POST /ussd/callback      AT USSD           by Fastify in prod)
   ├─ POST /webhooks/payments  AT payments (legacy)
   ├─ POST /webhooks/mpesa     Daraja STK result
   ├─ GET  /api/products       public JSON
   └─ /api/admin/*             JWT (SMS-OTP)
```

One container serves everything → deploys as a single isolated instance per business on the [AT Marketplace](https://marketplace.africastalking.dev).

## Stack

Fastify 5 · Prisma 6 · PostgreSQL 16 · React 19 · Vite · Tailwind v4 · Framer Motion · TanStack Query · Gemini 2.5 Flash (`@ai-sdk/google`) · Safaricom Daraja (M-Pesa Express STK)

## Local development

```bash
pnpm install
cp .env.example .env            # single root .env — the API walks up to find it

# Postgres: either…
docker compose up -d db         # …or any local postgres; set DATABASE_URL accordingly

pnpm --filter @nyumbani/api migrate:dev
pnpm db:seed
pnpm dev                        # api :3000 + web :5173 (vite proxies /api)
```

### Sandbox testing with ngrok

Africa's Talking needs public HTTPS callbacks. With your AT sandbox credentials in `.env`:

```bash
ngrok http 3000                 # copy the https URL, then…
# …set PUBLIC_BASE_URL=https://<your-sub>.ngrok-free.app in .env and restart the API.
```

On boot the API logs paste-ready URLs for the AT portal:

- **USSD callback URL:** `https://<host>/ussd/callback`
- **Payments notification URL:** `https://<host>/webhooks/payments`

### Simulated integrations
With no `AT_API_KEY` / `GEMINI_API_KEY` / `DARAJA_CONSUMER_KEY`, all Africa's Talking, AI and M-Pesa calls are logged and simulated with deterministic fake references — the entire flow (USSD → order → STK push → webhook → SMS copy) is testable offline. In development the login OTP is returned in the API response so the dashboard can be tested without a phone.

### Testing USSD locally
```bash
curl -X POST localhost:3000/ussd/callback \
  -d "sessionId=s1&serviceCode=*384*38239#&phoneNumber=+254711223344&text="
# respond with text=1 (browse), 1*2 (item), 1*2*1 (order), 1*2*1*2 (qty), 1*2*1*2*1 (pay)
```

## Deployment (Railway or any Docker host)

1. Provision **PostgreSQL**, note `DATABASE_URL`
2. Deploy repo (Dockerfile auto-detected); set env vars:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Railway Postgres connection string |
| `JWT_SECRET` | random 32+ chars |
| `BUSINESS_NAME` / `BUSINESS_TAGLINE` | branding across USSD/SMS/web |
| `OWNER_PHONE` | E.164 owner number — receives alerts, OTP logins |
| `PUBLIC_BASE_URL` | Public https base URL (e.g. ngrok) — used to log AT callback URLs at boot |
| `USSD_SERVICE_CODE` | your AT shortcode |
| `AT_USERNAME` / `AT_API_KEY` / `AT_SENDER_ID` | production AT credentials |
| `AT_ENVIRONMENT` | `sandbox` or `production` |
| `DARAJA_ENV` | `sandbox` or `production` |
| `DARAJA_CONSUMER_KEY` / `DARAJA_CONSUMER_SECRET` | [Daraja](https://developer.safaricom.co.ke) app credentials (Lipa na M-Pesa Online) |
| `DARAJA_SHORTCODE` / `DARAJA_PASSKEY` | paybill/till + passkey (sandbox defaults pre-set) |
| `GEMINI_API_KEY` | enables invoice extraction + report narration |

3. Point the provider portals at (the API logs these on boot when `PUBLIC_BASE_URL` is set):
   - **AT USSD callback URL:** `https://<your-host>/ussd/callback`
   - **Daraja STK callback URL:** `https://<your-host>/webhooks/mpesa`

## Marketplace packaging checklist

- ✅ Single Docker image, healthcheck endpoint `/health`
- ✅ Configurable entirely via env vars; database declared (PostgreSQL)
- ✅ Built on AT products: **USSD, SMS** — plus **Safaricom Daraja** for M-Pesa deposits (AT Mobile Checkout was retired)
- ✅ Reusable per-business deployment (single-tenant by design)
- ⬜ Push image to AT container registry & submit via *Create Your Own Plugin*
  (name `nyumbani`, slug, descriptions, `logo.svg`, pricing plans, industry tag)

## Design notes

Warm craft-industrial identity: Fraunces display serif over Inter, paper/sand surfaces, terracotta accents, procedural wood-grain placeholders (SVG-free CSS grain). Motion follows a single easing curve family with scroll-triggered staggers; `prefers-reduced-motion` respected.

---

*Powered by [Africa's Talking](https://africastalking.com) — #BuildWithAT*
