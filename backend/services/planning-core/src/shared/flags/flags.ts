import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenFeature, type EvaluationContext, type Provider } from "@openfeature/server-sdk";
import { FlagdProvider } from "@openfeature/flagd-provider";
import { logger } from "../logger.js";
import { FLAG_DEFAULTS, FLAG_KEYS, type FlagKey } from "./definitions.js";

/**
 * EN-15 — feature flags through OpenFeature (ADR: flags are evaluated on the server).
 *
 * Where the answers come from, in order:
 *   1. `FLAGD_HOST` set: a running flagd, over gRPC (the provider reads FLAGD_PORT, FLAGD_TLS,
 *      FLAGD_RESOLVER and the other FLAGD_* variables itself).
 *   2. A flag file in flagd's format: `FLAGD_OFFLINE_FLAG_SOURCE_PATH`, or the committed
 *      `flags/flags.flagd.json` at the repository root. Evaluated in-process; edits are picked up
 *      within about five seconds.
 *   3. Neither: no provider, and every flag takes its default from definitions.ts.
 */
export type FlagSource = "flagd" | "file" | "defaults";

const COMMITTED_FLAG_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../flags/flags.flagd.json");
const READY_TIMEOUT_MS = 5_000;
export const FLAG_DOMAIN = "connectsphere";

let source: FlagSource = "defaults";

export function flagSource(): FlagSource {
  return source;
}

/** Pure: which source an environment asks for. A file that doesn't exist is no source. */
export function chooseSource(
  env: Record<string, string | undefined>,
  fileExists: (path: string) => boolean = existsSync,
): { source: FlagSource; file?: string } {
  if (env.FLAGD_HOST?.trim()) return { source: "flagd" };
  const file = env.FLAGD_OFFLINE_FLAG_SOURCE_PATH?.trim() || COMMITTED_FLAG_FILE;
  return fileExists(file) ? { source: "file", file } : { source: "defaults" };
}

function providerFor(choice: { source: FlagSource; file?: string }): Provider | null {
  if (choice.source === "flagd") return new FlagdProvider();
  if (choice.source === "file") return new FlagdProvider({ resolverType: "in-process", offlineFlagSourcePath: choice.file! });
  return null;
}

/** Starts the provider and waits briefly for it. Never throws: flags then answer with their defaults. */
export async function initFlags(env: Record<string, string | undefined> = process.env): Promise<FlagSource> {
  await shutdownFlags();
  const choice = chooseSource(env);
  source = choice.source;
  const provider = providerFor(choice);
  if (!provider) {
    logger.info("feature flags: no flag source configured, using the defaults in definitions.ts");
    return source;
  }
  try {
    await Promise.race([
      OpenFeature.setProviderAndWait(FLAG_DOMAIN, provider),
      new Promise((_, reject) => setTimeout(() => reject(new Error("flag provider not ready in time")), READY_TIMEOUT_MS).unref()),
    ]);
    logger.info("feature flags ready", { source });
  } catch (error) {
    OpenFeature.setProvider(FLAG_DOMAIN, provider);
    logger.warn("feature flags: provider not ready, flags use their defaults until it connects", {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return source;
}

export async function shutdownFlags(): Promise<void> {
  source = "defaults";
  await OpenFeature.clearProviders();
}

/** Whether a flag is on. Never throws: a provider error yields the flag's default. */
export async function isEnabled(key: FlagKey, context: EvaluationContext = {}): Promise<boolean> {
  const fallback = FLAG_DEFAULTS[key];
  try {
    const details = await OpenFeature.getClient(FLAG_DOMAIN).getBooleanDetails(key, fallback, context);
    // With no flag source at all, every flag answers with its default by design; that is not worth a log line.
    if (details.errorCode && !(source === "defaults" && details.errorCode === "PROVIDER_NOT_READY")) {
      logger.warn("feature flag evaluation fell back to its default", { flag: key, code: details.errorCode, reason: details.reason });
    }
    return details.value;
  } catch (error) {
    logger.warn("feature flag evaluation failed, using its default", { flag: key, error: error instanceof Error ? error.message : String(error) });
    return fallback;
  }
}

/** Every flag the application knows, evaluated for one caller. */
export async function evaluateAll(context: EvaluationContext = {}): Promise<Record<FlagKey, boolean>> {
  const entries = await Promise.all(FLAG_KEYS.map(async (key) => [key, await isEnabled(key, context)] as const));
  return Object.fromEntries(entries) as Record<FlagKey, boolean>;
}
