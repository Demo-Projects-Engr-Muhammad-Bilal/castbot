export interface PublisherPayload {
  videoUrl: string;
  caption: string;
  filePath: string;
}

export interface IPublisherService {
  publish(payload: PublisherPayload): Promise<{ status: "SUCCESS" | "FAILED"; id?: string; error?: string }>;
}

export interface JobResult {
  provider: string;
  status: "SUCCESS" | "FAILED";
  id?: string;
  error?: string;
}
