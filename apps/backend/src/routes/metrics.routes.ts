import { Router } from "express";
import { getOverviewMetricsHandler } from "../controllers/metrics.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateTenantMiddleware } from "../middlewares/tenant.middleware";

const router = Router();

router.get(
  "/",
  authMiddleware,
  validateTenantMiddleware as any,
  getOverviewMetricsHandler as any
);

export default router;
