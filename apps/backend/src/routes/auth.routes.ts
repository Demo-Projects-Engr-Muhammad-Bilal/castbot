import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  initiateYouTubeOAuth,
  handleYouTubeCallback,
  initiateMetaOAuth,
  handleMetaCallback,
} from "../controllers/auth.controller";

const router = Router();

router.get("/youtube", authMiddleware, initiateYouTubeOAuth);
router.get("/callback/youtube", handleYouTubeCallback);

router.get("/facebook", authMiddleware, initiateMetaOAuth);
router.get("/callback/facebook", handleMetaCallback);

export default router;
