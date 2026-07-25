import { Worker, Job } from "bullmq";
import path from "path";
import { redisConnection } from "../config/redis.config";
import {
  PUBLISH_QUEUE_NAME,
  TIKTOK_PUBLISH_QUEUE_NAME,
  PublishJobData,
} from "../queues/publish.queue";
import { prisma, withPrismaRetry } from "../lib/prisma";
import { decryptToken } from "../utils/crypto.util";
import { uploadLocalVideoToCloudinary } from "../lib/cloudinary-uploader";
import {
  upsertPublishTask,
  updatePublishJobStatus,
  getJobTaskCompletionState,
} from "../lib/db-ledger";
import { YouTubeService as YouTubeShortsService } from "../publishers/youtube.publisher";
import { FacebookService as FacebookReelsService } from "../publishers/facebook.publisher";
import { InstagramService as InstagramReelsService } from "../publishers/instagram.publisher";
import { sendVideoToTelegramChannel } from "../services/telegram.service";
import { TikTokService } from "../publishers/tiktok.publisher";
import { PublishStatus, Provider } from "@repo/database";
import fs from "fs";

interface ResultItem {
  provider: string;
  status: "SUCCESS" | "FAILED";
  id?: string;
  error?: string;
}

interface ResolvedAccount {
  id: string;
  provider: Provider;
  accessToken: string;
  refreshToken: string;
  providerAccountId: string;
}

const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");

/** Correlated, structured log line: `[Worker][jobId] message` (or `[Worker] message` without a jobId). */
function log(level: "log" | "warn" | "error", jobId: string | undefined, message: string, ...extra: unknown[]): void {
  const prefix = jobId ? `[Worker][${jobId}]` : "[Worker]";
  // eslint-disable-next-line no-console
  console[level](`${prefix} ${message}`, ...extra);
}

/**
 * Safely decrypts encrypted tokens (IV:AuthTag:EncryptedHex),
 * falling back gracefully to raw string if unencrypted/legacy/mock.
 */
function safeDecryptToken(val?: string | null): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (!trimmed.includes(":")) {
    return trimmed;
  }
  try {
    return decryptToken(trimmed) || trimmed;
  } catch {
    return trimmed;
  }
}

/** Path of the ephemeral per-job config file written by publish.service.ts / telegram.service.ts. */
function getJobConfigPath(jobId: string): string {
  return path.join(SCRIPTS_DIR, `config-${jobId}.json`);
}

/**
 * Deletes the given job artifact paths if they exist. Idempotent and
 * best-effort — safe to call from multiple workers/branches without risk of
 * throwing on an already-removed file.
 */
async function cleanupJobArtifacts(jobId: string, ...filePaths: Array<string | undefined>): Promise<void> {
  for (const filePath of filePaths) {
    if (!filePath) continue;
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        log("log", jobId, `🧹 Removed temp artifact: ${filePath}`);
      }
    } catch (err) {
      log("warn", jobId, `⚠️ Failed to remove temp artifact ${filePath}:`, err);
    }
  }
}

/** Expands raw platform strings (including "META") into the concrete provider keys the worker understands. */
function expandRequestedPlatforms(rawPlatforms: string[] | undefined): string[] {
  const platforms = rawPlatforms && rawPlatforms.length > 0 ? rawPlatforms : ["YOUTUBE", "FACEBOOK", "INSTAGRAM", "TIKTOK"];
  return platforms.flatMap((p) => {
    const pUpper = String(p).toUpperCase();
    if (pUpper === "META") return ["FACEBOOK", "INSTAGRAM"];
    return [pUpper];
  });
}

/**
 * Resolves the effective account credentials for a single provider: prefers
 * the decrypted DB-backed SocialAccount row, falling back to environment
 * credentials and a deterministic mock identity when neither is available.
 * Replaces the four near-identical YT/FB/IG/TT resolution blocks that used
 * to be duplicated inline in processPublishJob.
 */
