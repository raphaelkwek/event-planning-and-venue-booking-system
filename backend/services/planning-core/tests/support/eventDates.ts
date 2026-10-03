/**
 * A proposed event window that is always in the future: 14:00–18:00 UTC,
 * sixty days from the day the tests run. B2 refuses a start in the past, so a
 * fixed date (these tests used 2 Oct 2026) stops every submission working
 * once that day has gone.
 */
const day = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const EVENT_START = `${day}T14:00:00.000Z`;
export const EVENT_END = `${day}T18:00:00.000Z`;
