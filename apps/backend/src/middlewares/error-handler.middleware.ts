import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";

/**
 * Centralized error handler. Must be registered LAST via `app.use()`, after all
 * routes. Any error passed to `next(err)` (including via `asyncHandler`) lands here.
 */
export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (res.headersSent) {
    return;
  }

  if (err instanceof AppError) {
    console.error(`❌ [${err.name}] ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  console.error("❌ Unhandled Express error:", err instanceof Error ? err.stack || message : message);

  res.status(500).json({
    success: false,
    error: message || "Internal server error occurred in Express daemon",
  });
}
