import axios from "axios";
import fs from "fs";
import { BasePublisher, META_GRAPH_URL } from "./base-publisher";

interface FBInitResponse {
  video_id: string;
  upload_url: string;
}

export class FacebookService extends BasePublisher {
  protected readonly logPrefix = "Facebook";

  private accessToken: string;
  private pageId: string;

  constructor(accessToken: string, pageId: string) {
    super();
    this.accessToken = accessToken;
    this.pageId = pageId;
  }

  async uploadReel(filePath: string, description: string): Promise<string> {
    console.log("📘 Starting Facebook Upload (Local File)...");

    try {
      // 1. Initialization Phase
      const initRes = await axios.post<FBInitResponse>(`${META_GRAPH_URL}/${this.pageId}/video_reels`, {
        upload_phase: "start",
        access_token: this.accessToken,
      });
      const { video_id, upload_url } = initRes.data;
      console.log(`   ✅ FB Video ID: ${video_id}`);

      // 2. Upload Phase (Streaming bytes)
      const fileSize = fs.statSync(filePath).size;
      const fileStream = fs.createReadStream(filePath);
      await axios.post(upload_url, fileStream, {
        headers: {
          Authorization: `OAuth ${this.accessToken}`,
          offset: "0",
          file_size: fileSize.toString(),
          "Content-Type": "application/octet-stream",
          "Content-Length": fileSize.toString(),
        },
      });

      // 3. Publish Phase
      await axios.post(`${META_GRAPH_URL}/${this.pageId}/video_reels`, {
        upload_phase: "finish",
        access_token: this.accessToken,
        video_id: video_id,
        video_state: "PUBLISHED",
        description: description,
      });

      console.log(`   ✅ Facebook Uploaded successfully!`);
      return video_id;
    } catch (error: unknown) {
      this.handleUploadError("Upload", error);
    }
  }

}
export default FacebookService;
