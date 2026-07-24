import Stripe from "stripe";
import { prisma, withPrismaRetry } from "../lib/prisma";
import { ValidationError, NotFoundError } from "../errors/app-error";
import { STRIPE_PRICES, getPlanDetailsFromPriceId } from "../config/stripe.config";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock_secret_key";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock_webhook_secret";

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
});

export interface CreateCheckoutInput {
  tenantId: string;
  clerkUserId: string;
  priceId?: string;
  planType?: string;
  billingInterval?: string;
}

async function requireTenantWithSubscription(tenantId: string) {
  const tenant = await withPrismaRetry(() =>
    prisma.tenant.findUnique({ where: { id: tenantId }, include: { subscription: true } })
  );
  if (!tenant) {
    throw new NotFoundError("Workspace/tenant not found.");
  }
  return tenant;
}

/** Creates a Stripe Checkout session for a tenant's subscription upgrade. */
export async function createCheckoutSession(input: CreateCheckoutInput): Promise<{ url: string | null; sessionId: string }> {
  const planType = (input.planType || "PRO").toUpperCase();
  const billingInterval = (input.billingInterval || "MONTHLY").toUpperCase();

  const dbUser = await withPrismaRetry(() =>
    prisma.user.findUnique({ where: { clerkId: input.clerkUserId } })
  );
  if (!dbUser) {
    throw new NotFoundError("User profile not found.");
  }

  const tenant = await requireTenantWithSubscription(input.tenantId);

  let targetPriceId = input.priceId;

  // Guarantee exact Stripe Price ID matching planType and billingInterval
  if (planType === "AGENCY") {
    targetPriceId = billingInterval === "YEARLY" ? STRIPE_PRICES.AGENCY_YEARLY : STRIPE_PRICES.AGENCY_MONTHLY;
  } else if (planType === "PRO") {
    targetPriceId = billingInterval === "YEARLY" ? STRIPE_PRICES.PRO_YEARLY : STRIPE_PRICES.PRO_MONTHLY;
  } else if (!targetPriceId || targetPriceId.includes("placeholder")) {
    targetPriceId = STRIPE_PRICES.PRO_MONTHLY;
  }

  console.log(`💳 [createCheckoutSession] Tenant: ${tenant.id}, Plan: ${planType}, Interval: ${billingInterval}, Price ID: ${targetPriceId}`);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: dbUser.email,
      line_items: [{ price: targetPriceId, quantity: 1 }],
      client_reference_id: tenant.id,
      metadata: { tenantId: tenant.id, userId: dbUser.id, planType, billingInterval, priceId: targetPriceId },
      success_url: `${FRONTEND_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/dashboard?checkout=cancelled`,
    });

    return { url: session.url, sessionId: session.id };
  } catch (stripeErr: unknown) {
    const stripeMsg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    console.warn("⚠️ [Stripe Checkout API Warning]:", stripeMsg);
    throw new ValidationError(`Stripe API Error: ${stripeMsg}. Please configure valid STRIPE_SECRET_KEY in backend .env.`);
  }
}

