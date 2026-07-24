import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.config";

export const PUBLISH_QUEUE_NAME = "publish-video-queue";
export const TIKTOK_PUBLISH_QUEUE_NAME = "publish-video-tiktok-queue";

export interface PublishJobData {
  jobId: string;
  tenantId?: string;
  userId?: string;
  tenantSlug: string;
  videoPath: string;
  captionData?: {
    global: string;
    youtube?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    isCustom?: boolean;
  };
  caption?: string;
  platforms: string[];
  telegramChatId?: string;
}

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 500,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
};

/** Light, API-based publishers (YouTube, Facebook, Instagram, Telegram fan-out). High concurrency is safe here. */
export const publishQueue = new Queue<PublishJobData>(PUBLISH_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions,
});

/**
 * Isolated queue for heavy Puppeteer-driven TikTok uploads. Kept separate
 * from `publishQueue` so a handful of slow, browser-heavy TikTok jobs can't
 * starve the concurrency slots that the fast API-based publishers rely on.
 */
export const tiktokPublishQueue = new Queue<PublishJobData>(TIKTOK_PUBLISH_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions,
});
