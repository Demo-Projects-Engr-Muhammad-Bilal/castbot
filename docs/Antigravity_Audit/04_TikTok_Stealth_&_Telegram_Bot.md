# 04 TikTok Stealth & Telegram Bot Automation Ledger

This document audits the Puppeteer stealth automation engine for **TikTok Video Uploads** and the **Telegram Channel Inbound Webhook Bot** reverse-publishing dispatcher.

---

## 1. Executive Automation & Queue Architecture

### A. TikTok Stealth Browser Engine (`TikTokService`):
- Powered by `puppeteer-extra` and `puppeteer-extra-plugin-stealth`.
- Configurable environment variable `TIKTOK_HEADLESS` (`'T'` / `true` vs `'F'` / `false`).
- Direct DOM file handle injection (`input[type="file"]`) bypassing OS file picker dialogs.
- DraftEditor caption typing (`.public-DraftEditor-content`) and automated confirmation popup buster loop (`"continue"`, `"post anyway"`, `"allow"`, `"got it"`).

### B. Telegram Inbound Channel Bot (`ingestTelegramWebhookUpdate`):
- Webhook endpoint `POST /api/telegram/webhook` receives incoming channel updates.
- Inbound video attachments are downloaded from Telegram CDN servers (`https://api.telegram.org/file/bot<token>/<file_path>`).
- Reverse Auto-Pilot: Enqueues auto-publish jobs across YouTube, Meta Reels, and TikTok automatically upon receiving a video post.

### C. Isolated BullMQ Queue Architecture (`publish.queue.ts`):
- **`publish-video-queue`**: High-concurrency Queue for fast, API-based HTTP publishers (YouTube Data API, Facebook Graph API, Instagram API, Telegram Bot API).
- **`publish-video-tiktok-queue`**: Isolated Queue for resource-heavy Puppeteer stealth browser automation, ensuring slow browser tasks never starve light API concurrency slots.

---

## 2. Paired Interaction Log: TikTok Stealth & Telegram Inbound Bot

### 📥 User Prompt
> "Build the TikTok stealth automation publisher (`TikTokService`) using `puppeteer-extra` with `puppeteer-extra-plugin-stealth`. Inject encrypted session cookies (`sameSite: 'Lax'`), upload videos directly via `input[type="file"]`, type captions into DraftEditor, and handle confirmation popups."

