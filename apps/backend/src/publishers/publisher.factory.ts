import { Provider } from "@repo/database";
import { FacebookService } from "./facebook.publisher";
import { InstagramService } from "./instagram.publisher";
import { TikTokService } from "./tiktok.publisher";
import { YouTubeService } from "./youtube.publisher";

export type AnyPublisher = FacebookService | InstagramService | TikTokService | YouTubeService;

export interface PublisherCredentials {
  accessToken?: string;
  pageOrAccountId?: string;
  cookiesJson?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

/**
 * Replaces scattered `if (provider === "TIKTOK") { ... }`-style branching at
 * call sites with a single factory. Each provider still needs slightly
 * different credential shapes, so the caller passes whichever fields its
 * target provider needs — unused fields are ignored.
 */
export function getPublisher(provider: Provider, credentials: PublisherCredentials): AnyPublisher {
  switch (provider) {
    case Provider.FACEBOOK:
      return new FacebookService(credentials.accessToken || "", credentials.pageOrAccountId || "");
    case Provider.INSTAGRAM:
      return new InstagramService(credentials.accessToken || "", credentials.pageOrAccountId || "");
    case Provider.TIKTOK:
      return new TikTokService(credentials.cookiesJson || "");
    case Provider.YOUTUBE:
      return new YouTubeService(credentials.clientId || "", credentials.clientSecret || "", credentials.refreshToken || "");
    default:
      throw new Error(`No publisher implementation available for provider: ${provider}`);
  }
}
