import { Request, Response, NextFunction } from "express";
import { SessionManager } from "../auth/sessionManager";
import { logger } from "../config/logger";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
  token?: string;
}

export function createAuthMiddleware(sessionManager: SessionManager) {
  return function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    const token = extractToken(req);

    if (!token) {
      logger.warn(`Request without authentication token to ${req.path}`);
      return res
        .status(401)
        .json({ error: "No authentication token provided" });
    }

    const session = sessionManager.validateAccessToken(token);
    if (!session) {
      logger.warn(`Request with invalid token to ${req.path}`);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = {
      userId: session.userId,
      email: session.email,
    };
    req.token = token;

    next();
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
}
