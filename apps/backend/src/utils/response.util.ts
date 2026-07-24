import { Response } from "express";

/**
 * Sends a standardized success response: { success: true, ...payload }.
 * `payload` is spread at the top level (rather than forced under a `data` key)
 * so existing frontend consumers that read fields like `accounts`, `tenantId`,
 * or `data` directly continue to work unchanged.
 */
export function sendSuccess<T extends Record<string, unknown>>(
  res: Response,
  payload: T,
  statusCode = 200
): void {
  res.status(statusCode).json({ success: true, ...payload });
}

/**
 * Sends a standardized error response: { success: false, error, ...extra }.
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  extra?: Record<string, unknown>
): void {
  res.status(statusCode).json({ success: false, error: message, ...extra });
}
