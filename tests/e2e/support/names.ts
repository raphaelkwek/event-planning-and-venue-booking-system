/** A name no other test, retry or run has used, so a journey finds only its own rows. */
export function uniqueName(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `${prefix} ${time}${random}`;
}
