import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { prisma, withPrismaRetry } from "../lib/prisma";
import { encryptToken } from "../utils/crypto.util";
import { Provider } from "@repo/database";
import axios from "axios";
import crypto from "crypto";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

function getOAuthSecret(): string {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error("CLERK_SECRET_KEY environment variable is completely missing.");
  }
  return secret;
}

function generateSignedState(userId: string, tenantId?: string | null): string {
  const secret = getOAuthSecret();
  const payload = Buffer.from(JSON.stringify({ userId, tenantId: tenantId || null })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifyAndDecodeState(stateRaw?: string): { userId: string | null; tenantId: string | null } {
  if (!stateRaw) return { userId: null, tenantId: null };
  const parts = stateRaw.split(".");
  if (parts.length !== 2) return { userId: null, tenantId: null };
  const [payload, signature] = parts;
  const secret = getOAuthSecret();
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { userId: null, tenantId: null };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return {
      userId: decoded.userId || null,
      tenantId: decoded.tenantId || null,
    };
  } catch {
    return { userId: null, tenantId: null };
  }
}

/**
 * Shared OAuth-callback upsert: encrypts the access token (and refresh token,
 * when supplied) and writes the SocialAccount row for (tenantId, provider,
 * providerAccountId). `refreshToken === undefined` means "don't touch that
 * field" (matches each callback's prior per-provider upsert behavior exactly);
 * pass `null` explicitly if a provider has no refresh token concept at all.
 */
async function upsertSocialAccountForProvider(
  tenantId: string,
  userId: string | null,
  provider: Provider,
  providerAccountId: string,
  accessToken: string,
  refreshToken: string | null | undefined,
  expiresAt: Date
) {
  const encryptedAccessToken = encryptToken(accessToken);
  const encryptedRefreshToken =
    refreshToken === undefined ? undefined : refreshToken ? encryptToken(refreshToken) : null;

  return withPrismaRetry(() =>
    prisma.socialAccount.upsert({
      where: {
        tenantId_provider_providerAccountId: {
          tenantId,
          provider,
          providerAccountId,
        },
      },
      update: {
        userId,
        accessToken: encryptedAccessToken,
        ...(encryptedRefreshToken !== undefined ? { refreshToken: encryptedRefreshToken } : {}),
        expiresAt,
      },
      create: {
        tenantId,
        userId,
        provider,
        providerAccountId,
        accessToken: encryptedAccessToken,
        ...(encryptedRefreshToken !== undefined ? { refreshToken: encryptedRefreshToken } : {}),
        expiresAt,
      },
    })
  );
}

async function resolveTenantAndUser(clerkUserId?: string | null, targetTenantId?: string | null): Promise<{ tenantId: string | null; userId: string | null }> {
  const validClerkId = clerkUserId && typeof clerkUserId === "string" && clerkUserId.trim().length > 0 ? clerkUserId.trim() : null;
  if (!validClerkId) {
    return { tenantId: null, userId: null };
  }

  const dbUser = await withPrismaRetry(() =>
    prisma.user.findUnique({
      where: { clerkId: validClerkId },
      include: { tenantMembers: true },
    })
  );

  if (!dbUser) {
    return { tenantId: null, userId: null };
  }

  let finalTenantId: string | null = null;
  if (targetTenantId) {
    const match = dbUser.tenantMembers.find((tm) => tm.tenantId === targetTenantId);
    if (match) {
      finalTenantId = match.tenantId;
    }
  }

  if (!finalTenantId) {
    finalTenantId = dbUser.tenantMembers?.[0]?.tenantId || null;
  }

  return { tenantId: finalTenantId, userId: dbUser.id };
}

export async function initiateYouTubeOAuth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawUserId = req.userId || req.auth?.userId;
    const userIdStr = typeof rawUserId === "string" && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
    if (!userIdStr) {
      res.status(403).json({ success: false, error: "Authentication required to initiate YouTube OAuth." });
      return;
    }

    const headerTenantId = req.headers["x-tenant-id"] as string | undefined;
    const queryTenantId = req.query.tenantId as string | undefined;
    const targetTenantId = (queryTenantId || headerTenantId)?.trim() || null;

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const redirectUri = `${BACKEND_URL}/api/auth/callback/youtube`;
    const statePayload = generateSignedState(userIdStr, targetTenantId);

    const scope = encodeURIComponent(
      "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"
    );

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(statePayload)}`;

    res.redirect(googleAuthUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ YouTube OAuth initiate error:", msg);
    res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent(msg)}`);
  }
}

