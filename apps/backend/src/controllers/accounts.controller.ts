import { Response } from "express";
import { TenantRequest } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/async-handler.util";
import { sendSuccess } from "../utils/response.util";
import { listAccountStatuses, connectOrUpdateAccount } from "../services/accounts.service";

/**
 * GET /api/accounts
 * Tenant resolution now happens once, upstream, in `validateTenantMiddleware`.
 */
export const getAccountsHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const accounts = await listAccountStatuses(req.tenantId!);
  sendSuccess(res, { tenantId: req.tenantId, accounts });
});

/**
 * POST /api/accounts
 */
export const updateAccountHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const account = await connectOrUpdateAccount(req.tenantId!, req.body);
  sendSuccess(res, {
    message: `${account.provider} credentials updated and encrypted successfully for workspace.`,
    account,
  });
});
