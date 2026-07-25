export const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || "";

if (!CLERK_WEBHOOK_SECRET) {
  console.warn(
    "⚠️ [Clerk] CLERK_WEBHOOK_SECRET environment variable is missing! Webhook signature verification will fail."
  );
}