function resolveAccount(
  accounts: ResolvedAccount[],
  provider: Provider,
  envAccessTokenVar: string | undefined,
  envRefreshTokenVar: string | undefined,
  mockPrefix: string,
  opts: { envAccountIdVar?: string; mockAccountIdSuffix?: string } = {}
): ResolvedAccount {
  const raw = accounts.find((acc) => acc.provider === provider);
  const fallbackAccessToken = envAccessTokenVar ? process.env[envAccessTokenVar] : undefined;
  const fallbackRefreshToken = envRefreshTokenVar ? process.env[envRefreshTokenVar] : undefined;
  const fallbackAccountId =
    (opts.envAccountIdVar ? process.env[opts.envAccountIdVar] : undefined) ||
    `mock-${mockPrefix}-${opts.mockAccountIdSuffix || "account"}`;

  return {
    id: raw?.id || `mock-${mockPrefix}-id`,
    provider,
    accessToken: safeDecryptToken(raw?.accessToken || fallbackAccessToken),
    refreshToken: safeDecryptToken(raw?.refreshToken || fallbackRefreshToken),
    providerAccountId: raw?.providerAccountId || fallbackAccountId,
  };
}

/**
 * Fetches + decrypts every SocialAccount row for the tenant, tolerating DB
 * unavailability (falls back to an empty list so callers can still fall back
 * to environment credentials).
 */
async function fetchDecryptedAccounts(jobId: string, tenantId?: string, tenantSlug?: string): Promise<ResolvedAccount[]> {
  try {
    const tenant = await withPrismaRetry(() =>
      prisma.tenant.findFirst({
        where: tenantId ? { id: tenantId } : { slug: tenantSlug },
        include: { socialAccounts: true },
      })
    );

    if (tenant?.socialAccounts) {
      return tenant.socialAccounts.map((acc) => ({
        ...acc,
        accessToken: safeDecryptToken(acc.accessToken),
        refreshToken: safeDecryptToken(acc.refreshToken),
      })) as unknown as ResolvedAccount[];
    }
    return [];
  } catch (dbErr) {
    log("warn", jobId, "⚠️ Database account lookup failed due to network/VPN timeout. Falling back to environment credential context...", dbErr);
    return [];
  }
}

function buildCaptionResolver(captionData: PublishJobData["captionData"], caption?: string) {
  return (platformKey: "youtube" | "facebook" | "instagram" | "tiktok" | "telegram"): string => {
    if (captionData?.isCustom && (captionData as any)[platformKey] && (captionData as any)[platformKey]!.trim()) {
      return (captionData as any)[platformKey]!;
    }
    return captionData?.global || caption || "CastBot Automated Video Publish";
  };
}

const safeUpsertTask = async (
  jobId: string,
  ledgerJobId: string,
  platform: Provider,
  status: PublishStatus,
  externalId?: string,
  errorLog?: string,
  socialAccountId?: string,
  telegramConnectionId?: string
) => {
  try {
    await upsertPublishTask(ledgerJobId, platform, status, externalId, errorLog, socialAccountId, telegramConnectionId);
  } catch (err) {
    log("warn", jobId, `⚠️ Could not log platform task status [${platform}]:`, err);
  }
};

/**
 * Once a branch (light or TikTok) finishes its own share of the platforms,
 * decide whether it's safe to write the parent PublishJob's final overall
 * status and delete the shared temp video/config files.
 *
 * - If this job never spanned both queues (e.g. TikTok-only, or no TikTok at
 *   all), this branch is the sole owner: finalize + clean up immediately.
 * - If the job spans both queues, only finalize + clean up once every
 *   PublishTask child (across both branches) has reached a terminal state,
 *   so we never delete a video file the sibling queue's worker still needs.
 */
async function finalizeIfReady(
  jobId: string,
  ledgerJobId: string,
  branchHasFailures: boolean,
  spansBothQueues: boolean,
  videoPath: string,
  configPath: string
): Promise<void> {
  if (!spansBothQueues) {
    try {
      await updatePublishJobStatus(ledgerJobId, branchHasFailures ? PublishStatus.FAILED : PublishStatus.COMPLETED);
    } catch (statusErr) {
      log("warn", jobId, "⚠️ Could not update final PublishJob status in database:", statusErr);
    }
    await cleanupJobArtifacts(jobId, videoPath, configPath);
    return;
  }

  try {
    const { allTerminal, hasFailures } = await getJobTaskCompletionState(ledgerJobId);
    if (allTerminal) {
      await updatePublishJobStatus(ledgerJobId, hasFailures ? PublishStatus.FAILED : PublishStatus.COMPLETED);
      await cleanupJobArtifacts(jobId, videoPath, configPath);
    } else {
      log("log", jobId, "⏳ Sibling queue still processing other platforms — deferring final status + cleanup.");
    }
  } catch (err) {
    log("warn", jobId, "⚠️ Could not determine cross-queue job completion state, falling back to this branch's own result:", err);
    try {
      await updatePublishJobStatus(ledgerJobId, branchHasFailures ? PublishStatus.FAILED : PublishStatus.COMPLETED);
    } catch (statusErr) {
      log("warn", jobId, "⚠️ Could not update final PublishJob status in database:", statusErr);
    }
  }
}

