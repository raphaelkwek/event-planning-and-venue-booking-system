import type { RequestLine } from "../repo/requestLines.js";

/** A line as the API returns it: the internal ordering column stays server-side. */
export function present(line: RequestLine) {
  return Object.fromEntries(Object.entries(line).filter(([key]) => key !== "seq"));
}
