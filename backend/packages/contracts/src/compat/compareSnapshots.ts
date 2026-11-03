import { checkBackwardCompatible, type Finding, type JsonSchema } from "./schemaCompat.js";

/** Message type (or `cloudevent` for the envelope) to its JSON Schema. */
export type SchemaSet = ReadonlyMap<string, JsonSchema>;

export interface MessageFinding extends Finding {
  /** The message type the finding is about. */
  readonly messageType: string;
}

export interface CompareResult {
  readonly findings: readonly MessageFinding[];
  /** In both sets and identical. */
  readonly unchanged: readonly string[];
  /** In both sets, different, and backward compatible. */
  readonly compatible: readonly string[];
  /** Only in the new set: a new message type needs no older version to be compatible with. */
  readonly added: readonly string[];
}

/**
 * Compares the schemas on the base branch with the branch's. Every message
 * type on the base must still exist: a consumer may still receive one from a
 * retry or a replay, so removing a type is a breaking change too.
 */
export function compareSchemaSets(base: SchemaSet, head: SchemaSet): CompareResult {
  const findings: MessageFinding[] = [];
  const unchanged: string[] = [];
  const compatible: string[] = [];

  for (const [messageType, baseSchema] of [...base].sort(([a], [b]) => a.localeCompare(b))) {
    const headSchema = head.get(messageType);
    if (headSchema === undefined) {
      findings.push({
        messageType,
        path: "$",
        rule: "message-removed",
        message: "the message type was removed; a retry or a replay can still deliver it",
      });
      continue;
    }
    if (JSON.stringify(baseSchema) === JSON.stringify(headSchema)) {
      unchanged.push(messageType);
      continue;
    }
    const own = checkBackwardCompatible(baseSchema, headSchema);
    findings.push(...own.map((found) => ({ ...found, messageType })));
    if (own.length === 0) compatible.push(messageType);
  }

  const added = [...head.keys()].filter((messageType) => !base.has(messageType)).sort((a, b) => a.localeCompare(b));
  return { findings, unchanged, compatible, added };
}

/** The lines the command prints for a comparison. */
export function describeResult(result: CompareResult, baseRef: string): string[] {
  const lines = [
    `Compared against ${baseRef}: ${result.unchanged.length} unchanged, ${result.compatible.length} changed compatibly, ${result.added.length} new, ${result.findings.length} breaking.`,
  ];
  for (const messageType of result.compatible) lines.push(`  changed compatibly: ${messageType}`);
  for (const messageType of result.added) lines.push(`  new: ${messageType}`);
  for (const found of result.findings) {
    lines.push(`  BREAKING ${found.messageType} ${found.path} [${found.rule}] ${found.message}`);
  }
  return lines;
}
