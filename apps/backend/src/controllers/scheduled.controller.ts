import { Response } from "express";
import { TenantRequest } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/async-handler.util";
import { sendSuccess } from "../utils/response.util";
import {
  listScheduledJobs,
  getScheduledJobById,
  updateScheduledJob,
  cancelScheduledJob,
} from "../services/scheduled.service";

// 1. GET /api/scheduled - List all pending/scheduled publish jobs for the tenant
export const getScheduledJobsHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const data = await listScheduledJobs(req.tenantId!);
  sendSuccess(res, { data });
});

// 2. GET /api/scheduled/:jobId - Get detailed job status and platformTasks
export const getScheduledJobByIdHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const data = await getScheduledJobById(req.tenantId!, req.params.jobId);
  sendSuccess(res, { data });
});

// 3. PATCH /api/scheduled/:jobId - Reschedule or update job details
export const updateScheduledJobHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const data = await updateScheduledJob(req.tenantId!, req.params.jobId, req.body);
  sendSuccess(res, { message: "Scheduled job updated successfully.", data });
});

// 4. DELETE /api/scheduled/:jobId - Cancel a scheduled job
export const deleteScheduledJobHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const data = await cancelScheduledJob(req.tenantId!, req.params.jobId);
  sendSuccess(res, { message: "Scheduled job cancelled successfully.", data });
});
