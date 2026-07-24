import { Request, Response } from "express";
import Stripe from "stripe";
import { TenantRequest } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/async-handler.util";
import { sendSuccess } from "../utils/response.util";
import { requireClerkUserId } from "../services/tenant.service";
import { prisma, withPrismaRetry } from "../lib/prisma";
import {
  stripe,
  STRIPE_WEBHOOK_SECRET,
  createCheckoutSession,
  createPortalSession,
  getTenantSubscriptionSummary,
  processStripeWebhookEvent,
} from "../services/stripe.service";

export const createCheckoutSessionHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const clerkUserId = requireClerkUserId(req.userId || req.auth?.userId);
  const { priceId, price_id, price, planType, plan_type, billingInterval, interval } = req.body || {};

  const targetPriceId = priceId || price_id || price;
  const targetPlanType = planType || plan_type;

  if (!targetPriceId && !targetPlanType) {
    res.status(400).json({
      success: false,
      error: "Missing required subscription parameters (priceId or planType)",
    });
    return;
  }

  console.log(
    "💳 [Stripe Checkout Controller] Inbound request. priceId:",
    targetPriceId,
    "planType:",
    targetPlanType,
    "interval:",
    billingInterval || interval
  );

  const result = await createCheckoutSession({
    tenantId: req.tenantId!,
    clerkUserId,
    priceId: targetPriceId,
    planType: targetPlanType,
    billingInterval: billingInterval || interval,
  });

  sendSuccess(res, { url: result.url, sessionId: result.sessionId });
});

export const downgradeSubscriptionHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const tenantId = req.tenantId!;
  console.log("📉 [Subscription Downgrade] Downgrading tenant to FREE tier:", tenantId);

  await withPrismaRetry(() =>
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        uploadCredits: 10,
        maxWorkspaces: 1,
      },
    })
  );

  await withPrismaRetry(() =>
    prisma.subscription.upsert({
      where: { tenantId },
      update: { status: "canceled", stripePriceId: null },
      create: { tenantId, status: "canceled", stripePriceId: null },
    })
  );

  sendSuccess(res, { message: "Workspace downgraded to Free tier successfully.", plan: "FREE" });
});

export const createPortalSessionHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const result = await createPortalSession(req.tenantId!);
  sendSuccess(res, { url: result.url });
});

export const getSubscriptionHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const summary = await getTenantSubscriptionSummary(req.tenantId!);
  sendSuccess(res, summary);
});

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    if (
      STRIPE_WEBHOOK_SECRET &&
      STRIPE_WEBHOOK_SECRET !== "whsec_mock_webhook_secret" &&
      STRIPE_WEBHOOK_SECRET !== "whsec_placeholder"
    ) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      event = req.body as Stripe.Event;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Stripe Webhook Signature Error:", msg);
    res.status(400).send(`Webhook Error: ${msg}`);
    return;
  }

  try {
    await processStripeWebhookEvent(event);
    res.status(200).json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ [stripeWebhookHandler] Event processing error:", msg);
    res.status(500).json({ success: false, error: msg });
  }
}
