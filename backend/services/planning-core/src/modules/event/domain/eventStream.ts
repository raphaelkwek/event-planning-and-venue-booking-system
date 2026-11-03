import type { EventStatus } from "@connectsphere/contracts";

/**
 * EN-03 (ADR-0007) — the rules of an event's stream that need no database:
 * what an entry holds, and how the tamper check decides a chain is intact.
 *
 * The hash itself is computed by the database (migrations/event/0022), which
 * documents the canonical form, so the append, the trigger, the backfill and
 * the check all hash the same bytes.
 */

/** What version 1's prev_hash holds: there is no entry before it. */
export const GENESIS_HASH = "0".repeat(64);

export type StreamEntryType = "STATUS_CHANGE" | "FIELD_CHANGE";

/** F1 — a status change, as its writer describes it. */
export interface StatusChange {
  previousStatus: EventStatus | null;
  newStatus: EventStatus;
  actorUserId: string | null;
  actorRole: string;
  triggeringAction: string;
}

/** D3, G1, S2 — one field's change, before and after. */
export interface FieldChange {
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
}

/** One entry to append, in the shape of the history row it projects to. */
export interface StreamEntry {
  type: StreamEntryType;
  previousStatus: EventStatus | null;
  newStatus: EventStatus | null;
  fieldName: string | null;
  previousValue: string | null;
  newValue: string | null;
  actorUserId: string | null;
  actorRole: string;
  triggeringAction: string;
  /** Null takes the start of the writing transaction, as the history always has. */
  occurredAt: Date | null;
}

export function statusChangeEntry(change: StatusChange): StreamEntry {
  return {
    type: "STATUS_CHANGE",
    previousStatus: change.previousStatus,
    newStatus: change.newStatus,
    fieldName: null,
    previousValue: null,
    newValue: null,
    actorUserId: change.actorUserId,
    actorRole: change.actorRole,
    triggeringAction: change.triggeringAction,
    occurredAt: null,
  };
}

export function fieldChangeEntries(
  changes: readonly FieldChange[],
  actor: { userId: string; role: string },
  triggeringAction: string,
  occurredAt?: Date
): StreamEntry[] {
  return changes.map((change) => ({
    type: "FIELD_CHANGE",
    previousStatus: null,
    newStatus: null,
    fieldName: change.fieldName,
    previousValue: change.previousValue,
    newValue: change.newValue,
    actorUserId: actor.userId,
    actorRole: actor.role,
    triggeringAction,
    occurredAt: occurredAt ?? null,
  }));
}

// ---------------------------------------------------------------------------
// The tamper check (`npm run event-store:verify`).
// ---------------------------------------------------------------------------

/** One stored entry's place in its chain, with the hash the database recomputed from its columns. */
export interface StoredLink {
  aggregateId: string;
  version: number;
  prevHash: string;
  hash: string;
  recomputedHash: string;
}

export type LinkFault = "VERSION_OUT_OF_SEQUENCE" | "PREVIOUS_HASH_MISMATCH" | "HASH_MISMATCH";

export interface BrokenLink {
  aggregateId: string;
  version: number;
  fault: LinkFault;
  reason: string;
}

/**
 * Whether `link` follows `previous`, the entry checked just before it in
 * (aggregate, version) order. An entry that starts a new aggregate must be
 * version 1 and point at the genesis hash. Otherwise it must be the next
 * version and point at the previous entry's hash. Either way its own hash must
 * be the one recomputed from what it stores.
 */
export function checkLink(previous: StoredLink | null, link: StoredLink): BrokenLink | null {
  const continues = previous !== null && previous.aggregateId === link.aggregateId;
  const expectedVersion = continues ? previous.version + 1 : 1;
  const expectedPrevHash = continues ? previous.hash : GENESIS_HASH;

  if (link.version !== expectedVersion) {
    return broken(
      link,
      "VERSION_OUT_OF_SEQUENCE",
      `expected version ${expectedVersion} here, found ${link.version}, so an entry is missing`
    );
  }
  if (link.prevHash !== expectedPrevHash) {
    return broken(
      link,
      "PREVIOUS_HASH_MISMATCH",
      continues
        ? `its prev_hash is not the hash of version ${previous.version}, so an earlier entry was changed`
        : "its prev_hash is not the genesis hash"
    );
  }
  if (link.hash !== link.recomputedHash) {
    return broken(link, "HASH_MISMATCH", "its stored hash does not match its contents, so the entry was changed");
  }
  return null;
}

function broken(link: StoredLink, fault: LinkFault, reason: string): BrokenLink {
  return { aggregateId: link.aggregateId, version: link.version, fault, reason };
}

export interface ChainSummary {
  entries: number;
  events: number;
  brokenLink: BrokenLink | null;
}

/** Walks every chain in (aggregate, version) order and stops at the first broken link. */
export function summariseChains(links: readonly StoredLink[]): ChainSummary {
  let previous: StoredLink | null = null;
  let events = 0;
  for (const [index, link] of links.entries()) {
    if (previous?.aggregateId !== link.aggregateId) events += 1;
    const fault = checkLink(previous, link);
    if (fault) return { entries: index + 1, events, brokenLink: fault };
    previous = link;
  }
  return { entries: links.length, events, brokenLink: null };
}

/** A history row that no longer says what its stream entry says, or has none. */
export interface ProjectionMismatch {
  historyId: string;
  eventId: string;
  hasEntry: boolean;
}

export interface StoreVerification extends ChainSummary {
  projectionMismatch: ProjectionMismatch | null;
}

/** What the command prints, and whether it passes. */
export function verificationReport(result: StoreVerification): { ok: boolean; lines: string[] } {
  const lines = [`Checked ${result.entries} stream entries across ${result.events} events.`];
  if (result.brokenLink) {
    const { aggregateId, version, fault, reason } = result.brokenLink;
    lines.push(`First broken link: event ${aggregateId} version ${version} (${fault}): ${reason}.`);
  } else {
    lines.push("Every chain is intact.");
  }
  if (result.projectionMismatch) {
    const { historyId, eventId, hasEntry } = result.projectionMismatch;
    lines.push(
      hasEntry
        ? `History row ${historyId} of event ${eventId} does not match its stream entry.`
        : `History row ${historyId} of event ${eventId} has no stream entry.`
    );
  } else {
    lines.push("Every history row matches its stream entry.");
  }
  return { ok: !result.brokenLink && !result.projectionMismatch, lines };
}
