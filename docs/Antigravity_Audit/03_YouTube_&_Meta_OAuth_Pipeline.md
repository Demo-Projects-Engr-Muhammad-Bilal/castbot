# 03 YouTube Shorts & Meta Reels OAuth Pipeline Ledger

This document audits the OAuth2 authorization code flows, API publishers, and token exchange mechanisms for **YouTube Shorts** (Google Data API v3) and **Meta Reels** (Facebook Pages API & Instagram Graph API).

---

## 1. Executive OAuth & Publishing Flow Overview

1. **YouTube Shorts (Google OAuth2)**:
   - Scope: `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube.readonly`.
   - Flow: Redirects user to Google OAuth2 consent screen $\rightarrow$ Authorization Code exchanged for `access_token` & `refresh_token` $\rightarrow$ Tokens encrypted (`AES-256-GCM`) and saved in `SocialAccount` with `provider: YOUTUBE`.
   - Publishing: `YouTubeService` initializes `google.youtube({ version: "v3" })` with decrypted refresh token and uploads video via `youtube.videos.insert`.

2. **Meta Reels (Facebook Pages & Instagram Business)**:
   - Scope: `pages_manage_posts`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`.
   - Flow: Short-lived access token exchanged for 60-day long-lived token $\rightarrow$ Linked Facebook Page ID & Instagram Business Account ID fetched via Graph API v19.0 $\rightarrow$ Encrypted tokens saved under `SocialAccount` (`provider: FACEBOOK` & `provider: INSTAGRAM`).
   - Publishing:
     - Facebook Reels: 3-phase video upload (`start` $\rightarrow$ binary stream `upload_url` $\rightarrow$ `finish` with `video_state: PUBLISHED`).
     - Instagram Reels: Container creation (`POST /{ig-user-id}/media`) $\rightarrow$ Polling container status (`status_code === FINISHED`) $\rightarrow$ Publish container (`POST /{ig-user-id}/media_publish`).

---

## 2. Paired Interaction Log: YouTube & Meta Integrations

### 📥 User Prompt
> "Implement Google OAuth2 consent URL generation and token callback handling in `auth.controller.ts` for YouTube Shorts connection."

### 📤 AG Response / Output
- **Execution Summary:** Implemented HMAC-signed state payload (`generateSignedState`) containing `clerkUserId` and `tenantId` to protect against CSRF attacks. On callback, exchanged authorization code for refresh tokens and encrypted credentials into `SocialAccount`.
- **Files Created/Modified:**
  - [`apps/backend/src/controllers/auth.controller.ts`](file:///E:/telegram_social_uploader/apps/backend/src/controllers/auth.controller.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/controllers/auth.controller.ts (YouTube Callback)
export async function handleYouTubeCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  const code = req.query.code as string;
  const stateRaw = req.query.state as string;

  const { userId: clerkUserId, tenantId: stateTenantId } = verifyAndDecodeState(stateRaw);

  const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${BACKEND_URL}/api/auth/callback/youtube`,
    grant_type: "authorization_code",
  });

  const { access_token, refresh_token, expires_in } = tokenRes.data;

  const { tenantId, userId } = await resolveTenantAndUser(clerkUserId, stateTenantId);
  const encryptedAccessToken = encryptToken(access_token);
  const encryptedRefreshToken = refresh_token ? encryptToken(refresh_token) : null;

  await prisma.socialAccount.upsert({
    where: {
      tenantId_provider_providerAccountId: {
        tenantId,
        provider: Provider.YOUTUBE,
        providerAccountId: channelId,
      },
    },
    update: { userId, accessToken: encryptedAccessToken, refreshToken: encryptedRefreshToken },
    create: { tenantId, userId, provider: Provider.YOUTUBE, providerAccountId: channelId, accessToken: encryptedAccessToken, refreshToken: encryptedRefreshToken },
  });

  res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=success&provider=YOUTUBE`);
}
```

---

### 📥 User Prompt
> "Build the YouTube Shorts publisher service using Google Data API v3 (`youtube.videos.insert`)."