/**
 * Handles the light, API-based publishers: YouTube, Instagram, Facebook.
 * Runs on the high-concurrency `publish-video-queue`.
 */
export async function processLightPublishJob(job: Job<PublishJobData>): Promise<unknown> {
  const { jobId, tenantId, tenantSlug, videoPath, captionData, caption, platforms } = job.data;
  const configPath = getJobConfigPath(jobId);
  const requestedPlatforms = expandRequestedPlatforms(platforms);
  const spansBothQueues = requestedPlatforms.includes("TIKTOK") && requestedPlatforms.some((p) => p !== "TIKTOK");

  log("log", jobId, `🔨 Processing LIGHT publish job for tenant: ${tenantId || tenantSlug}. Target platforms:`, requestedPlatforms);

  const getCaptionForPlatform = buildCaptionResolver(captionData, caption);
  let branchFailed = false;
  let hasFailures = false;

  try {
    const accounts = await fetchDecryptedAccounts(jobId, tenantId, tenantSlug);

    const ytAccount = resolveAccount(accounts, Provider.YOUTUBE, "GOOGLE_ACCESS_TOKEN", "GOOGLE_REFRESH_TOKEN", "yt", {
      mockAccountIdSuffix: "channel",
    });
    const fbAccount = resolveAccount(accounts, Provider.FACEBOOK, "FACEBOOK_ACCESS_TOKEN", undefined, "fb", {
      envAccountIdVar: "FACEBOOK_PAGE_ID",
      mockAccountIdSuffix: "page",
    });
    const igAccount = resolveAccount(accounts, Provider.INSTAGRAM, "INSTAGRAM_ACCESS_TOKEN", undefined, "ig", {
      envAccountIdVar: "INSTAGRAM_ACCOUNT_ID",
      mockAccountIdSuffix: "account",
    });

    let secureUrl = "";
    if (requestedPlatforms.includes("INSTAGRAM")) {
      log("log", jobId, "☁️ Uploading video to Cloudinary (required for Instagram)...");
      try {
        secureUrl = await uploadLocalVideoToCloudinary(videoPath);
        log("log", jobId, `✅ Cloudinary upload success: ${secureUrl}`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log("error", jobId, `❌ Cloudinary upload failed: ${errMsg}`);
        throw err;
      }
    }

    log("log", jobId, "📝 Updating PublishJob in database ledger...");
    try {
      const existingJob = await withPrismaRetry(() => prisma.publishJob.findUnique({ where: { id: jobId } }));
      if (existingJob) {
        await withPrismaRetry(() =>
          prisma.publishJob.update({
            where: { id: jobId },
            data: {
              videoUrl: secureUrl || existingJob.videoUrl,
              caption: getCaptionForPlatform("youtube"),
              status: PublishStatus.PROCESSING,
            },
          })
        );
      }
    } catch (dbUpdateErr) {
      log("warn", jobId, "⚠️ Ledger update skipped due to DB network timeout. Proceeding with video execution...", dbUpdateErr);
    }

    const results: ResultItem[] = [];

    // YouTube Shorts
    if (requestedPlatforms.includes("YOUTUBE")) {
      const captionText = getCaptionForPlatform("youtube");
      await safeUpsertTask(jobId, jobId, Provider.YOUTUBE, PublishStatus.PROCESSING, undefined, undefined, ytAccount.id);

      const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
      const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
      const refreshToken = safeDecryptToken(ytAccount.refreshToken || ytAccount.accessToken);

      if (googleClientId && googleClientSecret && refreshToken) {
        try {
          log("log", jobId, "📺 Dispatching YouTube Shorts publisher with decrypted OAuth refresh token...");
          const ytService = new YouTubeShortsService(googleClientId, googleClientSecret, refreshToken);
          const ytVideoId = await ytService.uploadVideo(videoPath, {
            title: captionText.substring(0, 95) || "CastBot Short",
            description: captionText,
          });
          await safeUpsertTask(jobId, jobId, Provider.YOUTUBE, PublishStatus.COMPLETED, ytVideoId, undefined, ytAccount.id);
          results.push({ provider: "YOUTUBE", status: "SUCCESS", id: ytVideoId });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await safeUpsertTask(jobId, jobId, Provider.YOUTUBE, PublishStatus.FAILED, undefined, errMsg, ytAccount.id);
          results.push({ provider: "YOUTUBE", status: "FAILED", error: errMsg });
        }
      } else {
        const errMsg = "Missing Google OAuth credentials";
        await safeUpsertTask(jobId, jobId, Provider.YOUTUBE, PublishStatus.FAILED, undefined, errMsg, ytAccount.id);
        results.push({ provider: "YOUTUBE", status: "FAILED", error: errMsg });
      }
    }

    // Instagram Reels
    if (requestedPlatforms.includes("INSTAGRAM")) {
      const captionText = getCaptionForPlatform("instagram");
      await safeUpsertTask(jobId, jobId, Provider.INSTAGRAM, PublishStatus.PROCESSING, undefined, undefined, igAccount.id);

      const accessToken = safeDecryptToken(igAccount.accessToken);
      const accountId = igAccount.providerAccountId;
      if (accessToken && accountId) {
        try {
          log("log", jobId, "📸 Dispatching Instagram Reels publisher with decrypted access token...");
          const igService = new InstagramReelsService(accessToken, accountId);
          const igMediaId = await igService.uploadReel(secureUrl, captionText);
          await safeUpsertTask(jobId, jobId, Provider.INSTAGRAM, PublishStatus.COMPLETED, igMediaId, undefined, igAccount.id);
          results.push({ provider: "INSTAGRAM", status: "SUCCESS", id: igMediaId });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await safeUpsertTask(jobId, jobId, Provider.INSTAGRAM, PublishStatus.FAILED, undefined, errMsg, igAccount.id);
          results.push({ provider: "INSTAGRAM", status: "FAILED", error: errMsg });
        }
      } else {
        const errMsg = "Instagram credentials missing";
        await safeUpsertTask(jobId, jobId, Provider.INSTAGRAM, PublishStatus.FAILED, undefined, errMsg, igAccount.id);
        results.push({ provider: "INSTAGRAM", status: "FAILED", error: errMsg });
      }
    }

    // Facebook Reels
    if (requestedPlatforms.includes("FACEBOOK")) {
      const captionText = getCaptionForPlatform("facebook");
      await safeUpsertTask(jobId, jobId, Provider.FACEBOOK, PublishStatus.PROCESSING, undefined, undefined, fbAccount.id);

      const accessToken = safeDecryptToken(fbAccount.accessToken);
      const pageId = fbAccount.providerAccountId;
      if (accessToken && pageId) {
        try {
          log("log", jobId, "📘 Dispatching Facebook Reels publisher with decrypted access token...");
          const fbService = new FacebookReelsService(accessToken, pageId);
          const fbVideoId = await fbService.uploadReel(videoPath, captionText);
          await safeUpsertTask(jobId, jobId, Provider.FACEBOOK, PublishStatus.COMPLETED, fbVideoId, undefined, fbAccount.id);
          results.push({ provider: "FACEBOOK", status: "SUCCESS", id: fbVideoId });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await safeUpsertTask(jobId, jobId, Provider.FACEBOOK, PublishStatus.FAILED, undefined, errMsg, fbAccount.id);
          results.push({ provider: "FACEBOOK", status: "FAILED", error: errMsg });
        }
      } else {
        const errMsg = "Facebook credentials missing";
        await safeUpsertTask(jobId, jobId, Provider.FACEBOOK, PublishStatus.FAILED, undefined, errMsg, fbAccount.id);
        results.push({ provider: "FACEBOOK", status: "FAILED", error: errMsg });
      }
    }

    if (requestedPlatforms.includes("TELEGRAM")) {
      const captionText = getCaptionForPlatform("telegram");
      await safeUpsertTask(jobId, jobId, Provider.TELEGRAM, PublishStatus.PROCESSING);

      try {
        log("log", jobId, "📨 Dispatching Telegram publisher...");
        const tgResult = await sendVideoToTelegramChannel({
          tenantId: tenantId!,
          videoPath,
          caption: captionText,
        });
        await safeUpsertTask(
          jobId, jobId, Provider.TELEGRAM, PublishStatus.COMPLETED,
          tgResult.telegramMessageId, undefined, undefined, tgResult.telegramConnectionId
        );
        results.push({ provider: "TELEGRAM", status: "SUCCESS", id: tgResult.telegramMessageId });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await safeUpsertTask(jobId, jobId, Provider.TELEGRAM, PublishStatus.FAILED, undefined, errMsg);
        results.push({ provider: "TELEGRAM", status: "FAILED", error: errMsg });
      }
    }

    hasFailures = results.some((r) => r.status === "FAILED");
    return { success: !hasFailures, secureUrl, results };
  } catch (err) {
    branchFailed = true;
    hasFailures = true;
    // CRITICAL: guarantee the ledger never sticks in PENDING/PROCESSING even
    // when this branch fails early (e.g. Cloudinary unreachable) or BullMQ's
    // retry budget is about to be exhausted.
    try {
      await updatePublishJobStatus(jobId, PublishStatus.FAILED);
    } catch (statusErr) {
      log("warn", jobId, "⚠️ Could not mark PublishJob FAILED after early error:", statusErr);
    }
    throw err;
  } finally {
    if (branchFailed) {
      // The job is already considered failed — clean up immediately rather
      // than waiting on a sibling TikTok-queue branch that may never finish.
      await cleanupJobArtifacts(jobId, videoPath, configPath);
    } else {
      await finalizeIfReady(jobId, jobId, hasFailures, spansBothQueues, videoPath, configPath);
    }
  }
}

/**
 * Handles the heavy, Puppeteer-driven TikTok publisher in isolation. Runs on
 * the low-concurrency `publish-video-tiktok-queue` so a handful of slow
 * browser sessions never starve the light API-based publishers.
 */
export async function processTikTokPublishJob(job: Job<PublishJobData>): Promise<unknown> {
  const { jobId, tenantId, tenantSlug, videoPath, captionData, caption, platforms } = job.data;
  const configPath = getJobConfigPath(jobId);
  const requestedPlatforms = expandRequestedPlatforms(platforms);
  const spansBothQueues = requestedPlatforms.includes("TIKTOK") && requestedPlatforms.some((p) => p !== "TIKTOK");

  log("log", jobId, `🔨 Processing TIKTOK publish job for tenant: ${tenantId || tenantSlug}.`);

  const getCaptionForPlatform = buildCaptionResolver(captionData, caption);
  let branchFailed = false;
  let hasFailures = false;

  try {
    if (!requestedPlatforms.includes("TIKTOK")) {
      // Defensive no-op: this job was never meant to land on the TikTok queue.
      return { success: true, results: [] as ResultItem[] };
    }

    const accounts = await fetchDecryptedAccounts(jobId, tenantId, tenantSlug);
    const ttAccount = resolveAccount(accounts, Provider.TIKTOK, "TIKTOK_COOKIES", "TIKTOK_COOKIES", "tt", {
      mockAccountIdSuffix: "user",
    });

    const results: ResultItem[] = [];
    const captionText = getCaptionForPlatform("tiktok");
    await safeUpsertTask(jobId, jobId, Provider.TIKTOK, PublishStatus.PROCESSING, undefined, undefined, ttAccount.id);

    // The worker decrypts once here; TikTokService now expects an
    // already-decrypted cookie string and must NOT decrypt it again itself.
    const cookiesJson = safeDecryptToken(ttAccount.refreshToken || ttAccount.accessToken);
    if (cookiesJson) {
      try {
        log("log", jobId, "🎵 Dispatching TikTok publisher with decrypted session cookies...");
        const ttService = new TikTokService(cookiesJson);
        await ttService.uploadVideo(videoPath, captionText);
        await safeUpsertTask(jobId, jobId, Provider.TIKTOK, PublishStatus.COMPLETED, undefined, undefined, ttAccount.id);
        results.push({ provider: "TIKTOK", status: "SUCCESS" });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await safeUpsertTask(jobId, jobId, Provider.TIKTOK, PublishStatus.FAILED, undefined, errMsg, ttAccount.id);
        results.push({ provider: "TIKTOK", status: "FAILED", error: errMsg });
      }
    } else {
      const errMsg = "TikTok session cookies missing";
      await safeUpsertTask(jobId, jobId, Provider.TIKTOK, PublishStatus.FAILED, undefined, errMsg, ttAccount.id);
      results.push({ provider: "TIKTOK", status: "FAILED", error: errMsg });
    }

    hasFailures = results.some((r) => r.status === "FAILED");
    return { success: !hasFailures, results };
  } catch (err) {
    branchFailed = true;
    hasFailures = true;
    try {
      await updatePublishJobStatus(jobId, PublishStatus.FAILED);
    } catch (statusErr) {
      log("warn", jobId, "⚠️ Could not mark PublishJob FAILED after early error:", statusErr);
    }
    throw err;
  } finally {
    if (branchFailed) {
      await cleanupJobArtifacts(jobId, videoPath, configPath);
    } else {
      await finalizeIfReady(jobId, jobId, hasFailures, spansBothQueues, videoPath, configPath);
    }
  }
}

export const publishWorker = new Worker<PublishJobData>(PUBLISH_QUEUE_NAME, processLightPublishJob, {
  connection: redisConnection,
  concurrency: 5,
});

export const tiktokPublishWorker = new Worker<PublishJobData>(TIKTOK_PUBLISH_QUEUE_NAME, processTikTokPublishJob, {
  connection: redisConnection,
  concurrency: 2,
});

log("log", undefined, `⚙️ BullMQ workers listening: ${PUBLISH_QUEUE_NAME} (concurrency 5), ${TIKTOK_PUBLISH_QUEUE_NAME} (concurrency 2)...`);

publishWorker.on("active", (job) => {
  log("log", job.id, `🚀 [publish-video-queue] Picked up job for tenant ${job.data.tenantId || job.data.tenantSlug}!`);
});
publishWorker.on("completed", (job) => {
  log("log", job.id, "✅ [publish-video-queue] Job completed successfully.");
});
publishWorker.on("failed", async (job, err) => {
  log("error", job?.id, `❌ [publish-video-queue] Job failed with error: ${err ? err.message : "Unknown error"}`);
  // Safety net (item 2): if retries are exhausted, guarantee the ledger
  // reflects FAILED rather than staying stuck in PENDING/PROCESSING even if
  // the in-process catch block above didn't get a chance to run.
  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    try {
      await updatePublishJobStatus(job.data.jobId, PublishStatus.FAILED);
    } catch (statusErr) {
      log("warn", job.id, "⚠️ Could not update PublishJob status after exhausted retries:", statusErr);
    }
    await cleanupJobArtifacts(job.data.jobId, job.data.videoPath, getJobConfigPath(job.data.jobId));
  }
});

tiktokPublishWorker.on("active", (job) => {
  log("log", job.id, `🚀 [publish-video-tiktok-queue] Picked up job for tenant ${job.data.tenantId || job.data.tenantSlug}!`);
});
tiktokPublishWorker.on("completed", (job) => {
  log("log", job.id, "✅ [publish-video-tiktok-queue] Job completed successfully.");
});
tiktokPublishWorker.on("failed", async (job, err) => {
  log("error", job?.id, `❌ [publish-video-tiktok-queue] Job failed with error: ${err ? err.message : "Unknown error"}`);
  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    try {
      await updatePublishJobStatus(job.data.jobId, PublishStatus.FAILED);
    } catch (statusErr) {
      log("warn", job.id, "⚠️ Could not update PublishJob status after exhausted retries:", statusErr);
    }
    await cleanupJobArtifacts(job.data.jobId, job.data.videoPath, getJobConfigPath(job.data.jobId));
  }
});
