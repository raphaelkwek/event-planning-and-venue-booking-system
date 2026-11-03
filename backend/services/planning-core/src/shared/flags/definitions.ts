/**
 * EN-15 — the flags planning-core knows about, and the value each takes when the flag service
 * can't answer (flagd unreachable, flag missing from the file, or no flag source at all).
 *
 * A default is a decision, so it is written here and nowhere else. `change-approval` defaults to
 * on: S3 has landed, so approving a change request is complete behaviour and a missing flag must
 * not switch it off. To add a flag, see documentation/feature-flags.md.
 */
export const FLAG_DEFAULTS = {
  "change-approval": true,
} as const satisfies Record<string, boolean>;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

export const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as FlagKey[];
