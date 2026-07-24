import axios from "axios";
import { BasePublisher, META_GRAPH_URL } from "./base-publisher";

interface IGContainerResponse {
  id: string;
}

interface IGStatusResponse {
  status_code: string;
  status?: string;
}

interface IGPublishResponse {
  id: string;
}

export class InstagramService extends BasePublisher {
  protected readonly logPrefix = "Instagram";

  private accessToken: string;
  private accountId: string;

  constructor(accessToken: string, accountId: string) {
    super();
    this.accessToken = accessToken;
    this.accountId = accountId;
  }

  async uploadReel(publicVideoUrl: string, description: string): Promise<string> {
    console.log("📸 Starting Instagram Upload via URL...");

    try {
      console.log("   1️⃣ Creating Container...");
      console.log(`      🔗 Using Link: ${publicVideoUrl.substring(0, 50)}...`);

      const createRes = await axios.post<IGContainerResponse>(`${META_GRAPH_URL}/${this.accountId}/media`, {
        access_token: this.accessToken,
        video_url: publicVideoUrl,
        media_type: "REELS",
        caption: description,
      });

      const containerId = createRes.data.id;
      console.log(`      ✅ Container ID: ${containerId}`);

      console.log("   2️⃣ Waiting for Processing...");
      let isReady = false;
      let attempts = 0;

      while (!isReady && attempts < 20) {
        await new Promise((r) => setTimeout(r, 10000));
        attempts++;

        const statusRes = await axios.get<IGStatusResponse>(`${META_GRAPH_URL}/${containerId}`, {
          params: { access_token: this.accessToken, fields: "status_code,status" },
        });

        const status = statusRes.data.status_code;
        console.log(`      ⏳ Check ${attempts}: ${status}`);

        if (status === "FINISHED") {
          isReady = true;
        } else if (status === "ERROR") {
          console.error("      ❌ Detailed Error from Meta:", statusRes.data);
          throw new Error(`Insta Processing Failed: ${JSON.stringify(statusRes.data)}`);
        }
      }

      if (!isReady) throw new Error("Timeout waiting for Instagram processing");

      console.log("   3️⃣ Publishing...");
      const publishRes = await axios.post<IGPublishResponse>(`${META_GRAPH_URL}/${this.accountId}/media_publish`, {
        access_token: this.accessToken,
        creation_id: containerId,
      });

      console.log(`   ✅ Instagram Published! ID: ${publishRes.data.id}`);
      return publishRes.data.id;
    } catch (error: unknown) {
      this.handleUploadError("Upload", error);
    }
  }
}
export default InstagramService;
