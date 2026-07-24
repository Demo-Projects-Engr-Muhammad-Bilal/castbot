import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateTenantMiddleware } from "../middlewares/tenant.middleware";
import {
  getWorkspacesHandler,
  createWorkspaceHandler,
  updateWorkspaceHandler,
} from "../controllers/workspace.controller";

const router = Router();

router.use(authMiddleware as any);

router.get("/", getWorkspacesHandler as any);
router.post("/", createWorkspaceHandler as any);
router.patch("/:id", validateTenantMiddleware as any, updateWorkspaceHandler as any);

export default router;
