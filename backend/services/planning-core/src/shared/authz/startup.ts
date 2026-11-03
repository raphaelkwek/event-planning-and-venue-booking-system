import { logger } from "../logger.js";
import { localPolicyDecisionPoint } from "./localPolicies.js";
import { usePolicyDecisionPoint, type PolicyDecisionPoint } from "./pdp.js";

/**
 * EN-07: which PDP this process asks, decided once at startup (src/index.ts).
 *
 * - **cerbos**: the Cerbos PDP at CERBOS_URL. Always, when NODE_ENV is production
 *   (the container images and the Kubernetes deploy set it): without an answer from
 *   that PDP every protected request is refused with 503 POLICY_UNAVAILABLE.
 * - **local-policies**: development only. When NODE_ENV isn't production and no
 *   PDP answers at CERBOS_URL (or CERBOS_URL is unset), planning-core evaluates
 *   policies/ itself, so `npm run dev` works on a Windows laptop with no WSL, where
 *   Cerbos has no build. It logs one loud warning naming the mode.
 *
 * Tests import the app without calling this, so they ask the real PDP (CI) or the
 * unit runs' stand-in, never a mode chosen here.
 */
export type PdpMode = "cerbos" | "local-policies";

export const PRODUCTION_REFUSES_LOCAL_POLICIES =
  "NODE_ENV is production, so the local-policies PDP is refused: planning-core asks the Cerbos PDP at CERBOS_URL and fails closed without it.";

/** How long `npm run dev` gives the PDP it starts alongside planning-core to come up. */
export const PROBE_WINDOW_MS = 5_000;
const PROBE_INTERVAL_MS = 500;

export type Probe = (url: string) => Promise<boolean>;

const isProduction = (env: NodeJS.ProcessEnv) => env.NODE_ENV === "production";

/** Whether a Cerbos PDP answers its health check at `url` within the window. */
export async function probeCerbos(url: string, windowMs = PROBE_WINDOW_MS): Promise<boolean> {
  const deadline = Date.now() + windowMs;
  for (;;) {
    try {
      const response = await fetch(`${url.replace(/\/+$/, "")}/_cerbos/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return true;
    } catch {
      // Not up yet, or nothing listens there.
    }
    if (Date.now() + PROBE_INTERVAL_MS > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, PROBE_INTERVAL_MS));
  }
}

export async function choosePdpMode(env: NodeJS.ProcessEnv, probe: Probe = probeCerbos): Promise<PdpMode> {
  if (isProduction(env)) return "cerbos";
  if (!env.CERBOS_URL) return "local-policies";
  return (await probe(env.CERBOS_URL)) ? "cerbos" : "local-policies";
}

/** Throws if the local-policies mode was chosen for a production process. */
export function assertPdpModeAllowed(mode: PdpMode, env: NodeJS.ProcessEnv): void {
  if (mode === "local-policies" && isProduction(env)) throw new Error(PRODUCTION_REFUSES_LOCAL_POLICIES);
}

export async function configurePolicyDecisionPoint(
  env: NodeJS.ProcessEnv = process.env,
  probe: Probe = probeCerbos,
  use: (pdp: PolicyDecisionPoint) => void = usePolicyDecisionPoint
): Promise<PdpMode> {
  const mode = await choosePdpMode(env, probe);
  assertPdpModeAllowed(mode, env);

  if (mode === "local-policies") {
    use(localPolicyDecisionPoint(undefined, env));
    logger.warn(
      "=== PERMISSIONS: LOCAL-POLICIES MODE (development only) === " +
        `No Cerbos PDP answered at ${env.CERBOS_URL ?? "CERBOS_URL (unset)"}, so planning-core is evaluating policies/ ` +
        "itself. Production never does this: it asks the PDP and refuses with 503 without it. " +
        "Start a PDP with `npm run cerbos:start` (WSL on Windows) to use the real one.",
      { code: "PDP_LOCAL_POLICIES", pdpMode: mode }
    );
    return mode;
  }

  if (!env.CERBOS_URL) {
    logger.error("CERBOS_URL is not set: every protected request will be refused with 503 POLICY_UNAVAILABLE", {
      code: "POLICY_UNAVAILABLE",
      pdpMode: mode,
    });
  } else {
    logger.info("permissions are checked by the Cerbos PDP", { pdpMode: mode, cerbosUrl: env.CERBOS_URL });
  }
  return mode;
}
