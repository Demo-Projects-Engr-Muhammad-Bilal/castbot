import { prisma, withPrismaRetry } from "../lib/prisma";

export interface PlanTierInfo {
  isAgency: boolean;
  isPro: boolean;
  allowedAccountLimit: number;
  planName: "AGENCY" | "PRO" | "STARTER";
}

/**
 * Single source of truth for translating a subscription's `stripePriceId` into
 * plan-tier flags and derived limits. Previously this logic (isAgency/isPro/
 * allowedAccountLimit) was re-derived inline inside accounts.controller.ts.
 */
export function getPlanTierInfo(sub: { stripePriceId?: string | null; status?: string | null } | null | undefined): PlanTierInfo {
  const isAgency =
    sub?.stripePriceId === process.env.STRIPE_PRICE_AGENCY_MONTHLY ||
    sub?.stripePriceId === process.env.STRIPE_PRICE_AGENCY_YEARLY;
  const isPro =
    sub?.stripePriceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    sub?.stripePriceId === process.env.STRIPE_PRICE_PRO_YEARLY;

  const allowedAccountLimit = isAgency ? 9999 : isPro ? 3 : 1;

  const isActive = sub?.status === "active" || sub?.status === "ACTIVE";
  const planName: PlanTierInfo["planName"] = isActive ? (isAgency ? "AGENCY" : "PRO") : "STARTER";

  return { isAgency, isPro, allowedAccountLimit, planName };
}

/**
 * Fetches a tenant's subscription and derives its plan-tier info in one call.
 */
export async function getTenantPlanTierInfo(tenantId: string): Promise<PlanTierInfo> {
  const tenant = await withPrismaRetry(() =>
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    })
  );
  return getPlanTierInfo(tenant?.subscription);
}

/** Credits/workspace allowance granted when a tenant's subscription becomes active. */
export function getEntitlementsForPlan(isAgency: boolean): { creditsToAdd: number; maxWorkspaces: number } {
  return isAgency ? { creditsToAdd: 2000, maxWorkspaces: 9999 } : { creditsToAdd: 300, maxWorkspaces: 3 };
}
