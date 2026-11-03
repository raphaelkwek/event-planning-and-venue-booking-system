import { startInMemoryTelemetry } from "../../src/index.js";

export { parentIdOf } from "../../src/index.js";

/** See startInMemoryTelemetry: call it before importing `express`. */
export const startForTest = startInMemoryTelemetry;
