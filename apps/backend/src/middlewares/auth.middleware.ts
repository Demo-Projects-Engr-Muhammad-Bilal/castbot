import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  auth?: {
    userId: string;
    sessionId?: string;
  };
}

const secretKey = process.env.CLERK_SECRET_KEY || "";

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ success: false, error: "Unauthorized access: Missing authorization token" });
      return;
    }

    if (!secretKey) {
       res.status(500).json({ success: false, error: "Server error: Missing CLERK_SECRET_KEY" });
       return;
    }

    let userId: string | null = null;

    try {
      const verified = await verifyToken(token, { secretKey });
      if (verified && verified.sub) {
        userId = verified.sub;
      }
    } catch (err) {
      res.status(401).json({ success: false, error: "Unauthorized access: Invalid or expired token" });
      return;
    }

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access: Invalid session payload" });
      return;
    }

    req.userId = userId;
    req.auth = {
      userId,
    };

    next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(401).json({ success: false, error: `Authentication failed: ${msg}` });
  }
}
