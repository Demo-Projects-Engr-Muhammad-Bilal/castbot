import { Response } from "express";
import { TenantRequest } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/async-handler.util";
import { sendSuccess } from "../utils/response.util";
import { publishVideo } from "../services/publish.service";

export const publishVideoHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const result = await publishVideo({
    tenantId: req.tenantId!,
    file: req.file,
    captionDataRaw: req.body.captionData as string | undefined,
    caption: req.body.caption as string | undefined,
    platformsRaw: req.body.platforms as string | undefined,
    scheduledForRaw: req.body.scheduledFor as string | number | undefined,
  });

  const { jobId, scheduled, queued, platforms, scheduledFor, delayMs, message } = result;

  sendSuccess(res, {
    ...(scheduled ? { scheduled, scheduledFor, delayMs } : { queued }),
    jobId,
    platforms,
    message,
  });
});
