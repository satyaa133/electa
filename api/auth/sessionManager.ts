import jwt from "jsonwebtoken";
import crypto from "crypto";

export interface SessionPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: number;
  email: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export class SessionManager {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private revokedTokens: Set<string> = new Set();

  constructor(accessSecret: string, refreshSecret: string) {
    this.accessTokenSecret = accessSecret;
    this.refreshTokenSecret = refreshSecret;
  }

  createAccessToken(userId: number, email: string): string {
    return jwt.sign({ userId, email }, this.accessTokenSecret, {
      expiresIn: "15m",
      algorithm: "HS256",
      issuer: "electa-app",
      audience: "electa-api",
      jwtid: crypto.randomBytes(16).toString("hex"),
    });
  }

  createRefreshToken(
    userId: number,
    email: string,
    tokenVersion: number = 1,
  ): string {
    return jwt.sign({ userId, email, tokenVersion }, this.refreshTokenSecret, {
      expiresIn: "7d",
      algorithm: "HS256",
      issuer: "electa-app",
      audience: "electa-api",
      jwtid: crypto.randomBytes(16).toString("hex"),
    });
  }

  createSessionTokens(userId: number, email: string) {
    return {
      accessToken: this.createAccessToken(userId, email),
      refreshToken: this.createRefreshToken(userId, email),
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  validateAccessToken(token: string): SessionPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: ["HS256"],
        issuer: "electa-app",
        audience: "electa-api",
      }) as SessionPayload;

      if (this.revokedTokens.has(token)) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  validateRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        algorithms: ["HS256"],
        issuer: "electa-app",
        audience: "electa-api",
      }) as RefreshTokenPayload;

      if (this.revokedTokens.has(token)) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  refreshAccessToken(refreshToken: string): string | null {
    const payload = this.validateRefreshToken(refreshToken);
    if (!payload) return null;

    return this.createAccessToken(payload.userId, payload.email);
  }

  revokeToken(token: string): void {
    this.revokedTokens.add(token);

    setTimeout(
      () => {
        this.revokedTokens.delete(token);
      },
      7 * 24 * 60 * 60 * 1000,
    );
  }
}
