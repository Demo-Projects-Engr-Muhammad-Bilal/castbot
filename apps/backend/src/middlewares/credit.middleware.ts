import { Response, NextFunction } from "express";
import { TenantRequest } from "./tenant.middleware";
import { prisma, withPrismaRetry } from "../lib/prisma";

/**
 * Verifies the tenant resolved by `validateTenantMiddleware` (req.tenantId)
 * has at least one upload credit remaining. Runs strictly after
 * validateTenantMiddleware on every route that mounts it, so req.tenantId is
 * already a membership-verified tenant id — no need to re-traverse the
 * user -> tenantMembers -> tenant graph here.
 */
export async function checkUploadCreditMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.tenantId?.trim();

    if (!tenantId) {
      res.status(401).json({ success: false, error: "Authentication required to publish media." });
      return;
    }

    const tenant = await withPrismaRetry(() =>
      prisma.tenant.findUnique({
        where: { id: tenantId },
      })
    );

    if (!tenant) {
      res.status(404).json({ success: false, error: "Workspace/tenant record not found." });
      return;
    }

    if (tenant.uploadCredits <= 0) {
      res.status(403).json({
        success: false,
        error: "Insufficient upload credits available for this workspace. Please upgrade your SaaS plan to continue publishing.",
        upgradeRequired: true,
        remainingCredits: tenant.uploadCredits,
        tenantId: tenant.id,
      });
      return;
    }

    req.tenantId = tenant.id;
    next();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ [checkUploadCreditMiddleware] Error:", msg);
    res.status(500).json({ success: false, error: "Failed to verify workspace upload credits." });
  }
}
