# CastBot Backend (`apps/backend`)

Express API server and BullMQ background worker host for CastBot. A single Node.js process serves HTTP traffic **and** runs both BullMQ workers (imported for their side effects at boot).

---

## Express & BullMQ Worker Architecture

`src/index.ts` is the sole entry point:

1. Loads environment variables (`dotenv/config`).
2. Configures `trust proxy` (required for correct client IPs behind Azure App Service's reverse proxy).
3. Registers middleware in this order: request logger → CORS → raw-body parsers scoped specifically to `/api/stripe/webhook` and `/api/clerk/webhook` (signature verification needs the untouched raw body) → global `express.json()` → API rate limiter (`/api/*`, 100 req/15min per IP).
4. Exposes `GET /api/health`, which round-trips a `SELECT 1` through Prisma to report live DB connectivity alongside service metadata.
5. Mounts each domain's router (see below).
6. Registers `errorHandlerMiddleware` last, as required by Express for it to function as an error-handling middleware.
7. `import "./workers/publish.worker"` at the top of the file starts both BullMQ `Worker` instances as a side effect — **there is no separate `worker` process/command**; running the API server always runs the workers too.

---

## API Endpoints

All routes are mounted under `/api`. Unless noted, `authMiddleware` (Clerk JWT verification) and `validateTenantMiddleware` (resolves + authorizes `x-tenant-id`) gate the route.

### `/api/auth/*` — OAuth connection flows (public redirect endpoints)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/youtube` | `authMiddleware` only. Redirects to Google's OAuth consent screen with a signed `state`. |
| GET | `/api/auth/callback/youtube` | Public (Google calls this). Exchanges code, upserts `SocialAccount(YOUTUBE)`. |
| GET | `/api/auth/facebook` | `authMiddleware` only. Redirects to Meta's OAuth consent screen. |
| GET | `/api/auth/callback/facebook` | Public (Meta calls this). Exchanges + long-lives token, upserts `SocialAccount(FACEBOOK)` and `SocialAccount(INSTAGRAM)`. |

### `/api/accounts` — Connected social account management
| Method | Path | Middleware |
|---|---|---|
| GET | `/api/accounts` | `validateTenantMiddleware` |
| POST | `/api/accounts` | `validateTenantMiddleware` (used for non-OAuth connections, e.g. TikTok cookies / Telegram) |

### `/api/publish` — Manual video publish
| Method | Path | Middleware |
|---|---|---|
| POST | `/api/publish` | `authMiddleware` → multer (multipart `file`/`video`, 500MB limit) → `validateTenantMiddleware` → `checkUploadCreditMiddleware` |

### `/api/scheduled` — Job/queue inspection
| Method | Path | Notes |
|---|---|---|
| GET | `/api/scheduled` | List all `PublishJob`s for the tenant |
| GET | `/api/scheduled/:jobId` | Job detail incl. child `PublishTask`s |
| PATCH | `/api/scheduled/:jobId` | Reschedule / update a pending job |
| DELETE | `/api/scheduled/:jobId` | Cancel a scheduled job |

### `/api/telegram/*` — Inbound/outbound Telegram integration
| Method | Path | Notes |
|---|---|---|
| POST | `/api/telegram/register-bot` | `authMiddleware` + `validateTenantMiddleware`. Validates bot token, encrypts + stores `TelegramConnection`, auto-configures the webhook. |
| POST | `/api/telegram/webhook` | **Intentionally public.** Telegram's own servers call this; identity is derived from the inbound `chat.id` / `?tenantId=`, not from auth headers. |
| GET | `/api/telegram/webhook` | Simple liveness check for the webhook URL. |

### `/api/workspaces` — Tenant/workspace CRUD
| Method | Path | Notes |
|---|---|---|
| GET | `/api/workspaces` | `authMiddleware` only — lists all workspaces the user belongs to |
| POST | `/api/workspaces` | `authMiddleware` only — create a new workspace |
| PATCH | `/api/workspaces/:id` | `authMiddleware` + `validateTenantMiddleware` |

### `/api/stripe/*` — Billing
| Method | Path | Notes |
|---|---|---|
| POST | `/api/stripe/webhook` | Public, raw-body, Stripe-signature-verified |
| GET | `/api/stripe/subscription` | Auth + tenant scoped |
| POST | `/api/stripe/checkout` | Creates a Stripe Checkout session |
| POST | `/api/stripe/downgrade` | Downgrades the tenant's plan |
| POST | `/api/stripe/portal` | Creates a Stripe Billing Portal session |

### `/api/metrics` — Dashboard overview metrics
| Method | Path | Notes |
|---|---|---|
| GET | `/api/metrics` | Auth + tenant scoped |

### `/api/clerk/*` — Identity provider sync
| Method | Path | Notes |
|---|---|---|
| POST | `/api/clerk/webhook` | Public, raw-body, Svix-signature-verified. Keeps the local `User` table in sync with Clerk. |

---

## Local Development Setup

```bash
# From the monorepo root
npm install                     # installs all workspaces, triggers db:generate via postinstall
npm run db:migrate:dev          # applies Prisma migrations against DATABASE_URL
npm run dev:backend             # tsx watch src/index.ts — API + BullMQ workers, port 5000
```

### Prisma migration commands (run from root, targeting `packages/database`)

| Command | Purpose |
|---|---|
| `npm run db:generate` | Regenerate the Prisma Client into `packages/database/generated/client` |
| `npm run db:migrate:dev` | Create/apply a dev migration interactively |
| `npm run db:migrate:deploy` | Apply pending migrations non-interactively (used in production) |
| `npm run db:studio` | Launch Prisma Studio against the configured `DATABASE_URL` |

### Running workers in isolation

There is no standalone worker entry point — `publishWorker` and `tiktokPublishWorker` are created as module-level singletons in `src/workers/publish.worker.ts` and start consuming their queues the moment that module is imported. In development this happens automatically via `src/index.ts`; there's nothing extra to run.

---

## Azure App Service Production Deployment

Deployment is fully automated by `.github/workflows/main.yml` on every push to `main`:

1. Install root workspace dependencies (`npm ci`) and generate the Prisma Client.
2. Build `@repo/database` to plain JS, then normalize its `tsc` output layout (handles a `dist/src/*` vs `dist/*` discrepancy caused by the package's `tsconfig.json` not declaring `rootDir`).
3. Build `apps/backend` to plain JS (`dist/index.js`).
4. `npm prune --omit=dev` to strip build-only tooling (`tsc`, `tsx`, Prisma CLI, `@types/*`) from the shipped `node_modules`.
5. Assemble a self-contained `release/` folder: backend `dist/`, backend `package.json`, the pruned production `node_modules`, and — critically — a **de-symlinked, fully copied** `@repo/database` (dist + generated Prisma client + package.json) in place of the npm-workspaces symlink, since Azure's zip-deploy target can't resolve workspace symlinks.
6. Sanity-checks that `dist/index.js`, `@repo/database/dist/index.js`, the generated Prisma client, and `@prisma/client` are all present before zipping.
7. Deploys `release.zip` directly via `azure/webapps-deploy@v2` — no `npm install` runs on Azure's side, avoiding an "isolated folder" resolution failure some Azure App Service configurations hit with workspace-linked packages.

### Docker / Puppeteer configuration notes

- The repo's root `Dockerfile` builds a **standalone Next.js (frontend) image**; it is not the backend's deployment artifact (the backend ships via the Azure zip-deploy pipeline above).
- That Dockerfile's runner stage does install `google-chrome-stable` plus a set of font packages (`fonts-ipafont-gothic`, `fonts-wqy-zenhei`, `fonts-thai-tlwg`, `fonts-kacst`, `fonts-freefont-ttf`) and `libxss1` — the same dependencies a containerized *backend* would need for the Puppeteer-driven TikTok publisher to render non-Latin captions/UI correctly and to satisfy Chrome's runtime library requirements.
- If/when the backend is containerized, `PUPPETEER_EXECUTABLE_PATH` must point at the installed `google-chrome-stable` binary, and `TIKTOK_HEADLESS` should be `true` in any non-interactive/server environment — `src/publishers/tiktok.publisher.ts`'s `getBrowserExecutablePath()` will otherwise search for a local Edge/Chromium install (a Windows-dev-machine convenience path) and warn if none is found, falling back to Puppeteer's own bundled default.
- `puppeteer-extra` + `puppeteer-extra-plugin-stealth` are applied globally to the TikTok publisher's Puppeteer instance to reduce the chance of bot-detection challenges on TikTok's web creator studio.

---

## Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — service layer, queue design, encryption, and resilience internals
- [`../../README.md`](../../README.md) — root project overview
