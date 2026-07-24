import { Router } from "express";
import { validateTenantMiddleware } from "../middlewares/tenant.middleware";
import { getAccountsHandler, updateAccountHandler } from "../controllers/accounts.controller";

const router = Router();

router.use(validateTenantMiddleware as any);

router.get("/", getAccountsHandler);
router.post("/", updateAccountHandler);

export default router;
