/** Structured JSON logs to stdout, one line per entry (implementation.md §9). */
type Fields = Record<string, unknown>;

function log(level: "info" | "warn" | "error", message: string, fields: Fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, service: "notification", message, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: Fields) => log("info", message, fields),
  warn: (message: string, fields?: Fields) => log("warn", message, fields),
  error: (message: string, fields?: Fields) => log("error", message, fields),
};
