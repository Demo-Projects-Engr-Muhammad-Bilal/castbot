import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express handler so any thrown error (including a rejected
 * Promise) is funneled to `next()` and handled by `error-handler.middleware.ts`,
 * instead of relying on each controller to remember its own try/catch.
 */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}