/** Creates a Stripe Billing Portal session for a tenant's existing Stripe customer. */
export async function createPortalSession(tenantId: string): Promise<{ url: string | null }> {
  const tenant = await requireTenantWithSubscription(tenantId);
  const customerId = tenant.subscription?.stripeCustomerId;

  if (!customerId) {
    throw new ValidationError("No active Stripe customer subscription found for this workspace.");
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/dashboard/settings`,
    });
    return { url: session.url };
  } catch (stripeErr: unknown) {
    const stripeMsg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    console.warn("⚠️ [Stripe Customer Portal API Warning]:", stripeMsg);
    throw new ValidationError(`Stripe Customer Portal Error: ${stripeMsg}. Please configure valid STRIPE_SECRET_KEY in backend .env.`);
  }
}

/** Returns the plan/subscription summary for a tenant. */
export async function getTenantSubscriptionSummary(tenantId: string) {
  const tenant = await requireTenantWithSubscription(tenantId);
  const planDetails = getPlanDetailsFromPriceId(tenant.subscription?.stripePriceId);

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    planName: planDetails.plan,
    uploadCredits: tenant.uploadCredits,
    maxWorkspaces: tenant.maxWorkspaces,
    subscription: tenant.subscription
      ? {
          id: tenant.subscription.id,
          stripeCustomerId: tenant.subscription.stripeCustomerId,
          stripeSubscriptionId: tenant.subscription.stripeSubscriptionId,
          stripePriceId: tenant.subscription.stripePriceId,
          status: tenant.subscription.status,
          currentPeriodEnd: tenant.subscription.currentPeriodEnd,
        }
      : null,
  };
}

/** Processes a verified Stripe webhook event, applying subscription/credit side effects. */
export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = (session.metadata?.tenantId as string | undefined) || (session.client_reference_id as string | undefined);
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (!tenantId) break;

      let periodEnd: Date | null = null;
      let stripePriceId: string | null = (session.metadata?.priceId as string | undefined) || null;

      if (subscriptionId) {
        try {
          const subObj = await stripe.subscriptions.retrieve(subscriptionId);
          stripePriceId = subObj.items?.data?.[0]?.price?.id || stripePriceId;
          if ((subObj as unknown as { current_period_end?: number }).current_period_end) {
            periodEnd = new Date((subObj as unknown as { current_period_end: number }).current_period_end * 1000);
          }
        } catch (retrieveErr) {
          console.warn("⚠️ Could not retrieve Stripe subscription details:", retrieveErr);
        }
      }

      const { plan, monthlyCredits } = getPlanDetailsFromPriceId(stripePriceId);

      await withPrismaRetry(() =>
        prisma.subscription.upsert({
          where: { tenantId },
          update: { stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, stripePriceId, status: "ACTIVE", currentPeriodEnd: periodEnd },
          create: { tenantId, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, stripePriceId, status: "ACTIVE", currentPeriodEnd: periodEnd },
        })
      );

      const maxWorkspaces = plan === "AGENCY" ? 99999 : plan === "PRO" ? 3 : 1;

      await withPrismaRetry(() =>
        prisma.tenant.update({
          where: { id: tenantId },
          data: { uploadCredits: monthlyCredits, maxWorkspaces },
        })
      );

      console.log(`✅ [stripe.service] Checkout session completed for tenant ${tenantId}. Plan: ${plan}, Credits: ${monthlyCredits}.`);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as any;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

      if (!subscriptionId && !customerId) break;

      const subRecord = await withPrismaRetry(() =>
        prisma.subscription.findFirst({
          where: {
            OR: [
              ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
              ...(customerId ? [{ stripeCustomerId: customerId }] : []),
            ],
          },
        })
      );

      if (subRecord) {
        const { monthlyCredits } = getPlanDetailsFromPriceId(subRecord.stripePriceId);
        await withPrismaRetry(() =>
          prisma.tenant.update({ where: { id: subRecord.tenantId }, data: { uploadCredits: { increment: monthlyCredits } } })
        );
        console.log(`💳 [stripe.service] Refilled +${monthlyCredits} upload credits for tenant ${subRecord.tenantId}`);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const priceId = sub.items?.data?.[0]?.price?.id;
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
        ? new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000)
        : null;

      if (!tenantId) break;

      const { plan, monthlyCredits } = getPlanDetailsFromPriceId(priceId);

      await withPrismaRetry(() =>
        prisma.subscription.upsert({
          where: { tenantId },
          update: { stripeCustomerId: customerId, stripeSubscriptionId: sub.id, stripePriceId: priceId, status: "ACTIVE", currentPeriodEnd: periodEnd },
          create: { tenantId, stripeCustomerId: customerId, stripeSubscriptionId: sub.id, stripePriceId: priceId, status: "ACTIVE", currentPeriodEnd: periodEnd },
        })
      );

      const maxWorkspaces = plan === "AGENCY" ? 99999 : plan === "PRO" ? 3 : 1;

      await withPrismaRetry(() =>
        prisma.tenant.update({
          where: { id: tenantId },
          data: { uploadCredits: monthlyCredits, maxWorkspaces },
        })
      );

      console.log(`✅ [stripe.service] Subscription updated for tenant ${tenantId}. Plan: ${plan}, Credits: ${monthlyCredits}.`);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.id) {
        await withPrismaRetry(() =>
          prisma.subscription.updateMany({ where: { stripeSubscriptionId: sub.id }, data: { status: "canceled" } })
        );
      }
      break;
    }

    default:
      console.log(`ℹ️ [stripe.service] Unhandled event type: ${event.type}`);
  }
}
