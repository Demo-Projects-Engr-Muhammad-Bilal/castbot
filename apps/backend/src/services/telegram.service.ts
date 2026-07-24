import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { prisma, ensurePrismaConnected, withPrismaRetry } from "../lib/prisma";
import { createPendingPublishJob } from "../lib/db-ledger";
import { publishQueue, tiktokPublishQueue, PublishJobData } from "../queues/publish.queue";
import { encryptToken, decryptToken } from "../utils/crypto.util";
import { Provider } from "@repo/database";
import { ValidationError } from "../errors/app-error";

const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");

export interface RegisterBotInput {
  tenantId: string;
  botToken?: string;
  targetChannelId?: string;
  webhookBaseUrl?: string;
  requestHeaders: Record<string, unknown>;
}

export interface RegisterBotResult {
  connectionId: string;
  botUsername: string;
  targetChannelId: string;
  webhookSet: boolean;
  webhookUrl: string;
}

/** Validates a bot token against Telegram, persists the encrypted connection, and configures the webhook. */
export async function registerTelegramBot(input: RegisterBotInput): Promise<RegisterBotResult> {
  const { tenantId, botToken, targetChannelId, webhookBaseUrl, requestHeaders } = input;

  if (!botToken || !targetChannelId) {
    throw new ValidationError("Missing required fields: botToken and targetChannelId are required.");
  }

  console.log("🔍 [telegram.service] Validating bot token with Telegram getMe API...");
  const getMeUrl = `https://api.telegram.org/bot${botToken}/getMe`;
  let getMeRes;
  try {
    getMeRes = await axios.get(getMeUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ValidationError(`Invalid Telegram Bot Token: ${msg}`);
  }

  if (!getMeRes.data?.ok || !getMeRes.data?.result) {
    throw new ValidationError("Failed to validate Telegram bot token with Bot API.");
  }

  const botUsername = getMeRes.data.result.username || "TelegramBot";
  const encryptedToken = encryptToken(botToken);

  const connection = await prisma.telegramConnection.upsert({
    where: { tenantId_targetChannelId: { tenantId, targetChannelId: String(targetChannelId) } },
    update: { botToken: encryptedToken, isActive: true },
    create: { tenantId, targetChannelId: String(targetChannelId), botToken: encryptedToken, isActive: true },
  });

  let baseUrl = webhookBaseUrl || process.env.WEBHOOK_URL || process.env.PUBLIC_WEBHOOK_URL;

  if (!baseUrl) {
    const proto = (requestHeaders["x-forwarded-proto"] as string) || "https";
    const host = (requestHeaders["x-forwarded-host"] as string) || (requestHeaders["host"] as string) || "localhost:5000";
    baseUrl = `${proto}://${host}`;
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook?tenantId=${tenantId}`;

  console.log(`🔗 [telegram.service] Configuring Webhook URL: ${webhookUrl}`);
  const setWebhookUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

  let webhookSet = false;
  try {
    const webhookRes = await axios.get(setWebhookUrl);
    webhookSet = Boolean(webhookRes.data?.ok);
    console.log("✅ [telegram.service] Webhook configuration result:", webhookRes.data);
  } catch (whErr) {
    console.warn("⚠️ [telegram.service] Webhook auto-configuration warning:", whErr);
  }

  return {
    connectionId: connection.id,
    botUsername,
    targetChannelId: String(targetChannelId),
    webhookSet,
    webhookUrl,
  };
}

export interface WebhookIngestResult {
  ok: boolean;
  status: "ignored" | "unauthorized" | "warning" | "error" | "queued";
  message: string;
  jobId?: string;
  tenantId?: string;
  caption?: string;
  chatId?: string;
}

/**
 * Ingests a Telegram webhook update: resolves the tenant from the inbound chat id
 * (or an explicit ?tenantId= param), downloads any attached video, and enqueues
 * an auto-pilot publish job scoped to that tenant.
 *
 * NOTE: intentionally does not throw — the webhook always replies 200 to Telegram's
 * servers, using the `status` field to communicate the outcome.
 */
export async function ingestTelegramWebhookUpdate(update: unknown, tenantIdParam?: string): Promise<WebhookIngestResult> {
  try {
    await ensurePrismaConnected();
  } catch (prismaConnErr) {
    console.warn("⚠️ [telegram.service] Pre-flight Prisma connection check produced warning:", prismaConnErr);
  }

  console.log("📩 [telegram.service] Received update payload:", JSON.stringify(update || {}).slice(0, 200));

  const payload = update as { message?: any; channel_post?: any };
  const message = payload?.message || payload?.channel_post;

  if (!message) {
    return { ok: true, status: "ignored", message: "Ignored non-message update" };
  }

  const videoObj = message.video || (message.document?.mime_type?.startsWith("video/") ? message.document : null);

  if (!videoObj || !videoObj.file_id) {
    console.log("ℹ️ [telegram.service] Message received without video attachment. Ignored.");
    return { ok: true, status: "ignored", message: "No video attachment found" };
  }

  const fileId = videoObj.file_id;
  const caption = message.caption || "Telegram Auto-Pilot Video Upload";
  const chatIdStr = String(message.chat?.id || "");

  let connection = null;

  if (chatIdStr) {
    try {
      connection = await withPrismaRetry(() =>
        prisma.telegramConnection.findFirst({ where: { targetChannelId: chatIdStr }, include: { tenant: true } })
      );
    } catch (dbErr) {
      console.warn("⚠️ [telegram.service] DB lookup for targetChannelId failed:", dbErr);
    }
  }

  if (!connection && tenantIdParam) {
    try {
      connection = await withPrismaRetry(() =>
        prisma.telegramConnection.findFirst({ where: { tenantId: tenantIdParam }, include: { tenant: true } })
      );
    } catch (dbErr) {
      console.warn("⚠️ [telegram.service] DB lookup for tenantIdParam failed:", dbErr);
    }
  }

  if (!connection || !connection.tenant) {
    console.warn(`🔒 [telegram.service] Unauthorized or unregistered Telegram Chat ID: ${chatIdStr} (Tenant Param: ${tenantIdParam || "none"})`);
    return { ok: false, status: "unauthorized", message: `Unauthorized or unregistered Telegram Chat ID: ${chatIdStr}` };
  }

  const tenantId = connection.tenant.id;
  const tenantSlug = connection.tenant.slug;

  const botToken = decryptToken(connection.botToken) || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || botToken === "your_telegram_bot_token_here") {
    console.warn("⚠️ [telegram.service] TELEGRAM_BOT_TOKEN missing in connection record!");
    return { ok: true, status: "warning", message: "TELEGRAM_BOT_TOKEN unconfigured in connection." };
  }

  console.log(`🔍 [telegram.service] Resolving file path for file_id: ${fileId}...`);
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  let getFileRes;
  try {
    getFileRes = await axios.get(getFileUrl);
  } catch (axiosErr: unknown) {
    const errMsg = axiosErr instanceof Error ? axiosErr.message : String(axiosErr);
    console.error("❌ [telegram.service] Telegram getFile API request failed:", errMsg);
    return { ok: true, status: "error", message: `Telegram getFile API failed: ${errMsg}` };
  }

  if (!getFileRes.data?.ok || !getFileRes.data?.result?.file_path) {
    return { ok: true, status: "error", message: "Failed to resolve file path from Telegram API." };
  }

  const filePath = getFileRes.data.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }

  const fallbackJobId = crypto.randomUUID();
  const TEMP_VIDEO_PATH = path.join(SCRIPTS_DIR, `temp-tg-${fallbackJobId}.mp4`);
  const TEMP_CONFIG_PATH = path.join(SCRIPTS_DIR, `config-${fallbackJobId}.json`);

  console.log(`📥 [telegram.service] Downloading video asset from Telegram CDN for tenant ${tenantSlug}...`);
  try {
    const downloadRes = await axios.get<Readable>(downloadUrl, { responseType: "stream" });
    const fileWriter = fs.createWriteStream(TEMP_VIDEO_PATH);
    downloadRes.data.pipe(fileWriter);
    await finished(fileWriter);
    console.log(`✅ [telegram.service] Saved video asset to: ${TEMP_VIDEO_PATH}`);
  } catch (dlErr: unknown) {
    const errMsg = dlErr instanceof Error ? dlErr.message : String(dlErr);
    console.error("❌ [telegram.service] Video download from Telegram CDN failed:", errMsg);
    return { ok: true, status: "error", message: `Video download failed: ${errMsg}` };
  }

  const targetPlatforms: Provider[] = [Provider.YOUTUBE, Provider.INSTAGRAM, Provider.FACEBOOK, Provider.TIKTOK];

  let ledgerJobId: string = fallbackJobId;
  try {
    const parentJob = await withPrismaRetry(() => createPendingPublishJob(tenantId, "", caption, targetPlatforms));
    ledgerJobId = parentJob.id;
  } catch (ledgerErr) {
    console.warn("⚠️ [telegram.service] Database ledger entry creation skipped due to DB connectivity error:", ledgerErr);
  }

  const jobConfig: PublishJobData = {
    jobId: ledgerJobId,
    tenantId,
    tenantSlug,
    videoPath: TEMP_VIDEO_PATH,
    captionData: { global: caption, isCustom: false },
    caption,
    platforms: targetPlatforms,
    telegramChatId: chatIdStr,
  };

  await fs.promises.writeFile(TEMP_CONFIG_PATH, JSON.stringify(jobConfig, null, 2), "utf-8");

  console.log(`📥 [telegram.service] Enqueuing auto-pilot job ${ledgerJobId} for tenant ${tenantId} into BullMQ...`);
  const hasTikTok = targetPlatforms.includes(Provider.TIKTOK);
  const hasNonTikTok = targetPlatforms.some((p) => p !== Provider.TIKTOK);
  try {
    // Same isolation as publish.service.ts: light API publishers go through
    // publish-video-queue, heavy Puppeteer TikTok work through its own queue.
    if (hasNonTikTok) {
      await publishQueue.add("publish-video", jobConfig, { jobId: ledgerJobId });
    }
    if (hasTikTok) {
      await tiktokPublishQueue.add("publish-video-tiktok", jobConfig, { jobId: ledgerJobId });
    }
  } catch (queueErr) {
    console.warn("⚠️ [telegram.service] BullMQ queue enqueue warning:", queueErr);
  }

  return {
    ok: true,
    status: "queued",
    message: "Telegram video received, ingested, and queued for auto-pilot publishing.",
    jobId: ledgerJobId,
    tenantId,
    caption,
    chatId: chatIdStr,
  };
}
