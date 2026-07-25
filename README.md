# CastBot

## 🚀 Live Deployment Links

- **Frontend App (Netlify):** [https://castbot.netlify.app](https://castbot.netlify.app)
- **Backend API (Azure App Service):** `https://castbot-backend-api-e2h0cufnfughazfk.southeastasia-01.azurewebsites.net`

**Automated Multi-Platform Social Media Video Publisher & Dispatch System**

CastBot is a multi-tenant SaaS application that lets a workspace ("Tenant") connect one or more social accounts — YouTube, Facebook, Instagram, and TikTok — plus an inbound Telegram bot, and then publish a single video to all of them from one upload. It supports two publishing directions:

- **Manual publish** — a user uploads a video in the web dashboard, picks platforms and (optionally) a schedule time, and CastBot fans the job out to background workers.
- **Auto-pilot publish (reverse flow)** — a user posts a video into a Telegram channel that has a registered CastBot bot; CastBot downloads it automatically and republishes it to that tenant's connected platforms without any dashboard interaction.

Every job, and every per-platform attempt within it, is persisted to a durable status ledger in PostgreSQL so publish history and failures are fully auditable.

---

## Features

- **YouTube Shorts** — OAuth2-based upload via the YouTube Data API v3 (resumable upload).
- **Meta Reels (Facebook & Instagram)** — Graph API–based Reels publishing using long-lived Page/Instagram Business Account tokens.
- **TikTok "stealth" automation** — TikTok has no public video-upload API for this use case, so CastBot drives the TikTok web creator studio with a stealth-patched, cookie-authenticated Puppeteer browser session instead of a REST call.
- **Telegram bot dispatch (bi-directional)**
  - *Outbound:* CastBot can post the finished video into a tenant's Telegram channel as one of the selected "platforms."
  - *Inbound (auto-pilot):* a registered bot's webhook lets a tenant simply drop a video into Telegram and have it silently fan out to their other connected platforms.
- **Multi-tenant workspaces** — every resource (social accounts, Telegram connections, jobs, credits) is strictly scoped to a `Tenant`, with role-based membership (`OWNER` / `ADMIN` / `MEMBER`).
- **Credit-gated publishing & Stripe billing** — each tenant has an `uploadCredits` balance decremented per publish; Stripe Checkout/Billing Portal manage subscription upgrades.
- **Encrypted credential storage** — all OAuth tokens, TikTok session cookies, and Telegram bot tokens are encrypted at rest with AES‑256‑GCM before being written to Postgres.
- **Resilient background processing** — BullMQ splits work across a high-concurrency "light" queue (YouTube/Facebook/Instagram/Telegram) and a low-concurrency, isolated TikTok queue so a handful of slow Puppeteer sessions can never starve the fast API-based publishers.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React 19, Tailwind CSS v4, TypeScript |
| Backend API | Node.js, Express 4, TypeScript |
| Auth | Clerk (session verification on the backend via `@clerk/backend`, Clerk middleware on the frontend) |
| Database ORM | Prisma (via a shared `@repo/database` workspace package), PostgreSQL, `pg` connection pool with a custom Prisma driver adapter |
| Background jobs | BullMQ (backed by Redis / Upstash) |
| Queue transport | Redis (`ioredis`), TLS-aware connection handling |
| Browser automation | Puppeteer + `puppeteer-extra` + `puppeteer-extra-plugin-stealth` (TikTok upload path); Playwright is also a dependency |
| Media storage | Cloudinary (used as an intermediate CDN host for Instagram, which requires a publicly reachable video URL) |
| Billing | Stripe (Checkout Sessions, Billing Portal, webhooks) |
| Monorepo tooling | npm workspaces (`apps/*`, `packages/*`) |
| Hosting | Azure App Service (backend), containerized Next.js standalone build (frontend) |

---

## Monorepo Layout

```
castbot/
├── apps/
│   ├── frontend/      # Next.js App Router dashboard (see apps/frontend/README.md)
│   └── backend/       # Express API + BullMQ workers (see apps/backend/README.md)
├── packages/
│   └── database/      # Shared Prisma schema + generated client (@repo/database)
├── Dockerfile          # Frontend production image (Next.js standalone output)
└── .github/workflows/  # CI/CD — backend deploy to Azure App Service
```

Both apps depend on the shared `@repo/database` workspace package, which owns the single Prisma schema (`packages/database/prisma/schema.prisma`) and the generated Prisma Client used by both the frontend (for direct reads in a couple of places) and — primarily — the backend.

---

## Quickstart

### Prerequisites

- Node.js 20+ (CI uses Node 22)
- A PostgreSQL database (Prisma driver adapter over `pg`)
- A Redis instance (Upstash or self-hosted) for BullMQ
- API credentials for whichever platforms you want to test: Google Cloud (YouTube), Meta App (Facebook/Instagram), a Telegram bot token, Clerk, Stripe, Cloudinary

### 1. Install dependencies

```bash
npm install
```

The root `postinstall` script (`npm run db:generate`) automatically generates the Prisma Client into `packages/database/generated/client` after install.

### 2. Configure environment variables

Populate `.env` files in `apps/backend/`, `apps/frontend/`, and `packages/database/` — see the [Environment Variables Reference](#environment-variables-reference) below.

### 3. Run database migrations

```bash
npm run db:migrate:dev
```

### 4. Start the dev servers

```bash
# Frontend only (Next.js dev server, http://localhost:3000)
npm run dev

# Backend only (Express + BullMQ workers via tsx watch, http://localhost:5000)
npm run dev:backend

# Both concurrently
npm run dev:all
```

The backend's BullMQ workers (`src/workers/publish.worker.ts`) are started in-process as a side effect of importing them from `src/index.ts` — there is no separate worker process to launch in development.

### 5. Inspect the database (optional)

```bash
npm run db:studio
```

---

## Environment Variables Reference

### `apps/backend/.env`

| Variable | Purpose |
|---|---|
| `FRONTEND_URL` | Allowed CORS origin and base URL for post-OAuth dashboard redirects |
| `BACKEND_URL` | Base URL used to construct OAuth `redirect_uri` values |
| `DATABASE_URL` / `DIRECT_URL` | PostgreSQL connection strings (pooled / direct) |
| `PORT` | Express listen port (defaults to `5000`) |
| `REDIS_URL` | BullMQ/Redis connection string (`rediss://` enables TLS) |
| `ENCRYPTION_KEY` | Secret used to derive the AES‑256‑GCM key for encrypting tokens/cookies at rest |
| `CLERK_SECRET_KEY` | Verifies Clerk session tokens on the backend and signs OAuth `state` payloads |
| `CLERK_WEBHOOK_SECRET` | Verifies inbound Clerk webhook signatures (via Svix) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Intermediate video hosting, required for Instagram Reels publishing |
| `TELEGRAM_BOT_TOKEN` | Fallback bot token used only when no per-tenant `TelegramConnection` is registered |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | YouTube OAuth2 app credentials |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` / `FACEBOOK_REDIRECT_URI` | Meta OAuth app credentials |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe billing integration |
| `STRIPE_PRICE_*` | Stripe Price IDs for Pro/Agency monthly & yearly plans |
| `TIKTOK_HEADLESS` | Toggles headless mode for the Puppeteer-driven TikTok publisher |
| `PUPPETEER_EXECUTABLE_PATH` | Explicit Chrome/Chromium binary path (required in most container/Azure environments) |

### `apps/frontend/.env`

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL the browser uses to reach the Express backend (`apps/frontend/src/lib/api-client.ts`) |
| `NEXTAUTH_SECRET` | Present for a legacy/partial NextAuth integration alongside Clerk |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk frontend/session integration |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk hosted auth page routes |
| `NEXT_PUBLIC_STRIPE_PRICE_*` | Client-visible Stripe Price IDs shown on the pricing/upgrade UI |

### `packages/database/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Used exclusively by the Prisma CLI for migrations and client generation |

> All secrets above are illustrative variable names only; no values are reproduced in this documentation.

---

## Further Reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, publishing pipeline, and database ERD
- [`apps/frontend/README.md`](../apps/frontend/README.md) / [`apps/frontend/ARCHITECTURE.md`](../apps/frontend/ARCHITECTURE.md)
- [`apps/backend/README.md`](../apps/backend/README.md) / [`apps/backend/ARCHITECTURE.md`](../apps/backend/ARCHITECTURE.md)
