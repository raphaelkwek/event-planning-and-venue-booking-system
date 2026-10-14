/**
 * Whether a value taken from a URL can be an event's id. Event ids are UUIDs,
 * and Postgres refuses to compare a uuid column with anything else (22P02).
 * Express 4 doesn't catch an async handler's rejection, so that refusal would
 * escape the route as an unhandled rejection, which stops the process. The
 * repo answers "no such event" for these instead, so every route gives its
 * usual 404.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEventId(value: string): boolean {
  return UUID.test(value);
}
