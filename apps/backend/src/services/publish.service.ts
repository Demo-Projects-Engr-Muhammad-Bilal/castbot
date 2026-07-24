import fs from "fs";
import path from "path";
import { prisma, withPrismaRetry } from "../lib/prisma";
import { createPendingPublishJob } from "../lib/db-ledger";
import { publishQueue, tiktokPublishQueue } from "../queues/publish.queue";
import { Provider, PublishStatus } from "@repo/database";
import { NotFoundError, ValidationError } from "../errors/app-error";

const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");

export interface PublishVideoInput {
  tenantId: string;
  file: Express.Multer.File | undefined;
  captionDataRaw?: string;
  caption?: string;
  platformsRaw?: string;
  scheduledForRaw?: string | number;
}

export interface PublishVideoResult {
  jobId: string;
  scheduled: boolean;
  queued: boolean;
  platforms: string[];
  scheduledFor?: string | number;
  delayMs: number;
  message: string;
}

/** Resolves a tenant's slug, throwing if it no longer exists. */
async function getTenantSlug(tenantId: string): Promise<string> {
  const tenant = await withPrismaRetry(() => prisma.tenant.findUnique({ where: { id: tenantId } }));
  if (!tenant) {
    throw new NotFoundError("Workspace/tenant not found.");
  }
  return tenant.slug;
}

/**
 * Validates the incoming upload, writes the video + job config to disk,
 * enqueues the BullMQ publish job, and deducts an upload credit.
 */
export async function publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
  const { tenantId, file, captionDataRaw, caption = "", platformsRaw, scheduledForRaw } = input;

  if (!file) {
    throw new ValidationError("No video file provided.");
  }

  const requestedPlatforms: string[] = platformsRaw ? JSON.parse(platformsRaw) : [];
  if (requestedPlatforms.length === 0) {
    throw new ValidationError("No target platforms specified.");
  }

  const validPlatforms = requestedPlatforms.map((p) => p.toUpperCase() as Provider);

  // Log target platforms and tenant linkage
  console.log(`📥 [publish.service] Inbound publish request for tenant: ${tenantId}, platforms:`, validPlatforms);

  let captionData: { global: string; isCustom?: boolean };
  if (captionDataRaw) {
    try {
      captionData = JSON.parse(captionDataRaw);
    } catch {
      captionData = { global: caption, isCustom: false };
    }
  } else {
    captionData = { global: caption, isCustom: false };
  }

  let delay = 0;
  let isScheduledRequest = false;

  if (scheduledForRaw) {
    isScheduledRequest = true;
    const scheduledTime = new Date(scheduledForRaw).getTime();
    const now = Date.now();

    if (isNaN(scheduledTime)) {
      throw new ValidationError("Invalid scheduled date/time format provided.");
    }

    delay = scheduledTime - now;
    if (delay < 30000) {
      throw new ValidationError("Scheduled time must be at least 1 minute in the future.");
    }
  }

  const tenantSlug = await getTenantSlug(tenantId);

  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }

  const parentJob = await createPendingPublishJob(tenantId, "", captionData.global || caption, validPlatforms);

  const jobId = parentJob.id;
  const TEMP_VIDEO_PATH = path.join(SCRIPTS_DIR, `temp-${jobId}.mp4`);
  const TEMP_CONFIG_PATH = path.join(SCRIPTS_DIR, `config-${jobId}.json`);

  await fs.promises.writeFile(TEMP_VIDEO_PATH, file.buffer);

  const jobConfig = {
    jobId,
    tenantId,
    videoPath: TEMP_VIDEO_PATH,
    tenantSlug,
    captionData,
    caption: captionData.global,
    platforms: requestedPlatforms,
  };

  await fs.promises.writeFile(TEMP_CONFIG_PATH, JSON.stringify(jobConfig, null, 2), "utf-8");

  const hasTikTok = requestedPlatforms.some((p) => p.toUpperCase() === "TIKTOK");
  const hasNonTikTok = requestedPlatforms.some((p) => p.toUpperCase() !== "TIKTOK");
  const jobOpts = { jobId, delay: delay > 0 ? delay : undefined };

  console.log(
    `📥 [publish.service] Enqueuing publish job ${jobId} into BullMQ (delay: ${delay}ms, lightQueue: ${hasNonTikTok}, tiktokQueue: ${hasTikTok})...`
  );
  let enqueueSuccess = false;
  let queueErrorMsg = "";

  try {
    // Split across the two isolated queues so heavy Puppeteer TikTok work
    // never competes with the fast API-based publishers for concurrency slots.
    if (hasNonTikTok) {
      await publishQueue.add("publish-video", jobConfig, jobOpts);
    }
    if (hasTikTok) {
      await tiktokPublishQueue.add("publish-video-tiktok", jobConfig, jobOpts);
    }
    enqueueSuccess = true;
    console.log(`✅ [publish.service] Job ${jobId} successfully enqueued into BullMQ (delay: ${delay}ms).`);
  } catch (queueErr: unknown) {
    queueErrorMsg = queueErr instanceof Error ? queueErr.message : String(queueErr);
    console.warn("⚠️ [publish.service] Could not enqueue to Redis BullMQ:", queueErrorMsg);
  }

  if (!enqueueSuccess) {
    await withPrismaRetry(() =>
      prisma.publishJob.update({ where: { id: jobId }, data: { status: PublishStatus.FAILED } })
    );
    throw new Error(`Failed to enqueue post in queue: ${queueErrorMsg || "Redis Queue unavailable"}.`);
  }

  try {
    await withPrismaRetry(() =>
      prisma.tenant.update({ where: { id: tenantId }, data: { uploadCredits: { decrement: 1 } } })
    );
    console.log(`📉 [publish.service] Deducted 1 upload credit from tenant ${tenantId}`);
  } catch (creditErr) {
    console.warn("⚠️ Could not decrement upload credit:", creditErr);
  }

  if (isScheduledRequest) {
    return {
      jobId,
      scheduled: true,
      queued: false,
      platforms: requestedPlatforms,
      scheduledFor: scheduledForRaw,
      delayMs: delay,
      message: `Job successfully scheduled for future publishing at ${new Date(Date.now() + delay).toISOString()}`,
    };
  }

  return {
    jobId,
    scheduled: false,
    queued: true,
    platforms: requestedPlatforms,
    delayMs: delay,
    message: "Publishing job enqueued successfully into background BullMQ queue.",
  };
}
