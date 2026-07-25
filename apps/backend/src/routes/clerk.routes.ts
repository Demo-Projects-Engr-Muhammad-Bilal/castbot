import express, { Router } from "express";
import { clerkWebhookHandler } from "../controllers/clerk.controller";

const router = Router();

// Raw body required for Svix signature verification
router.post("/webhook", express.raw({ type: "application/json" }), clerkWebhookHandler);

export default router;