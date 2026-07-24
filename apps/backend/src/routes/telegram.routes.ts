import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateTenantMiddleware } from "../middlewares/tenant.middleware";
import {
  telegramWebhookHandler,
  registerTelegramBotHandler,
} from "../controllers/telegram.controller";

const router = Router();

// Telegram Bot Registration endpoint (authenticated + tenant-scoped)
router.post("/register-bot", authMiddleware, validateTenantMiddleware as any, registerTelegramBotHandler);

// Telegram Bot Webhook endpoint — INTENTIONALLY public. Telegram's own servers call
// this; auth is instead enforced by matching the inbound chat id (or ?tenantId=)
// against a registered TelegramConnection inside telegram.service.
router.post("/webhook", telegramWebhookHandler);
router.get("/webhook", (_req, res) => {
  res.status(200).json({ ok: true, message: "Telegram webhook endpoint active." });
});

export default router;
