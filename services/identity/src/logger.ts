import { config } from "./config.js";

type LogFields = {
  correlationId?: string;
  userId?: string | null;
  route?: string;
  durationMs?: number;
  outcome?: "success" | "refused" | "error";
  code?: string | null;
  [key: string]: unknown;
};

function log(level: "info" | "warn" | "error", message: string, fields: LogFields = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    service: config.serviceName,
    message,
    ...fields,
  };
  const output = level === "error" ? console.error : console.log;
  output(JSON.stringify(line));
}

export const logger = {
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warn: (message: string, fields?: LogFields) => log("warn", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
};
