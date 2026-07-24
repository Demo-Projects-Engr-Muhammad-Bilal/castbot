import { prisma, withPrismaRetry } from "../lib/prisma";
import { UnauthorizedError, NotFoundError, ForbiddenError } from "../errors/app-error";

export interface ResolvedTenant {
  dbUserId: string;
  userEmail: string | null;
  tenantId: string;
  tenantRole: string;
}

/**
 * Single source of truth for "given a Clerk user id and an optionally-requested
 * tenant id, which internal user record and which tenant/role apply to this
 * request?". Consumed by `tenant.middleware.ts` (attaches to req.tenantId /
 * req.tenantRole) and directly by any service that needs to re-verify tenant
 * membership.
 *
 * Resolution precedence for the target tenant: explicit `requestedTenantId`
 * (header/query/body — resolved by the caller) first, falling back to the
 * user's first/primary tenant membership.
 */
export async function resolveUserAndTenant(
  rawUserId: string | undefined | null,
  requestedTenantId?: string | null
): Promise<ResolvedTenant> {
  const userIdStr = typeof rawUserId === "string" && rawUserId.trim().length > 0 ? rawUserId.trim() : null;

  if (!userIdStr) {
    throw new UnauthorizedError("Authentication required to access workspace context.");
  }

  const dbUser = await withPrismaRetry(() =>
    prisma.user.findUnique({
      where: { clerkId: userIdStr },
      include: {
        tenantMembers: {
          include: { tenant: true },
        },
      },
    })
  );

  if (!dbUser) {
    throw new NotFoundError("User account record not found.");
  }

  const trimmedRequestedTenantId = requestedTenantId?.trim();

  let targetMembership = dbUser.tenantMembers?.[0];

  if (trimmedRequestedTenantId) {
    const match = dbUser.tenantMembers.find(
      (tm) => tm.tenantId === trimmedRequestedTenantId || tm.tenant.slug === trimmedRequestedTenantId
    );
    if (!match) {
      throw new ForbiddenError("Forbidden: You do not have permissions or membership access to this target workspace.");
    }
    targetMembership = match;
  }

  if (!targetMembership) {
    throw new ForbiddenError("No active workspace membership found for this user.");
  }

  return {
    dbUserId: dbUser.id,
    userEmail: dbUser.email ?? null,
    tenantId: targetMembership.tenantId,
    tenantRole: targetMembership.role,
  };
}

/**
 * Normalizes the raw Clerk user id off a request, throwing UnauthorizedError
 * if it's missing/blank. Used by controllers/services that only need the
 * Clerk id (e.g. to resolve a `dbUser` themselves) rather than a full tenant.
 */
export function requireClerkUserId(rawUserId: string | undefined | null): string {
  const userIdStr = typeof rawUserId === "string" && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
  if (!userIdStr) {
    throw new UnauthorizedError("Authentication required.");
  }
  return userIdStr;
}

/**
 * Extracts the requested tenant id from the standard header -> query -> body
 * precedence used across every tenant-scoped route.
 */
export function extractRequestedTenantId(req: {
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  body?: Record<string, unknown>;
}): string | undefined {
  const headerTenantId = req.headers["x-tenant-id"] as string | undefined;
  const queryTenantId = req.query?.tenantId as string | undefined;
  const bodyTenantId = req.body?.tenantId as string | undefined;
  return headerTenantId || queryTenantId || bodyTenantId;
}
