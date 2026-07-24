import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { publishVideoHandler } from "../controllers/publish.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateTenantMiddleware } from "../middlewares/tenant.middleware";
import { checkUploadCreditMiddleware } from "../middlewares/credit.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const handleMulterUpload = (req: Request, res: Response, next: NextFunction) => {
  const uploadFields = upload.fields([
    { name: "file", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]);

  uploadFields(req, res, (err: any) => {
    if (err) {
      console.error("❌ [Multer Upload Middleware Error]:", err);
      return res.status(400).json({ success: false, error: err.message || "File upload processing failed." });
    }
    // Normalize req.file if uploaded as 'video' or 'file'
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files["file"]?.[0]) {
        req.file = files["file"][0];
      } else if (files["video"]?.[0]) {
        req.file = files["video"][0];
      }
    }
    next();
  });
};

router.post(
  "/",
  (req: Request, _res: Response, next: NextFunction) => {
    console.log("📥 [POST /api/publish] Inbound request. Tenant Header:", req.headers["x-tenant-id"]);
    next();
  },
  authMiddleware,
  handleMulterUpload,
  validateTenantMiddleware as any,
  checkUploadCreditMiddleware as any,
  publishVideoHandler as any
);

export default router;
