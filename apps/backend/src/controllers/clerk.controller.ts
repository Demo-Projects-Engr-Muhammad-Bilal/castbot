import { Request, Response } from "express";
import { Webhook, WebhookRequiredHeaders } from "svix";
import { CLERK_WEBHOOK_SECRET } from "../config/clerk.config";
import { processClerkWebhookEvent } from "../services/clerk.service";
import { ClerkWebhookEvent } from "../types/clerk.types";

/**
 * POST /api/clerk/webhook
 */
export async function clerkWebhookHandler(req: Request, res: Response): Promise<void> {
  if (!CLERK_WEBHOOK_SECRET) {
    console.error("❌ [Clerk Webhook] CLERK_WEBHOOK_SECRET is not configured.");
    res.status(500).json({ success: false, error: "Webhook secret not configured on server." });
    return;
  }

  const svixId = req.headers["svix-id"] as string | undefined;
  const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
  const svixSignature = req.headers["svix-signature"] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("❌ [Clerk Webhook] Missing required Svix headers.");
    res.status(400).json({ success: false, error: "Missing required Svix headers." });
    return;
  }

  const payload = req.body as Buffer;
  let event: ClerkWebhookEvent;

  try {
    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    const headers: WebhookRequiredHeaders = {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    };
    event = wh.verify(payload, headers) as unknown as ClerkWebhookEvent;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ [Clerk Webhook] Signature verification failed:", msg);
    res.status(400).json({ success: false, error: `Webhook verification failed: ${msg}` });
    return;
  }

  try {
    await processClerkWebhookEvent(event);
    res.status(200).json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [Clerk Webhook] Event processing error (${event.type}):`, msg);
    res.status(500).json({ success: false, error: msg });
  }
}