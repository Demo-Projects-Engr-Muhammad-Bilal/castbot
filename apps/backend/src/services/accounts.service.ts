import { prisma, withPrismaRetry } from "../lib/prisma";
import { encryptToken } from "../utils/crypto.util";
import { Provider } from "@repo/database";
import { getTenantPlanTierInfo } from "./subscription.service";
import { ValidationError, PlanLimitError } from "../errors/app-error";

export const ALL_PROVIDERS: Provider[] = ["YOUTUBE", "FACEBOOK", "INSTAGRAM", "TIKTOK"];

export interface AccountStatus {
  id: string | null;
  provider: Provider;
  connected: boolean;
  providerAccountId: string;
  updatedAt: string | null;
  status: "ACTIVE" | "EXPIRED" | "NOT_CONNECTED";
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
}

/**
 * Returns the connection status of every supported provider for a tenant,
 * regardless of whether a SocialAccount row exists for it yet.
 */
export async function listAccountStatuses(tenantId: string): Promise<AccountStatus[]> {
  let existingAccounts: Array<{
    id: string;
    provider: Provider;
    providerAccountId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    updatedAt: Date;
  }> = [];

  try {
    existingAccounts = await withPrismaRetry(() =>
      prisma.socialAccount.findMany({
        where: { tenantId },
      })
    );
  } catch (dbErr: unknown) {
    const errorStack = dbErr instanceof Error ? dbErr.stack || dbErr.message : String(dbErr);
    console.error("⚠️ [accounts.service] DB Query failed, returning fallback accounts status:", errorStack);
  }

  return ALL_PROVIDERS.map((provider) => {
    const found = existingAccounts.find((acc) => acc.provider === provider);
    if (found) {
      const isExpired = found.expiresAt ? new Date(found.expiresAt) < new Date() : false;
      return {
        id: found.id,
        provider: found.provider,
        connected: true,
        providerAccountId: found.providerAccountId,
        updatedAt: found.updatedAt.toISOString(),
        status: isExpired ? "EXPIRED" : "ACTIVE",
        hasAccessToken: Boolean(found.accessToken),
        hasRefreshToken: Boolean(found.refreshToken),
      };
    }
    return {
      id: null,
      provider,
      connected: false,
      providerAccountId: "Not Connected",
      updatedAt: null,
      status: "NOT_CONNECTED",
      hasAccessToken: false,
      hasRefreshToken: false,
    };
  });
}

export interface UpdateAccountInput {
  provider: string;
  providerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface UpdatedAccountResult {
  id: string;
  tenantId: string;
  provider: Provider;
  providerAccountId: string;
  updatedAt: string;
  status: "ACTIVE";
}

/**
 * Connects or updates a social account for a tenant, enforcing the plan's
 * account-connection limit (via subscription.service) before writing.
 */
export async function connectOrUpdateAccount(
  tenantId: string,
  input: UpdateAccountInput
): Promise<UpdatedAccountResult> {
  const { provider, providerAccountId, accessToken, refreshToken } = input;

  if (!provider || (!accessToken && !refreshToken)) {
    throw new ValidationError("Provider and at least one credential token/cookie are required.");
  }

  const providerEnum = String(provider).toUpperCase() as Provider;
  if (!ALL_PROVIDERS.includes(providerEnum)) {
    throw new ValidationError(`Invalid provider: ${provider}`);
  }

  const { allowedAccountLimit } = await getTenantPlanTierInfo(tenantId);

  // Single query covers both "does an account already exist for this
  // provider" and "how many total" — previously two round-trips.
  const existingAccountsForProvider = await withPrismaRetry(() =>
    prisma.socialAccount.findMany({
      where: { tenantId, provider: providerEnum },
    })
  );

  const existingAccCount = existingAccountsForProvider.length;
  const existingAcc = existingAccountsForProvider[0];

  if (!existingAcc && existingAccCount >= allowedAccountLimit) {
    throw new PlanLimitError(
      `Account connection limit reached for platform ${providerEnum} on your current plan (Allowed: ${allowedAccountLimit}). Please upgrade to Pro or Agency to connect more accounts.`,
      { allowedAccountLimit, currentCount: existingAccCount }
    );
  }

  const accountId = providerAccountId || `${providerEnum.toLowerCase()}-account`;
  const finalAccessToken = accessToken || refreshToken || "N/A";
  const finalRefreshToken = refreshToken || accessToken || null;

  const encryptedAccessToken = encryptToken(finalAccessToken);
  const encryptedRefreshToken = finalRefreshToken ? encryptToken(finalRefreshToken) : null;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const updatedAccount = existingAcc
    ? await withPrismaRetry(() =>
        prisma.socialAccount.update({
          where: { id: existingAcc.id },
          data: {
            providerAccountId: accountId,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
          },
        })
      )
    : await withPrismaRetry(() =>
        prisma.socialAccount.create({
          data: {
            tenantId,
            provider: providerEnum,
            providerAccountId: accountId,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
          },
        })
      );

  return {
    id: updatedAccount.id,
    tenantId: updatedAccount.tenantId,
    provider: updatedAccount.provider,
    providerAccountId: updatedAccount.providerAccountId,
    updatedAt: updatedAccount.updatedAt.toISOString(),
    status: "ACTIVE",
  };
}
