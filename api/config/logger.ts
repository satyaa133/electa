import winston from "winston";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "electa-api" },
  transports: [
    // Vercel/Serverless environments have a read-only filesystem.
    // File transports will crash the application on startup (EROFS).
    // We rely solely on Console transport which Vercel captures in its Logs dashboard.
    // Always log to console for development ease
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          (info) => `${info.timestamp} [${info.level}]: ${info.message}`,
        ),
      ),
    }),
  ],
});

export function logSecurityEvent(
  eventType: string,
  severity: "info" | "warning" | "error",
  details: Record<string, any>,
) {
  logger.log({
    level: severity,
    message: `SECURITY_EVENT: ${eventType}`,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
