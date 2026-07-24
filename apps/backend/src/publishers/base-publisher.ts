import { AxiosError } from "axios";

/** Shared Meta Graph API base URL, previously hardcoded identically in both facebook.ts and instagram.ts. */
export const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

/**
 * Shared behavior for every social-platform publisher (Facebook, Instagram,
 * TikTok, YouTube). Absorbs the identical Axios error-handling/logging block
 * that was previously duplicated in each platform file.
 */
export abstract class BasePublisher {
  /** Short prefix used in log lines, e.g. "Facebook", "TikTok". */
  protected abstract readonly logPrefix: string;

  /**
   * Logs an upload/publish failure with a consistent format, unwrapping Axios
   * response bodies when present, then re-throws so the caller (the BullMQ
   * worker) can apply its own retry/backoff policy.
   */
  protected handleUploadError(context: string, error: unknown): never {
    if (this.isAxiosError(error)) {
      const responseData = error.response?.data ? JSON.stringify(error.response.data) : "";
      console.error(`   ❌ ${this.logPrefix} ${context} Error:`, responseData || error.message);
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`   ❌ ${this.logPrefix} ${context} Error:`, err.message);
    throw err;
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return Boolean(error && typeof error === "object" && "isAxiosError" in error && (error as AxiosError).isAxiosError);
  }
}
