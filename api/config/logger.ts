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
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880,
      maxFiles: 5,
    }),
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
