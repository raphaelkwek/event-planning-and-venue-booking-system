/**
 * Venues are in Singapore, so booking periods are shown, entered and sent in
 * Singapore time whatever the browser's own time zone (L1).
 */

const TIME_ZONE = "Asia/Singapore";

function parts(iso: string) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => p.find((x) => x.type === type)!.value;
  return { day: `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`, time: `${part("hour")}:${part("minute")}` };
}

/**
 * "Wednesday 2 December 2026, 14:00–18:00", or both days when the period crosses midnight.
 * With no end (I5, a block that lasts until Venue Staff remove it): "from Wednesday 2 December 2026, 14:00, open-ended".
 */
export function formatPeriod(startsAt: string, endsAt: string | null): string {
  const start = parts(startsAt);
  if (endsAt === null) return `from ${start.day}, ${start.time}, open-ended`;
  const end = parts(endsAt);
  return start.day === end.day ? `${start.day}, ${start.time}–${end.time}` : `${start.day} ${start.time} to ${end.day} ${end.time}`;
}

/** "Tuesday 1 December 2026, 18:00". */
export function formatMoment(iso: string): string {
  const p = parts(iso);
  return `${p.day}, ${p.time}`;
}

/** "14:00". */
export function formatTime(iso: string): string {
  return parts(iso).time;
}

/** The date ("2026-12-02") and time ("14:00") a date and a time input show for an instant. */
export function toInputs(iso: string): { date: string; time: string } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => p.find((x) => x.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** A date and a time entered in Singapore time, as an instant with its offset. */
export function fromInputs(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}
