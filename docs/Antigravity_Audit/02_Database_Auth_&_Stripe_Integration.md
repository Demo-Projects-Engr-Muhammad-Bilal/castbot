# 02 Database Schema, Clerk Auth & Stripe Billing Ledger

This document audits the backend data layer, multi-tenant database schema, Clerk JWT authentication middleware, and Stripe SaaS subscription billing infrastructure for **CastBot**.

---

## 1. Multi-Tenant Database Schema Architecture

The database schema is defined in `@repo/database` using **Prisma ORM** targeting PostgreSQL with `@prisma/adapter-pg`.

### Key Prisma Models & Relations:
- **`Tenant`**: Represents a customer workspace (`id`, `name`, `slug`, `uploadCredits`, `maxWorkspaces`, `enabledPlatforms`).
- **`User`**: Tracks Clerk-authenticated users (`clerkId`, `email`, `role`).
- **`TenantMember`**: Join table mapping Users to Tenants with roles (`OWNER`, `ADMIN`, `MEMBER`).
- **`SocialAccount`**: Encrypted OAuth credentials for platforms (`YOUTUBE`, `FACEBOOK`, `INSTAGRAM`, `TIKTOK`).
- **`TelegramConnection`**: Stores encrypted bot token and `targetChannelId`.
- **`PublishJob`**: Parent job entity tracking video release requests (`videoUrl`, `caption`, `status`).
- **`PublishTask`**: Child task tracking platform-specific upload status (`platform`, `status`, `externalId`, `errorLog`).
- **`Subscription`**: Stores Stripe customer and subscription linkage (`stripeCustomerId`, `stripeSubscriptionId`, `status`).

---

## 2. Paired Interaction Log: Database, Auth & Billing

### 📥 User Prompt
> "Design a multi-tenant Prisma database schema for CastBot. Include models for `Tenant`, `User`, `TenantMember`, `SocialAccount`, `TelegramConnection`, `PublishJob`, `PublishTask`, and `Subscription`."

### 📤 AG Response / Output
- **Execution Summary:** Designed PostgreSQL Prisma schema enforcing workspace multi-tenancy, compound unique indexes (`[tenantId, provider, providerAccountId]`), and cascading deletions on child relations.
- **Files Created/Modified:**
  - [`packages/database/prisma/schema.prisma`](file:///E:/telegram_social_uploader/packages/database/prisma/schema.prisma)

- **Code Snippet / Configuration:**

```prisma
// packages/database/prisma/schema.prisma
enum Provider {
  YOUTUBE
  FACEBOOK
  INSTAGRAM
  TIKTOK
  TELEGRAM
}

enum PublishStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model Tenant {
  id                  String               @id @default(uuid())
  name                String
  slug                String               @unique
  niche               String?
  enabledPlatforms    String[]             @default(["YOUTUBE", "INSTAGRAM", "FACEBOOK", "TIKTOK"])
  uploadCredits       Int                  @default(10)
  maxWorkspaces       Int                  @default(1)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  members             TenantMember[]
  socialAccounts      SocialAccount[]
  telegramConnections TelegramConnection[]
  publishJobs         PublishJob[]
  subscription        Subscription?

  @@map("tenants")
}

model SocialAccount {
  id                String        @id @default(uuid())
  userId            String?
  user              User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenantId          String
  tenant            Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  provider          Provider
  providerAccountId String
  accessToken       String // Stores encrypted OAuth access token
  refreshToken      String? // Stores encrypted OAuth refresh token
  expiresAt         DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  publishTasks      PublishTask[]

  @@unique([tenantId, provider, providerAccountId])
  @@index([tenantId])
  @@map("social_accounts")
}
```

---

### 📥 User Prompt
> "Implement Express authentication middleware (`auth.middleware.ts`) using `@clerk/backend` to verify inbound Bearer JWT tokens and attach `req.userId` to incoming requests."

### 📤 AG Response / Output
- **Execution Summary:** Created `authMiddleware` using `@clerk/backend`'s `verifyToken` method, extracting bearer tokens from `Authorization: Bearer <token>` or `?token=` query parameters.
- **Files Created/Modified:**
  - [`apps/backend/src/middlewares/auth.middleware.ts`](file:///E:/telegram_social_uploader/apps/backend/src/middlewares/auth.middleware.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  auth?: { userId: string; sessionId?: string };
}

const secretKey = process.env.CLERK_SECRET_KEY || "";

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ success: false, error: "Unauthorized access: Missing authorization token" });
      return;
    }

    const verified = await verifyToken(token, { secretKey });
    if (!verified || !verified.sub) {
      res.status(401).json({ success: false, error: "Unauthorized access: Invalid token payload" });
      return;
    }

    req.userId = verified.sub;
    req.auth = { userId: verified.sub };
    next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(401).json({ success: false, error: `Authentication failed: ${msg}` });
  }
}
```

---

### 📥 User Prompt
> "Implement Stripe SaaS billing endpoints for creating Checkout sessions, Stripe Customer Portal sessions, handling subscription downgrades, and processing `checkout.session.completed` / `invoice.payment_succeeded` webhooks."

### 📤 AG Response / Output
- **Execution Summary:** Created `stripe.controller.ts` and `stripe.service.ts` handling Stripe Checkout Session initialization with environment-configured Price IDs (`STRIPE_PRICES`), Customer Portal redirect creation, and webhook signature verification using `stripe.webhooks.constructEvent`.
- **Files Created/Modified:**
  - [`apps/backend/src/controllers/stripe.controller.ts`](file:///E:/telegram_social_uploader/apps/backend/src/controllers/stripe.controller.ts)
  - [`apps/backend/src/services/stripe.service.ts`](file:///E:/telegram_social_uploader/apps/backend/src/services/stripe.service.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/controllers/stripe.controller.ts
export const createCheckoutSessionHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const clerkUserId = requireClerkUserId(req.userId || req.auth?.userId);
  const { priceId, price_id, price, planType, plan_type, billingInterval, interval } = req.body || {};

  const targetPriceId = priceId || price_id || price;
  const targetPlanType = planType || plan_type;

  const result = await createCheckoutSession({
    tenantId: req.tenantId!,
    clerkUserId,
    priceId: targetPriceId,
    planType: targetPlanType,
    billingInterval: billingInterval || interval,
  });

  sendSuccess(res, { url: result.url, sessionId: result.sessionId });
});

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).send(`Webhook Error: ${msg}`);
    return;
  }

  await processStripeWebhookEvent(event);
  res.status(200).json({ received: true });
}
```

---

## 3. Strict Containment & Verification

- Output path: `E:\telegram_social_uploader\docs\Antigravity_Audit\02_Database_Auth_&_Stripe_Integration.md`.
- No files outside `docs/Antigravity_Audit` were edited or modified.