export async function handleYouTubeCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const stateRaw = req.query.state as string | undefined;

    if (error || !code) {
      res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent(error || "No code received")}`);
      return;
    }

    const { userId: clerkUserId, tenantId: stateTenantId } = verifyAndDecodeState(stateRaw);
    if (!clerkUserId) {
      console.error("❌ Invalid or tampered OAuth state signature in YouTube callback");
      res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent("Invalid or tampered state signature")}`);
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = `${BACKEND_URL}/api/auth/callback/youtube`;

    // 1. Exchange authorization code for tokens
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // 2. Query YouTube Channel info
    let channelId = "youtube-channel";
    try {
      const channelRes = await axios.get(
        "https://www.googleapis.com/youtube/v3/channels?mine=true&part=snippet",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );
      if (channelRes.data.items?.[0]) {
        channelId = channelRes.data.items[0].id || channelId;
      }
    } catch (err: unknown) {
      console.warn("⚠️ Could not fetch YouTube channel details:", err instanceof Error ? err.message : String(err));
    }

    // 3. Resolve tenant workspace strictly bound to initiating workspace
    const { tenantId, userId } = await resolveTenantAndUser(clerkUserId, stateTenantId);
    if (!tenantId) {
      res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent("No assigned workspace/tenant found for this user.")}`);
      return;
    }

    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const existing = await withPrismaRetry(() =>
      prisma.socialAccount.findFirst({
        where: { tenantId, provider: Provider.YOUTUBE },
      })
    );

    const targetRefreshToken = refresh_token || existing?.refreshToken || access_token;
    const targetAccountId = channelId !== "youtube-channel" ? channelId : (existing?.providerAccountId || channelId);

    await upsertSocialAccountForProvider(
      tenantId,
      userId,
      Provider.YOUTUBE,
      targetAccountId,
      access_token,
      targetRefreshToken || null,
      expiresAt
    );

    console.log(`✅ YouTube SocialAccount persisted securely for tenant: ${tenantId}`);
    res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=success&provider=YOUTUBE`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ YouTube OAuth callback error:", msg);
    res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent(msg)}`);
  }
}

export async function initiateMetaOAuth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawUserId = req.userId || req.auth?.userId;
    const userIdStr = typeof rawUserId === "string" && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
    if (!userIdStr) {
      res.status(403).json({ success: false, error: "Authentication required to initiate Meta OAuth." });
      return;
    }

    const headerTenantId = req.headers["x-tenant-id"] as string | undefined;
    const queryTenantId = req.query.tenantId as string | undefined;
    const targetTenantId = (queryTenantId || headerTenantId)?.trim() || null;

    const clientId = process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID || "";
    const redirectUri = `${BACKEND_URL}/api/auth/callback/facebook`;
    const statePayload = generateSignedState(userIdStr, targetTenantId);

    const scope = encodeURIComponent(
      "pages_manage_posts,instagram_content_publish,pages_show_list,pages_read_engagement,business_management"
    );

    const fbAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scope}&response_type=code&state=${encodeURIComponent(statePayload)}`;

    res.redirect(fbAuthUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Facebook OAuth initiate error:", msg);
    res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent(msg)}`);
  }
}

export async function handleMetaCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const stateRaw = req.query.state as string | undefined;

    if (error || !code) {
      res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent(error || "No code received")}`);
      return;
    }

    const { userId: clerkUserId, tenantId: stateTenantId } = verifyAndDecodeState(stateRaw);
    if (!clerkUserId) {
      console.error("❌ Invalid or tampered OAuth state signature in Meta callback");
      res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent("Invalid or tampered state signature")}`);
      return;
    }

    const clientId = process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID || "";
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || "";
    const redirectUri = `${BACKEND_URL}/api/auth/callback/facebook`;

    // 1. Exchange authorization code for short-lived access token
    const tokenRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const shortLivedToken = tokenRes.data.access_token;

    // 2. Exchange short-lived token for long-lived access token
    const longLivedRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: shortLivedToken,
      },
    });

    const longLivedToken = longLivedRes.data.access_token;

    // 3. Fetch linked Facebook Pages & connected Instagram Business Account IDs
    let pageId = "facebook-page";
    let pageAccessToken = longLivedToken;
    let igBusinessId = "instagram-business-account";

    try {
      const mePagesRes = await axios.get("https://graph.facebook.com/v19.0/me/accounts", {
        params: {
          access_token: longLivedToken,
          fields: "id,name,access_token,instagram_business_account",
        },
      });

      if (mePagesRes.data.data?.[0]) {
        const pageData = mePagesRes.data.data[0];
        pageId = pageData.id || pageId;
        pageAccessToken = pageData.access_token || pageAccessToken;
        if (pageData.instagram_business_account?.id) {
          igBusinessId = pageData.instagram_business_account.id;
        }
      }
    } catch (err: unknown) {
      console.warn("⚠️ Could not fetch Meta pages/Instagram details:", err instanceof Error ? err.message : String(err));
    }

    // 4. Resolve workspace tenant strictly bound to initiating workspace
    const { tenantId, userId } = await resolveTenantAndUser(clerkUserId, stateTenantId);
    if (!tenantId) {
      res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent("No assigned workspace/tenant found for this user.")}`);
      return;
    }

    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days for Meta long-lived tokens

    // 5. Upsert FACEBOOK account
    const existingFb = await withPrismaRetry(() =>
      prisma.socialAccount.findFirst({
        where: { tenantId, provider: Provider.FACEBOOK },
      })
    );
    const fbAccountId = pageId !== "facebook-page" ? pageId : (existingFb?.providerAccountId || pageId);

    await upsertSocialAccountForProvider(
      tenantId,
      userId,
      Provider.FACEBOOK,
      fbAccountId,
      pageAccessToken,
      undefined,
      expiresAt
    );

    // 6. Upsert INSTAGRAM account
    const existingIg = await withPrismaRetry(() =>
      prisma.socialAccount.findFirst({
        where: { tenantId, provider: Provider.INSTAGRAM },
      })
    );
    const igAccountId = igBusinessId !== "instagram-business-account" ? igBusinessId : (existingIg?.providerAccountId || igBusinessId);

    await upsertSocialAccountForProvider(
      tenantId,
      userId,
      Provider.INSTAGRAM,
      igAccountId,
      pageAccessToken,
      undefined,
      expiresAt
    );

    console.log(`✅ Meta SocialAccounts persisted securely for tenant: ${tenantId}`);
    res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=success&provider=META`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Meta OAuth callback error:", msg);
    res.redirect(`${FRONTEND_URL}/dashboard/accounts?status=error&message=${encodeURIComponent(msg)}`);
  }
}