### 📤 AG Response / Output
- **Execution Summary:** Built `TikTokService` extending `BasePublisher`, using Microsoft Edge with custom stealth flags (`--disable-blink-features=AutomationControlled`), cookie injection, file input DOM handle uploading, and network idle safeguards.
- **Files Created/Modified:**
  - [`apps/backend/src/publishers/tiktok.publisher.ts`](file:///E:/telegram_social_uploader/apps/backend/src/publishers/tiktok.publisher.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/publishers/tiktok.publisher.ts
export class TikTokService extends BasePublisher {
  private cookiesJson: string;

  constructor(cookiesJson: string) {
    super();
    this.cookiesJson = decryptToken(cookiesJson);
  }

  async uploadVideo(filePath: string, description: string): Promise<void> {
    const rawCookies = parseTikTokCookies(this.cookiesJson);
    const envVal = (process.env.TIKTOK_HEADLESS || "T").trim().toUpperCase();
    const isHeadless = envVal === "T" || envVal === "TRUE";

    const browser = await puppeteer.launch({
      headless: isHeadless,
      executablePath: getEdgePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080", "--disable-blink-features=AutomationControlled"],
      defaultViewport: { width: 1920, height: 1080 },
    });

    const page = await browser.newPage();
    await page.setCookie(...fixedCookies);
    await page.goto("https://www.tiktok.com/creator-center/upload?lang=en", { waitUntil: "domcontentloaded" });

    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
    if (fileInput) {
      await fileInput.uploadFile(filePath);
    }

    await new Promise((r) => setTimeout(r, 40000)); // Video processing wait

    // Type caption into DraftEditor
    await page.waitForSelector(".public-DraftEditor-content", { timeout: 10000 });
    await page.click(".public-DraftEditor-content");
    await page.keyboard.type(description, { delay: 30 });

    // Click Post & run popup buster loop...
    await page.waitForNetworkIdle({ idleTime: 2000, timeout: 30000 });
    await browser.close();
  }
}
```

---

### 📥 User Prompt
> "Build the Telegram Bot registration and inbound webhook ingestion service (`ingestTelegramWebhookUpdate`) to download video posts sent to a Telegram channel and automatically publish them across YouTube, Meta Reels, and TikTok."

### 📤 AG Response / Output
- **Execution Summary:** Implemented `ingestTelegramWebhookUpdate` resolving workspace tenants from `chat.id` or `?tenantId=`, downloading video streams from Telegram's CDN using `axios.get(..., { responseType: 'stream' })`, creating pending database ledger entries, and enqueuing jobs to BullMQ.
- **Files Created/Modified:**
  - [`apps/backend/src/services/telegram.service.ts`](file:///E:/telegram_social_uploader/apps/backend/src/services/telegram.service.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/services/telegram.service.ts
export async function ingestTelegramWebhookUpdate(update: unknown, tenantIdParam?: string): Promise<WebhookIngestResult> {
  const payload = update as { message?: any; channel_post?: any };
  const message = payload?.message || payload?.channel_post;
  const videoObj = message?.video || (message?.document?.mime_type?.startsWith("video/") ? message.document : null);

  const fileId = videoObj.file_id;
  const caption = message.caption || "Telegram Auto-Pilot Video Upload";

  const connection = await prisma.telegramConnection.findFirst({
    where: { targetChannelId: String(message.chat?.id || "") },
    include: { tenant: true },
  });

  const getFileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${getFileRes.data.result.file_path}`;

  const downloadRes = await axios.get<Readable>(downloadUrl, { responseType: "stream" });
  const fileWriter = fs.createWriteStream(TEMP_VIDEO_PATH);
  downloadRes.data.pipe(fileWriter);
  await finished(fileWriter);

  // Enqueue auto-pilot publish job into BullMQ queues
  await publishQueue.add("publish-video", jobConfig, { jobId: ledgerJobId });
  await tiktokPublishQueue.add("publish-video-tiktok", jobConfig, { jobId: ledgerJobId });

  return { ok: true, status: "queued", message: "Telegram video queued for auto-pilot publishing.", jobId: ledgerJobId };
}
```

---

### 📥 User Prompt
> "Configure separate BullMQ queues for fast API-based publishers versus heavy Puppeteer browser tasks to avoid queue starvation."

### 📤 AG Response / Output
- **Execution Summary:** Configured `publishQueue` (`publish-video-queue`) for API publishers and `tiktokPublishQueue` (`publish-video-tiktok-queue`) for Puppeteer instances, backed by Redis connection parameters and automatic exponential retry backoffs.
- **Files Created/Modified:**
  - [`apps/backend/src/queues/publish.queue.ts`](file:///E:/telegram_social_uploader/apps/backend/src/queues/publish.queue.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/queues/publish.queue.ts
export const PUBLISH_QUEUE_NAME = "publish-video-queue";
export const TIKTOK_PUBLISH_QUEUE_NAME = "publish-video-tiktok-queue";

export const publishQueue = new Queue<PublishJobData>(PUBLISH_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions,
});

export const tiktokPublishQueue = new Queue<PublishJobData>(TIKTOK_PUBLISH_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions,
});
```

---

## 3. Strict Containment & Verification

- Output path: `E:\telegram_social_uploader\docs\Antigravity_Audit\04_TikTok_Stealth_&_Telegram_Bot.md`.
- No files outside `docs/Antigravity_Audit` were created or modified.
