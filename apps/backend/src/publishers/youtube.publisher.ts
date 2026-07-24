import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import { BasePublisher } from "./base-publisher";

export interface YouTubeUploadMetadata {
  title: string;
  description: string;
  tags?: string[];
}

export class YouTubeService extends BasePublisher {
  protected readonly logPrefix = "YouTube";

  private oauth2Client: OAuth2Client;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    super();
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret) as unknown as OAuth2Client;
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
  }

  public getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  async uploadVideo(filePath: string, metadata: YouTubeUploadMetadata): Promise<string> {
    console.log("📺 Starting YouTube Upload...");
    const authClient = this.oauth2Client as unknown as InstanceType<typeof google.auth.OAuth2>;
    const youtube = google.youtube({ version: "v3", auth: authClient });

    try {
      const res = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags || [],
            categoryId: "24", // Entertainment category ID
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
      });

      const videoId = res.data.id;
      if (!videoId) {
        throw new Error("YouTube API returned empty video ID");
      }

      console.log(`   ✅ YouTube Upload Success! ID: ${videoId}`);
      return videoId;
    } catch (error: unknown) {
      this.handleUploadError("Upload", error);
    }
  }
}
export default YouTubeService;
