# 06 Production Deployment Pipeline & Master Audit Summary Ledger

This document audits the production hosting deployment pipeline across **Netlify** (Frontend App Router) and **Azure App Service** (Backend Express Engine & BullMQ Workers), live webhook infrastructure, and provides a Master Audit Summary Matrix for the entire **CastBot** platform.

---

## 1. Production Deployment & Hosting Architecture

### A. Netlify Edge Frontend (`apps/frontend`):
- **Build Command:** `npm run build:frontend`
- **Publish Directory:** `apps/frontend/.next`
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL`: Production Express API endpoint (`https://castbot-backend.azurewebsites.net/api`).
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Production Clerk authentication key (`pk_live_...`).
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`.
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/sign-up`.

### B. Azure App Service Backend (`apps/backend`):
- **Runtime Stack:** Node.js 20 LTS.
- **Startup Command:** `node dist/index.js`
- **Environment Variables:**
  - `DATABASE_URL`: Hosted PostgreSQL connection string with SSL.
  - `REDIS_URL`: Azure Redis Cache / Managed Redis connection URL.
  - `CLERK_SECRET_KEY`: Backend Clerk verification key (`sk_live_...`).
  - `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`: Production Stripe keys.
  - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Google Cloud Console credentials.
  - `FACEBOOK_CLIENT_ID` & `FACEBOOK_CLIENT_SECRET`: Meta Developer App credentials.
  - `TIKTOK_HEADLESS`: `'T'` (true) for production headless Puppeteer execution.

---

## 2. Paired Interaction Log: Deployment & Webhook Setup

### 📥 User Prompt
> "Configure the Netlify deployment settings and environment variables for the Next.js frontend (`apps/frontend`), specifying build scripts and Clerk authentication public keys."

### 📤 AG Response / Output
- **Execution Summary:** Configured Netlify build configuration linking `NEXT_PUBLIC_API_URL` to Azure backend and setting up Next.js App Router static/dynamic rendering outputs.
- **Files / Hosting Configurations:**
  - `netlify.toml` / Netlify App Dashboard Environment Variables

- **Code Snippet / Configuration:**

```toml
# netlify.toml
[build]
  command = "npm run build:frontend"
  publish = "apps/frontend/.next"

[build.environment]
  NODE_VERSION = "20"
  NEXT_PUBLIC_API_URL = "https://castbot-backend.azurewebsites.net/api"
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_..."
```

---

### 📥 User Prompt
> "Configure Azure App Service deployment settings for the Express backend, BullMQ workers, and Puppeteer stealth dependencies."

### 📤 AG Response / Output
- **Execution Summary:** Set up Azure App Service configuration for Node 20 LTS runtime, environment variables for PostgreSQL Prisma pool connection, Redis Queue instance, and Puppeteer Chrome launch flags (`--no-sandbox`).
- **Files / Hosting Configurations:**
  - Azure App Service Configuration Portal & Startup Commands

- **Code Snippet / Configuration:**

```bash
# Azure App Service Startup Command
npm run build:backend && node apps/backend/dist/index.js
```

---

### 📥 User Prompt
> "Configure live production webhooks for Stripe subscription events (`invoice.payment_succeeded`, `checkout.session.completed`) and Telegram bot webhook registration."

### 📤 AG Response / Output
- **Execution Summary:** Configured Stripe webhook route receiving raw body streams for signature verification, and automated Telegram bot webhook registration calling `setWebhook` on bot token initialization.
- **Files / Hosting Configurations:**
  - [`apps/backend/src/routes/stripe.routes.ts`](file:///E:/telegram_social_uploader/apps/backend/src/routes/stripe.routes.ts)
  - [`apps/backend/src/services/telegram.service.ts`](file:///E:/telegram_social_uploader/apps/backend/src/services/telegram.service.ts)

- **Code Snippet / Configuration:**

```typescript
// Production Webhook Endpoints
// 1. Stripe Webhook Endpoint: POST /api/stripe/webhook
// 2. Telegram Bot Inbound Webhook: POST /api/telegram/webhook?tenantId=<tenant_id>
```

---

## 3. Master Audit Summary Matrix

| Component | Target Directory / File | Key Responsibility | Platform / Driver | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend UI** | `apps/frontend/src/app` | SaaS Landing Page, Light Auth Pages, Responsive Workspace Dashboard | Next.js 16, React 19, Tailwind v4 | Verified |
| **Backend REST API** | `apps/backend/src/index.ts` | Multi-Tenant Workspace Resolution, Upload Controller, Express App | Express.js, TypeScript (`tsx`) | Verified |
| **Database ORM** | `packages/database/prisma` | PostgreSQL Schema, Migrations, Multi-Tenant Data Isolation | Prisma ORM, `@prisma/adapter-pg` | Verified |
| **Authentication** | `apps/backend/src/middlewares/auth.middleware.ts` | JWT Token Verification, Clerk User Session Attachment | Clerk Authentication (`@clerk/backend`) | Verified |
| **Billing Engine** | `apps/backend/src/controllers/stripe.controller.ts` | Stripe Checkout Sessions, Customer Portal, Webhook Handlers | Stripe SDK, Stripe Webhooks | Verified |
| **YouTube Publisher** | `apps/backend/src/publishers/youtube.publisher.ts` | OAuth2 Refresh Token Exchange, YouTube Shorts Uploads | Google Data API v3 (`googleapis`) | Verified |
| **Meta Publisher** | `apps/backend/src/publishers/facebook.publisher.ts` | 3-Phase Facebook Reels & Instagram Container Publishing | Meta Graph API v19.0 | Verified |
| **TikTok Engine** | `apps/backend/src/publishers/tiktok.publisher.ts` | Cookie Injection, Stealth DOM Upload, DraftEditor Captioning | Puppeteer Stealth (`puppeteer-extra`) | Verified |
| **Telegram Engine** | `apps/backend/src/services/telegram.service.ts` | Inbound Channel Video Ingestion, CDN Streaming, Auto-Pilot Dispatch | Telegram Bot API, Express Webhook | Verified |
| **Worker Queue** | `apps/backend/src/queues/publish.queue.ts` | Background Job Orchestration, Concurrency & Isolated TikTok Queue | BullMQ, Redis Cache | Verified |

---

## 4. Strict Containment & Verification

- Output path: `E:\telegram_social_uploader\docs\Antigravity_Audit\06_Deployment_Pipeline_&_Master_Summary.md`.
- No files outside `docs/Antigravity_Audit` were created or modified.
