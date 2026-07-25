# CastBot Frontend (`apps/frontend`)

Next.js App Router dashboard for CastBot. Provides workspace management, social account connection, video publishing, scheduled/queued job monitoring, and billing.

---

## Next.js App Router Structure

```
src/app/
├── layout.tsx                 # Root layout: ClerkProvider -> ThemeProvider
├── page.tsx                   # Public marketing/landing page
├── globals.css                # Tailwind v4 theme tokens
├── (auth)/                    # Route group — Clerk-hosted auth pages
│   ├── layout.tsx
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── setup/                     # First-run workspace creation wizard
│   └── page.tsx
└── dashboard/                 # Authenticated app shell (protected by middleware.ts)
    ├── layout.tsx              # WorkspaceProvider -> DashboardShell (-> DataProvider)
    ├── page.tsx                 # Overview / metrics
    ├── publish/page.tsx         # VideoPublisherForm
    ├── queue/page.tsx           # QueueDataTable + JobExecutionInspectorModal
    ├── accounts/page.tsx        # SocialAccountsGrid
    └── settings/page.tsx        # WorkspaceSettingsForm
```

Route protection is enforced centrally in `src/middleware.ts` using Clerk's `clerkMiddleware` + `createRouteMatcher(["/dashboard(.*)", "/setup(.*)"])` — any request under those paths is required to have an authenticated Clerk session (`auth.protect()`) before the route handler/page ever runs.

---

## UI / UX Component Hierarchy

```
DashboardShell
├── AppSidebar / Navbar / WorkspaceSwitcher
└── DataProvider
    ├── dashboard/page.tsx        -> OverviewMetrics
    ├── dashboard/accounts/page.tsx -> SocialAccountsGrid
    │        ├── TikTokCookieModal        (paste-cookie flow, since TikTok has no OAuth here)
    │        └── TelegramConnectionModal  (register bot token + target channel id)
    ├── dashboard/publish/page.tsx -> VideoPublisherForm
    │        └── SubscriptionModal (shown when plan/credit limits block publishing)
    └── dashboard/queue/page.tsx  -> QueueDataTable
             └── JobExecutionInspectorModal (per-job, per-platform task drill-down)
```

Key components and their responsibilities:

| Component | Responsibility |
|---|---|
| `SocialAccountsGrid` | Renders connection status per provider (YouTube/Facebook/Instagram/TikTok/Telegram); triggers OAuth redirects for YouTube/Meta, opens modals for TikTok cookies and Telegram bot registration. |
| `VideoPublisherForm` | `react-hook-form` + `zod`-validated upload form: file picker, per-platform caption overrides, platform multi-select, immediate vs. scheduled publish mode, and submission via `fetchFromApi("/publish", ...)` as `multipart/form-data`. |
| `QueueDataTable` | Lists `PublishJob` rows (scheduled + in-flight + historical) for the active workspace, sourced from `useDataContext().queueJobs`. |
| `JobExecutionInspectorModal` | Drill-down view of a single job's child `PublishTask` rows — per-platform status, external ID, and error log, matching the backend's `PublishJob` → `PublishTask` ledger model 1:1. |
| `WorkspaceSwitcher` / `CreateWorkspaceModal` | Multi-tenant workspace selection and creation, backed by `WorkspaceContext`. |
| `OverviewMetrics` | Aggregate dashboard metrics pulled from `/api/metrics`. |
| `BillingPortalButton` / `SubscriptionModal` | Stripe Checkout / Billing Portal entry points. |

---

## State & Context Management

CastBot uses two nested React Context providers instead of a general-purpose state library:

- **`WorkspaceContext`** (`src/context/WorkspaceContext.tsx`) — owns the list of workspaces the signed-in user belongs to, the currently active workspace (persisted to `localStorage` under `castbot_active_workspace_id`), and the create/edit workspace modal state. It also handles first-run redirection: if a signed-in user has zero workspaces they're redirected to `/setup`; otherwise `/setup` redirects into `/dashboard`.
- **`DataContext`** (`src/context/DataContext.tsx`) — a thin server-state cache for `accounts`, `queueJobs`, and `metrics`, each with its own `refetchX()` function and an `invalidateAll()` convenience that refetches all three in parallel. It refetches automatically whenever `activeWorkspace` changes, and otherwise relies on components calling `refetchX()` after a mutation (e.g. after a successful publish) rather than polling on an interval.

Provider nesting (outer → inner): `ClerkProvider` (root layout) → `WorkspaceProvider` (dashboard layout) → `DataProvider` (inside `DashboardShell`).

---

## Authentication Flow (Clerk)

1. `ClerkProvider` wraps the entire app in `src/app/layout.tsx`.
2. `src/middleware.ts` protects `/dashboard/*` and `/setup/*` at the edge via `clerkMiddleware` + `auth.protect()`.
3. Client components obtain a short-lived session JWT with Clerk's `useAuth().getToken()` hook and attach it as `Authorization: Bearer <token>` on every backend API call (see `fetchFromApi` in `src/lib/api-client.ts`).
4. The backend independently re-verifies that token per-request with `@clerk/backend`'s `verifyToken()` — the frontend never trusts its own possession of a token as proof of validity; the backend is the source of truth.
5. Clerk webhooks (user created/updated) are handled backend-side at `/api/clerk/webhook`, keeping the Postgres `User` table in sync with Clerk's user directory (`User.clerkId` is the join key).

---

## Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — API client internals, OAuth redirect construction, and reactivity model
- [`../../README.md`](../../README.md) — root project overview
