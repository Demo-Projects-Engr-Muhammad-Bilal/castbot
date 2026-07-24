import { Response } from "express";
import { TenantRequest } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/async-handler.util";
import { sendSuccess } from "../utils/response.util";
import { prisma } from "../lib/prisma";

export const getOverviewMetricsHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const tenantId = req.tenantId;

  if (!tenantId) {
    return sendSuccess(res, {
      connectedAccounts: 0,
      scheduledQueue: 0,
      publishedVideos: 0,
      recentActivity: [],
    });
  }

  const [socialCount, telegramCount, queuedCount, completedCount, recentJobs] = await Promise.all([
    prisma.socialAccount.count({ where: { tenantId } }),
    prisma.telegramConnection.count({ where: { tenantId, isActive: true } }),
    prisma.publishJob.count({
      where: {
        tenantId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    }),
    prisma.publishJob.count({
      where: {
        tenantId,
        status: "COMPLETED",
      },
    }),
    prisma.publishJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { tasks: true },
    }),
  ]);

  sendSuccess(res, {
    connectedAccounts: socialCount + telegramCount,
    scheduledQueue: queuedCount,
    publishedVideos: completedCount,
    recentActivity: recentJobs,
  });
});
