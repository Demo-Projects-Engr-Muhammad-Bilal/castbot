import { Request, Response } from "express";
import { TenantRequest } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/async-handler.util";
import { sendSuccess } from "../utils/response.util";
import { registerTelegramBot, ingestTelegramWebhookUpdate } from "../services/telegram.service";

/**
 * POST /api/telegram/register-bot
 * Registers/connects a Telegram Bot for the request's active workspace tenant.
 */
export const registerTelegramBotHandler = asyncHandler<TenantRequest>(async (req, res: Response) => {
  const result = await registerTelegramBot({
    tenantId: req.tenantId!,
    botToken: req.body.botToken,
    targetChannelId: req.body.targetChannelId,
    webhookBaseUrl: req.body.webhookBaseUrl,
    requestHeaders: req.headers,
  });

  sendSuccess(res, {
    message: "Telegram Bot registered and workspace connection activated successfully.",
    ...result,
  });
});

/**
 * POST /api/telegram/webhook
 * Public Telegram Bot API webhook ingestion endpoint (no Clerk auth — the tenant
 * is resolved from the inbound chat id / ?tenantId= param). Always replies 200
 * with an { ok, status, message } envelope, since Telegram's servers don't act
 * on non-2xx bodies the same way our own frontend would.
 */
export async function telegramWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantIdParam = req.query.tenantId as string | undefined;
    const result = await ingestTelegramWebhookUpdate(req.body, tenantIdParam);
    res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ [Telegram Webhook Global Error Handler]:", msg);
    res.status(200).json({ ok: true, status: "error", message: msg });
  }
}