### 📤 AG Response / Output
- **Execution Summary:** Built `YouTubeService` extending `BasePublisher`, using `OAuth2Client` with decrypted refresh tokens to stream local MP4 files directly to YouTube API.
- **Files Created/Modified:**
  - [`apps/backend/src/publishers/youtube.publisher.ts`](file:///E:/telegram_social_uploader/apps/backend/src/publishers/youtube.publisher.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/publishers/youtube.publisher.ts
export class YouTubeService extends BasePublisher {
  private oauth2Client: OAuth2Client;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    super();
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret) as unknown as OAuth2Client;
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
  }

  async uploadVideo(filePath: string, metadata: YouTubeUploadMetadata): Promise<string> {
    const youtube = google.youtube({ version: "v3", auth: this.oauth2Client as any });
    const res = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: metadata.title, description: metadata.description, categoryId: "24" },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      },
      media: { body: fs.createReadStream(filePath) },
    });
    return res.data.id!;
  }
}
```

---

### 📥 User Prompt
> "Implement Meta Graph API v19.0 OAuth callback and token exchange (short-lived to long-lived exchange) to connect Facebook Pages and Instagram Business Accounts."

### 📤 AG Response / Output
- **Execution Summary:** Created Meta callback handler exchanging short-lived token for 60-day long-lived token, querying `/me/accounts` for connected Facebook Page IDs and Instagram Business IDs, and persisting both `FACEBOOK` and `INSTAGRAM` social accounts.
- **Files Created/Modified:**
  - [`apps/backend/src/controllers/auth.controller.ts`](file:///E:/telegram_social_uploader/apps/backend/src/controllers/auth.controller.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/controllers/auth.controller.ts (Meta Callback)
export async function handleMetaCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  const code = req.query.code as string;
  const stateRaw = req.query.state as string;

  const longLivedRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_CLIENT_ID,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });

  const mePagesRes = await axios.get("https://graph.facebook.com/v19.0/me/accounts", {
    params: { access_token: longLivedToken, fields: "id,name,access_token,instagram_business_account" },
  });

  // Upsert FACEBOOK & INSTAGRAM social accounts...
  res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=success&provider=META`);
}
```

---

### 📥 User Prompt
> "Build the Meta Reels publishers (`FacebookService` and `InstagramService`) for automated Reel publishing."

### 📤 AG Response / Output
- **Execution Summary:** Created 3-phase Facebook Reels uploader (`start` $\rightarrow$ stream upload $\rightarrow$ `finish`) and Instagram Container-based Reel publisher (`media` $\rightarrow$ status poll $\rightarrow$ `media_publish`).
- **Files Created/Modified:**
  - [`apps/backend/src/publishers/facebook.publisher.ts`](file:///E:/telegram_social_uploader/apps/backend/src/publishers/facebook.publisher.ts)
  - [`apps/backend/src/publishers/instagram.publisher.ts`](file:///E:/telegram_social_uploader/apps/backend/src/publishers/instagram.publisher.ts)

- **Code Snippet / Configuration:**

```typescript
// apps/backend/src/publishers/instagram.publisher.ts
export class InstagramService extends BasePublisher {
  async uploadReel(publicVideoUrl: string, description: string): Promise<string> {
    const createRes = await axios.post(`${META_GRAPH_URL}/${this.accountId}/media`, {
      access_token: this.accessToken,
      video_url: publicVideoUrl,
      media_type: "REELS",
      caption: description,
    });
    const containerId = createRes.data.id;

    // Poll status until FINISHED...
    const publishRes = await axios.post(`${META_GRAPH_URL}/${this.accountId}/media_publish`, {
      access_token: this.accessToken,
      creation_id: containerId,
    });
    return publishRes.data.id;
  }
}
```

---

## 3. Strict Containment & Verification

- Output path: `E:\telegram_social_uploader\docs\Antigravity_Audit\03_YouTube_&_Meta_OAuth_Pipeline.md`.
- No files outside `docs/Antigravity_Audit` were created or modified.
