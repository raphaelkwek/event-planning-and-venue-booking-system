/** The part of a kafkajs admin client the probe uses. */
export interface ProbeAdmin {
  connect(): Promise<void>;
  describeCluster(): Promise<unknown>;
  disconnect(): Promise<void>;
}

/**
 * Whether a broker answers, for /readyz. Each check connects, asks the
 * cluster to describe itself and disconnects, so no socket stays open between
 * checks. The answer is reused for `ttlMs`, and requests that arrive together
 * share one check, so a busy /readyz does not hammer the broker.
 */
export function brokerProbe(
  createAdmin: () => ProbeAdmin,
  { ttlMs = 5000, now = Date.now }: { ttlMs?: number; now?: () => number } = {},
): () => Promise<boolean> {
  let checkedAt = -Infinity;
  let last = false;
  let inFlight: Promise<boolean> | null = null;

  async function check(): Promise<boolean> {
    const admin = createAdmin();
    let reachable = false;
    try {
      await admin.connect();
      await admin.describeCluster();
      reachable = true;
    } catch {
      // Unreachable: reported as false below.
    }
    await admin.disconnect().catch(() => undefined);
    return reachable;
  }

  return async () => {
    if (now() - checkedAt < ttlMs) return last;
    inFlight ??= check().then((reachable) => {
      last = reachable;
      checkedAt = now();
      inFlight = null;
      return reachable;
    });
    return inFlight;
  };
}
