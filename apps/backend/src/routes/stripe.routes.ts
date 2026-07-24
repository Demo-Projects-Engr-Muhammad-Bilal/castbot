import express, { Router } from "express";
import {
  createCheckoutSessionHandler,
  createPortalSessionHandler,
  getSubscriptionHandler,
  stripeWebhookHandler,
  downgradeSubscriptionHandler,
} from "../controllers/stripe.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateTenantMiddleware } from "../middlewares/tenant.middleware";

const router = Router();

// Express raw body parser specifically for Stripe webhook signature verification
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// Protected routes requiring authentication & active workspace context
router.get(
  "/subscription",
  authMiddleware,
  validateTenantMiddleware as any,
  getSubscriptionHandler as any
);

router.post(
  "/checkout",
  authMiddleware,
  validateTenantMiddleware as any,
  createCheckoutSessionHandler as any
);

router.post(
  "/downgrade",
  authMiddleware,
  validateTenantMiddleware as any,
  downgradeSubscriptionHandler as any
);

router.post(
  "/portal",
  authMiddleware,
  validateTenantMiddleware as any,
  createPortalSessionHandler as any
);

export default router;
