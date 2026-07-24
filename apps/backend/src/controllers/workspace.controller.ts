import { Response } from "express";
import { TenantRequest } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/async-handler.util";
import { sendSuccess } from "../utils/response.util";
import { requireClerkUserId } from "../services/tenant.service";
import {
  listWorkspacesForUser,
  createWorkspaceForUser,
  updateWorkspaceForUser,
} from "../services/workspace.service";

/**
 * GET /api/workspaces
 * Fetch all workspaces associated with the authenticated user.
 */
export const getWorkspacesHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const clerkUserId = requireClerkUserId(req.userId || req.auth?.userId);
  const workspaces = await listWorkspacesForUser(clerkUserId);
  sendSuccess(res, { count: workspaces.length, data: workspaces });
});

/**
 * POST /api/workspaces
 * Create a new workspace/tenant with tier limit checks.
 */
export const createWorkspaceHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const clerkUserId = requireClerkUserId(req.userId || req.auth?.userId);
  const workspace = await createWorkspaceForUser(clerkUserId, req.body);
  sendSuccess(res, { message: "Workspace created successfully.", data: workspace }, 201);
});

/**
 * PATCH /api/workspaces/:id
 * Update workspace settings, niche, or enabled platforms capability array.
 */
export const updateWorkspaceHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const clerkUserId = requireClerkUserId(req.userId || req.auth?.userId);
  const workspace = await updateWorkspaceForUser(clerkUserId, req.params.id, req.body);
  sendSuccess(res, { message: "Workspace updated successfully.", data: workspace });
});
