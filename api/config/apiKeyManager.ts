import crypto from "crypto";
import { logger } from "./logger";

export class SecureApiKeyManager {
  private keys: string[];
  private currentIndex: number = 0;
  private cooldowns: Map<string, number> = new Map();
  private keyHashes: Map<string, string> = new Map(); // For logging only

  constructor(apiKeysString: string) {
    if (!apiKeysString || apiKeysString.trim().length === 0) {
      throw new Error("GEMINI_API_KEYS environment variable is required");
    }

    this.keys = apiKeysString
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (this.keys.length === 0) {
      throw new Error("No valid API keys provided");
    }

    // Create hashes for safe logging
    this.keys.forEach((key) => {
      const hash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
      this.keyHashes.set(key, hash);
    });

    logger.info(
      `[SecureApiKeyManager] Initialized with ${this.keys.length} API key(s)`,
    );
  }

  getNextKey(): string {
    if (this.keys.length === 0) {
      throw new Error("No API keys available");
    }

    const now = Date.now();

    // Find next available key (not in cooldown)
    for (let i = 0; i < this.keys.length; i++) {
      const index = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[index];
      const cooldownUntil = this.cooldowns.get(key) || 0;

      if (now > cooldownUntil) {
        this.currentIndex = (index + 1) % this.keys.length;
        return key;
      }
    }

    // All keys in cooldown, return next one anyway
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  markAsExhausted(key: string): void {
    const keyHash = this.keyHashes.get(key) || "unknown";

    logger.warn(
      `[SecureApiKeyManager] API quota exceeded for key ${keyHash}, cooling down for 60s`,
    );
    this.cooldowns.set(key, Date.now() + 60000);
  }

  markAsError(key: string, error: any): void {
    const keyHash = this.keyHashes.get(key) || "unknown";
    logger.warn(
      `[SecureApiKeyManager] API key error for ${keyHash}: ${error.message?.substring(0, 50)}`,
    );
  }

  getTotalKeys(): number {
    return this.keys.length;
  }

  getAvailableKeyCount(): number {
    const now = Date.now();
    return this.keys.filter((key) => {
      const cooldownUntil = this.cooldowns.get(key) || 0;
      return now > cooldownUntil;
    }).length;
  }
}

export function createApiKeyManager(): SecureApiKeyManager {
  const apiKeysString =
    process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
  if (!apiKeysString) {
    throw new Error(
      "GEMINI_API_KEYS or GEMINI_API_KEY environment variable must be set",
    );
  }
  return new SecureApiKeyManager(apiKeysString);
}
