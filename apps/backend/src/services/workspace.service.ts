import { prisma, withPrismaRetry } from "../lib/prisma";
import { TenantRole } from "@repo/database";
import { NotFoundError, ForbiddenError, ValidationError } from "../errors/app-error";
import { getPlanDetailsFromPriceId } from "../config/stripe.config";

export const DEFAULT_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "FACEBOOK", "TIKTOK"];

async function requireDbUser(clerkUserId: string) {
  const dbUser = await withPrismaRetry(() => prisma.user.findUnique({ where: { clerkId: clerkUserId } }));
  if (!dbUser) {
    throw new NotFoundError("User profile not found in database.");
  }
  return dbUser;
}

/** Lists every workspace/tenant the given Clerk user is a member of. */
export async function listWorkspacesForUser(clerkUserId: string) {
  const dbUser = await withPrismaRetry(() =>
    prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: {
        tenantMembers: {
          include: {
            tenant: {
              include: {
                socialAccounts: {
                  select: { id: true, provider: true, providerAccountId: true, updatedAt: true },
                },
                telegramConnections: {
                  select: { id: true, targetChannelId: true, isActive: true, updatedAt: true },
                },
                subscription: true,
              },
            },
          },
        },
      },
    })
  );

  if (!dbUser) {
    throw new NotFoundError("User account not found.");
  }

  return dbUser.tenantMembers.map((tm) => {
    const planDetails = getPlanDetailsFromPriceId(
      tm.tenant.subscription?.stripePriceId,
      tm.tenant.uploadCredits
    );

    return {
      id: tm.tenant.id,
      name: tm.tenant.name,
      slug: tm.tenant.slug,
      niche: tm.tenant.niche || null,
      enabledPlatforms: tm.tenant.enabledPlatforms || DEFAULT_PLATFORMS,
      uploadCredits: tm.tenant.uploadCredits,
      maxWorkspaces: tm.tenant.maxWorkspaces,
      planTier: planDetails.plan,
      plan: planDetails.plan,
      tier: planDetails.plan,
      role: tm.role,
      subscription: tm.tenant.subscription,
      connectedSocialAccounts: tm.tenant.socialAccounts,
      telegramConnections: tm.tenant.telegramConnections,
      createdAt: tm.tenant.createdAt,
      updatedAt: tm.tenant.updatedAt,
    };
  });
}

export interface CreateWorkspaceInput {
  name?: string;
  slug?: string;
  niche?: string;
  enabledPlatforms?: string[];
}

/** Creates a new workspace/tenant for the user, enforcing the owned-workspace tier limit. */
export async function createWorkspaceForUser(clerkUserId: string, input: CreateWorkspaceInput) {
  const { name, slug, niche, enabledPlatforms } = input;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ValidationError("Workspace name is required.");
  }

  const dbUser = await requireDbUser(clerkUserId);

  const userMemberships = await withPrismaRetry(() =>
    prisma.tenantMember.findMany({
      where: { userId: dbUser.id, role: TenantRole.OWNER },
      include: { tenant: true },
    })
  );

  const userOwnedWorkspaces = userMemberships.map((m) => m.tenant);
  const maxWorkspacesAllowed = userOwnedWorkspaces.reduce((max, t) => Math.max(max, t.maxWorkspaces || 1), 1);

  if (userOwnedWorkspaces.length >= maxWorkspacesAllowed) {
    throw new ForbiddenError(
      `Workspace limit reached for your current plan (Allowed: ${maxWorkspacesAllowed}, Current: ${userOwnedWorkspaces.length}). Please upgrade to Pro or Agency to create additional workspaces.`,
      { upgradeRequired: true, maxWorkspacesAllowed, currentWorkspaceCount: userOwnedWorkspaces.length }
    );
  }

  const derivedSlug = (slug || name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const validPlatforms =
    Array.isArray(enabledPlatforms) && enabledPlatforms.length > 0
      ? enabledPlatforms.map((p: string) => String(p).toUpperCase())
      : DEFAULT_PLATFORMS;

  const existingTenant = await withPrismaRetry(() => prisma.tenant.findUnique({ where: { slug: derivedSlug } }));

  const finalSlug = existingTenant ? `${derivedSlug}-${Math.random().toString(36).substring(2, 6)}` : derivedSlug;

  const tenant = await withPrismaRetry(() =>
    prisma.tenant.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        niche: niche ? String(niche).trim() : null,
        enabledPlatforms: validPlatforms,
        maxWorkspaces: maxWorkspacesAllowed,
        members: { create: { userId: dbUser.id, role: TenantRole.OWNER } },
      },
      include: { members: true },
    })
  );

  console.log(`✅ [workspace.service] Workspace '${tenant.name}' (${tenant.id}) created for user ${dbUser.id}`);

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    niche: tenant.niche,
    enabledPlatforms: tenant.enabledPlatforms,
    uploadCredits: tenant.uploadCredits,
    maxWorkspaces: tenant.maxWorkspaces,
    planTier: "FREE",
    plan: "FREE",
    tier: "FREE",
    role: TenantRole.OWNER,
  };
}

export interface UpdateWorkspaceInput {
  name?: string;
  niche?: string;
  enabledPlatforms?: string[];
  planTier?: string;
  uploadCredits?: number;
}

/**
 * Updates a workspace's settings.
 */
export async function updateWorkspaceForUser(clerkUserId: string, workspaceId: string, input: UpdateWorkspaceInput) {
  const { name, niche, enabledPlatforms, planTier, uploadCredits } = input;
  const dbUser = await requireDbUser(clerkUserId);

  const membership = await withPrismaRetry(() =>
    prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId: dbUser.id, tenantId: workspaceId } },
    })
  );

  if (!membership || (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN)) {
    throw new ForbiddenError("Insufficient permissions to modify workspace settings.");
  }

  const updateData: Record<string, unknown> = {};
  if (name && typeof name === "string" && name.trim().length > 0) {
    updateData.name = name.trim();
  }
  if (niche !== undefined) {
    updateData.niche = niche ? String(niche).trim() : null;
  }
  if (Array.isArray(enabledPlatforms)) {
    updateData.enabledPlatforms = enabledPlatforms.map((p: string) => String(p).toUpperCase());
  }
  if (typeof uploadCredits === "number") {
    updateData.uploadCredits = uploadCredits;
  }

  const updatedTenant = await withPrismaRetry(() =>
    prisma.tenant.update({
      where: { id: workspaceId },
      data: updateData,
      include: { subscription: true },
    })
  );

  const planDetails = getPlanDetailsFromPriceId(
    updatedTenant.subscription?.stripePriceId,
    updatedTenant.uploadCredits
  );

  return {
    id: updatedTenant.id,
    name: updatedTenant.name,
    slug: updatedTenant.slug,
    niche: updatedTenant.niche,
    enabledPlatforms: updatedTenant.enabledPlatforms,
    uploadCredits: updatedTenant.uploadCredits,
    maxWorkspaces: updatedTenant.maxWorkspaces,
    planTier: planDetails.plan,
    plan: planDetails.plan,
    tier: planDetails.plan,
  };
}
