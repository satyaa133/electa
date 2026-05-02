import { doubleCsrf } from "csrf-csrf";

export const {
  invalidCsrfTokenError,
  generateCsrfToken,
  doubleCsrfProtection: csrfProtection,
} = doubleCsrf({
  getSecret: () =>
    process.env.JWT_ACCESS_SECRET ||
    "default-csrf-secret-do-not-use-in-production",
  cookieName: "csrf-token",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getSessionIdentifier: (req) => {
    return req.cookies?.accessToken || "anonymous-session";
  },
});

// Middleware to generate and send CSRF token
export function csrfTokenHandler(req: any, res: any) {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}

// Error handler for CSRF
export function csrfErrorHandler(err: any, req: any, res: any, next: any) {
  if (err === invalidCsrfTokenError) {
    res.status(403).json({ error: "CSRF token validation failed" });
  } else {
    next(err);
  }
}
