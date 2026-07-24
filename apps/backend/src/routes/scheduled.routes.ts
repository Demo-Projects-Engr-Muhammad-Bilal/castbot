import { Router } from "express";
import { validateTenantMiddleware } from "../middlewares/tenant.middleware";
import {
  getScheduledJobsHandler,
  getScheduledJobByIdHandler,
  updateScheduledJobHandler,
  deleteScheduledJobHandler,
} from "../controllers/scheduled.controller";

const router = Router();

router.use(validateTenantMiddleware as any);

router.get("/", getScheduledJobsHandler);
router.get("/:jobId", getScheduledJobByIdHandler);
router.patch("/:jobId", updateScheduledJobHandler);
router.delete("/:jobId", deleteScheduledJobHandler);

export default router;
