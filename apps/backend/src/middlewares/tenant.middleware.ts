import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { resolveUserAndTenant, extractRequestedTenantId } from "../services/tenant.service";
import { AppError } from "../errors/app-error";

export interface TenantRequest extends AuthenticatedRequest {
  tenantId?: string;
  tenantRole?: string;
}

/**
 * Middleware to validate x-tenant-id header (or query/body parameter)
 * ensuring requests are strictly scoped to a workspace/tenant owned by the requesting user.
 * Includes timeout protection to prevent hanging socket connections during pool congestion.
 */
export async function validateTenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawUserId = req.userId || req.auth?.userId;
    const requestedTenantId = extractRequestedTenantId(req);

    // 5-second timeout safeguard for database tenant resolution
    let timerId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error("Database connection timeout during workspace validation")),
        5000
      );
    });

    let resolved;
    try {
      resolved = await Promise.race([
        resolveUserAndTenant(rawUserId, requestedTenantId),
        timeoutPromise,
      ]);
    } finally {
      // Prevent the timer from firing/keeping the event loop alive once
      // resolveUserAndTenant has already settled the race.
      if (timerId) clearTimeout(timerId);
    }

    req.tenantId = resolved.tenantId;
    req.tenantRole = resolved.tenantRole;

    next();
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }

    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Tenant middleware validation error:", msg);

    if (msg.includes("timeout") || msg.includes("terminated") || msg.includes("P1017")) {
      res.status(504).json({
        success: false,
        error: "Database connection timeout during workspace validation. Please retry your request.",
      });
      return;
    }

    res.status(500).json({ success: false, error: msg });
  }
}
