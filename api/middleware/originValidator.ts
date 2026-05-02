export interface OriginConfig {
  allowedOrigins: string[];
  defaultOrigin: string;
}

export class OriginValidator {
  private config: OriginConfig;

  constructor(config: OriginConfig) {
    this.config = config;
  }

  isValid(origin: string | undefined): boolean {
    if (!origin) return false;

    try {
      const url = new URL(origin);
      return this.config.allowedOrigins.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          return url.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  sanitize(origin: string | undefined): string {
    if (!origin) return this.config.defaultOrigin;

    if (this.isValid(origin)) {
      return origin;
    }

    return this.config.defaultOrigin;
  }
}
