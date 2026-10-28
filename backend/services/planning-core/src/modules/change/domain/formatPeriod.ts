/**
 * A period in Singapore time, where the venues are: one day, or both ends when
 * it crosses midnight. Same wording as the notification service's period(),
 * which planning-core cannot import; S3's reasons and that service's messages
 * must read alike.
 */
const PART = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Singapore",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(iso: string): { day: string; time: string } {
  const p = PART.formatToParts(new Date(iso));
  const part = (type: string) => p.find((x) => x.type === type)!.value;
  return { day: `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`, time: `${part("hour")}:${part("minute")}` };
}

/** "Wednesday 2 December 2026, 14:00–18:00", or "Day 22:00 to Day 02:00" across midnight. */
export function formatPeriod(startsAt: string, endsAt: string): string {
  const start = parts(startsAt);
  const end = parts(endsAt);
  return start.day === end.day ? `${start.day}, ${start.time}–${end.time}` : `${start.day} ${start.time} to ${end.day} ${end.time}`;
}
