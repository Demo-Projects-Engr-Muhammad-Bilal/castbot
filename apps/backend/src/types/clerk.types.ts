export interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

export interface ClerkUserData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  deleted?: boolean;
}

export type ClerkWebhookEventType = "user.created" | "user.updated" | "user.deleted" | (string & {});

export interface ClerkWebhookEvent {
  type: ClerkWebhookEventType;
  data: ClerkUserData;
}