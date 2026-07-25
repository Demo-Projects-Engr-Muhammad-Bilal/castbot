import { prisma, withPrismaRetry } from "../lib/prisma";
import { ClerkWebhookEvent } from "../types/clerk.types";

/**
 * Syncs Clerk user lifecycle events into the local `users` table.
 * `user.created` / `user.updated` are both upserts keyed on `clerkId`,
 * since Clerk can legitimately fire `user.updated` before our DB has ever
 * seen that user (e.g. missed/delayed `user.created` delivery).
 */
export async function processClerkWebhookEvent(evt: ClerkWebhookEvent): Promise<void> {
  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const data = evt.data;
      const clerkId = data.id;

      const primaryEmail =
        data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ||
        data.email_addresses?.[0]?.email_address;

      if (!clerkId || !primaryEmail) {
        console.warn(
          `⚠️ [Clerk Webhook] Skipping ${evt.type}: missing clerkId or email address.`,
          { clerkId, hasEmail: !!primaryEmail }
        );
        return;
      }

      const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || null;
      const image = data.image_url || null;

      try {
        await withPrismaRetry(() =>
          prisma.user.upsert({
            where: { clerkId },
            update: { email: primaryEmail, name, image },
            create: { clerkId, email: primaryEmail, name, image },
          })
        );
        console.log(`✅ [Clerk Webhook] Synced user ${clerkId} (${evt.type})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ [Clerk Webhook] Failed to upsert user ${clerkId}:`, msg);
        throw err;
      }
      break;
    }

    case "user.deleted": {
      const clerkId = evt.data.id;

      if (!clerkId) {
        console.warn("⚠️ [Clerk Webhook] Skipping user.deleted: missing clerkId.");
        return;
      }

      const result = await withPrismaRetry(() =>
        prisma.user.deleteMany({ where: { clerkId } })
      );

      console.log(`🗑️ [Clerk Webhook] Deleted ${result.count} user record(s) for clerkId ${clerkId}`);
      break;
    }

    default:
      console.log(`ℹ️ [Clerk Webhook] Unhandled event type: ${evt.type}`);
  }
}