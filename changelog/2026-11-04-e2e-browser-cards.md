# Browser journeys for the test cards that were Not Executed, recorded from a green CI run

**Timestamp:** 2026-11-04T02:10+08:00 (SGT)
**Author:** Joash
**Scope:** `tests/e2e/` (new specs and seeding helpers), `tests/<story>/` execution records. No app code.

**Reason:** 67 cards were still Not Executed only because they needed a browser walk-through. EN-14's Playwright stack now runs them in CI, so each is automated and recorded from the run.

## What changed

1. **New specs**, each test titled with its card id and tagged with the story and the card: `r-registration` (R1 to R4), `e-access-and-console`, `j-venue-search`, `q-equipment-and-changes`, `u-safety-and-assignment`.
2. **Seeding:** the Safety Officer is a known account; API seeding leaves from 32 loopback addresses so many journeys in a row stay inside planning-core's 120-a-minute limit per address.
3. **Records:** 66 cards Pass, 1 Fail (A3-T8: the Venue Staff queue shows the event's reference, not its name), 2 stay Not Executed with what is proven (F3-T9, F4-T8: the notices need Kafka). CI run 41694828373.

## Not done

Cards whose Expected Result ends on a notification (Kafka is off in the stack), needs Temporal, or is not a browser walk-through stay Not Executed. Four screens are not axe-checked (colour contrast on the Full label, the empty My registrations link, the API console output block): they are app defects outside these cards.
